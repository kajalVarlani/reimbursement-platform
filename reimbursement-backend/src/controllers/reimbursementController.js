const prisma = require("../prisma/client");
const cloudinary = require("../config/cloudinary");

const { logActivity } = require("../services/activityLogService");
const { generateSignatureHash, buildAuditTrailCertificate } = require("../services/digitalSignatureService");

const crypto = require("crypto");


// Helper to stream upload Multer buffer to Cloudinary
const uploadToCloudinary = (fileBuffer, mimetype) => {
  return new Promise((resolve, reject) => {
    const isPdf = mimetype === "application/pdf";
    const options = { folder: "reimbursements" };

    if (isPdf) {
      options.resource_type = "raw";
      const randomName = crypto.randomBytes(16).toString("hex");
      options.public_id = `${randomName}.pdf`;
    } else {
      options.resource_type = "auto";
    }

    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.write(fileBuffer);
    stream.end();
  });
};

async function createReimbursement(req, res) {
  try {
    const {
      committee,
      event,
      description,
      recipientType,
      beneficiaryName,
      paymentMode,
      bankName,
      accountNumber,
      ifscCode,
      upiId,
    } = req.body;

    if (!committee || !event) {
      return res.status(400).json({
        message: "Committee and event are required",
      });
    }

    let bills = [];
    if (typeof req.body.bills === "string") {
      try {
        bills = JSON.parse(req.body.bills);
      } catch (err) {
        return res.status(400).json({
          message: "Invalid bills data format. Must be JSON.",
        });
      }
    } else if (Array.isArray(req.body.bills)) {
      bills = req.body.bills;
    }

    if (!bills || bills.length === 0) {
      return res.status(400).json({
        message: "At least one bill is required to submit a reimbursement claim",
      });
    }

    // Validate that number of uploaded files matches number of bills
    if (!req.files || req.files.length !== bills.length) {
      return res.status(400).json({
        message: `Number of uploaded receipts (${req.files ? req.files.length : 0}) does not match number of bills (${bills.length})`,
      });
    }

    // Validate each bill metadata & calculate total amount
    let totalClaimedAmount = 0;
    const validatedBills = [];

    for (let i = 0; i < bills.length; i++) {
      const bill = bills[i];
      const amountFloat = parseFloat(bill.amount);
      const allocatedFloat = parseFloat(bill.allocatedAmount);

      if (isNaN(amountFloat) || amountFloat <= 0) {
        return res.status(400).json({
          message: `Bill #${i + 1} must have a valid total amount greater than zero`,
        });
      }

      if (isNaN(allocatedFloat) || allocatedFloat <= 0) {
        return res.status(400).json({
          message: `Bill #${i + 1} must have a valid claimed amount greater than zero`,
        });
      }

      if (allocatedFloat > amountFloat) {
        return res.status(400).json({
          message: `Bill #${i + 1} claimed amount (₹${allocatedFloat}) cannot exceed the total bill amount (₹${amountFloat})`,
        });
      }

      totalClaimedAmount += allocatedFloat;

      validatedBills.push({
        ...bill,
        amount: amountFloat,
        allocatedAmount: allocatedFloat,
      });
    }

    // Upload files to Cloudinary in parallel
    const uploadPromises = req.files.map((file) => {
      if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_CLOUD_NAME) {
        console.warn("Cloudinary not configured. Using fallback mock receipt URL.");
        return Promise.resolve({ secure_url: "https://res.cloudinary.com/demo/image/upload/v1580976523/sample.jpg" });
      }
      return uploadToCloudinary(file.buffer, file.mimetype);
    });

    let uploadResults;
    try {
      uploadResults = await Promise.all(uploadPromises);
    } catch (uploadError) {
      console.error("Cloudinary upload failed:", uploadError);
      return res.status(500).json({
        message: "Failed to upload one or more receipts to Cloudinary",
      });
    }

    // Map Cloudinary urls to validated bills
    const billsWithUrls = validatedBills.map((bill, index) => ({
      ...bill,
      receiptUrl: uploadResults[index].secure_url,
    }));

    // Use Prisma transaction to create reimbursement, bills, connections, and approval trail
    const reimbursement = await prisma.$transaction(async (tx) => {
      // 1. Look up designated Faculty Mentor for this Club / Committee
      const clubMapping = await tx.clubMentorMapping.findUnique({
        where: { clubName: committee.trim() },
        include: { facultyMentor: true },
      });

      if (!clubMapping) {
        throw new Error(
          `No designated faculty mentor mapped for "${committee.trim()}". Please contact the Treasurer to assign a Faculty Mentor before submitting claims.`
        );
      }

      // 2. Check Club Sanctioned Budget Limit
      const clubBudget = await tx.clubBudget.findFirst({
        where: { clubName: committee.trim() },
        orderBy: { createdAt: "desc" },
      });
      const remainingClubBudget = clubBudget
        ? Math.max(0, clubBudget.allocatedAmount - clubBudget.spentAmount)
        : null;
      const exceedsClubBudget = Boolean(clubBudget && totalClaimedAmount > remainingClubBudget);

      // 3. Check Active Cycle & Approved Projection to determine Claim Type (ADVANCE vs POST_EVENT)
      const activeCycle = await tx.projectionWindow.findFirst({
        where: { isActive: true },
      });

      let clubProjection = null;
      if (activeCycle) {
        clubProjection = await tx.monthlyProjection.findFirst({
          where: {
            clubName: committee.trim(),
            OR: [{ cycleId: activeCycle.id }, { targetMonth: activeCycle.targetMonth }],
            status: "APPROVED",
          },
        });
      }

      const remainingProjectionQuota = clubProjection
        ? Math.max(0, clubProjection.totalEstimatedAmount - (clubProjection.spentAmount || 0))
        : 0;

      // 3. Check current available Treasurer buffer
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      let buffer = await tx.treasurerBuffer.findFirst({
        where: { currentMonth },
        orderBy: { updatedAt: "desc" },
      });
      if (!buffer) {
        buffer = await tx.treasurerBuffer.findFirst({
          orderBy: { updatedAt: "desc" },
        });
      }

      const availableBuffer = activeCycle
        ? Math.max(0, activeCycle.bufferAmount - activeCycle.usedBufferAmount)
        : (buffer ? buffer.currentBalance : 50000.0);

      // Flow 1: If claimed amount <= available Treasurer buffer, it is within buffer and does NOT involve accountant.
      // Flow 2: If claimed amount > available buffer, it exceeds buffer and must be routed to accountant.
      const withinBuffer = totalClaimedAmount <= availableBuffer;
      const routedToAccountant = !withinBuffer;
      const claimType = withinBuffer ? "ADVANCE" : "POST_EVENT";

      let accountantReason = null;
      if (routedToAccountant) {
        accountantReason = `Claim amount ₹${totalClaimedAmount.toLocaleString()} exceeds available Treasurer buffer (₹${availableBuffer.toLocaleString()} available). Routed to Central Accountant review.`;
      }

      // 4. Create reimbursement with Stage 1: TREASURER
      const r = await tx.reimbursement.create({
        data: {
          committee: committee.trim(),
          event: event.trim(),
          amount: totalClaimedAmount,
          description: description ? description.trim() : null,
          status: "PENDING",
          currentStage: "TREASURER",
          currentPriority: 1,
          assignedFacultyId: clubMapping.facultyMentorId,
          claimType,
          projectionId: clubProjection ? clubProjection.id : null,
          withinBuffer,
          routedToAccountant,
          accountantReason,
          recipientType: recipientType || "STUDENT",
          beneficiaryName: beneficiaryName || req.user.name,
          paymentMode: paymentMode || "BANK_TRANSFER",
          bankName: bankName || null,
          accountNumber: accountNumber || null,
          ifscCode: ifscCode || null,
          upiId: upiId || null,
          submissionSignatureUrl: req.body.signatureImageUrl || null,
          submissionSignatureHash: null,
          submissionSignedAt: req.body.signatureImageUrl ? new Date() : null,
          user: { connect: { id: req.user.id } },
        },
      });

      // If convenor submitted a visual signature, generate tamper-proof cryptographic hash
      if (req.body.signatureImageUrl) {
        const sigTime = new Date();
        const sigHash = generateSignatureHash({
          reimbursementId: r.id,
          amount: totalClaimedAmount,
          signerId: req.user.id,
          signerEmail: req.user.email,
          signerRole: req.user.designation || "CONVENOR",
          timestamp: sigTime,
        });
        await tx.reimbursement.update({
          where: { id: r.id },
          data: {
            submissionSignatureHash: sigHash,
            submissionSignedAt: sigTime,
          },
        });
        r.submissionSignatureHash = sigHash;
        r.submissionSignedAt = sigTime;
      }

      // 5. Create and connect each bill
      for (const billData of billsWithUrls) {
        const uniqueIdentifier = billData.transactionId && billData.transactionId.trim() !== ""
          ? `txn:${billData.transactionId.trim()}`
          : (billData.vendorName && billData.vendorName.trim() !== "") || (billData.invoiceNumber && billData.invoiceNumber.trim() !== "")
            ? `inv:${(billData.vendorName || "").trim().toLowerCase()}|${(billData.invoiceNumber || "").trim().toLowerCase()}|${billData.billDate ? new Date(billData.billDate).toISOString().slice(0, 10) : ""}|${billData.amount}`
            : `uniq:${crypto.randomUUID()}`;

        let bill = await tx.bill.findUnique({ where: { uniqueIdentifier } });

        if (!bill) {
          bill = await tx.bill.create({
            data: {
              vendorName: billData.vendorName || null,
              invoiceNumber: billData.invoiceNumber || null,
              transactionId: billData.transactionId || null,
              billDate: billData.billDate ? new Date(billData.billDate) : null,
              amount: billData.amount,
              receiptUrl: billData.receiptUrl,
              uniqueIdentifier,
            },
          });
        }

        await tx.reimbursementBill.create({
          data: {
            reimbursementId: r.id,
            billId: bill.id,
            allocatedAmount: billData.allocatedAmount,
          },
        });
      }

      // 6. Create approval stub for Treasurer (Stage 1)
      const treasurer = await tx.administrator.findFirst({
        where: { role: "SUPER_ADMIN" },
      });
      if (treasurer) {
        await tx.reimbursementApproval.create({
          data: {
            reimbursementId: r.id,
            administratorId: treasurer.id,
            priority: 1,
            status: "PENDING",
          },
        });
      }

      // 7. Write activity log
      await logActivity(
        {
          reimbursementId: r.id,
          action: "SUBMITTED",
          activity: `Claim submitted for ₹${totalClaimedAmount.toFixed(2)} (${claimType === "ADVANCE" ? "Advance/Within-Projection" : "Post-Event Manual"}). Routed to Treasurer for Stage 1 review.`,
          actorType: "USER",
          userId: req.user.id,
          actorRole: req.user.designation || "CONVENOR",
        },
        tx
      );

      return r;
    });

    res.status(201).json({
      message: "Reimbursement submitted successfully",
      reimbursement: {
        ...reimbursement,
        receiptUrl: billsWithUrls[0].receiptUrl, // preserve receiptUrl of first bill for simple list compatibility
      },
    });
  } catch (error) {
    console.error("Create reimbursement error:", error);
    res.status(400).json({ message: error.message || "Internal Server Error" });
  }
}

// Helper to map receiptUrl for frontend compatibility
const formatReimbursement = (r) => {
  if (!r) return null;
  const firstBill = r.bills?.[0]?.bill;
  return {
    ...r,
    receiptUrl: firstBill ? firstBill.receiptUrl : null,
  };
};

async function getMyReimbursements(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const take = limit;

    const reimbursements = await prisma.reimbursement.findMany({
      where: { userId: req.user.id },
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        approvals: {
          include: {
            administrator: {
              select: {
                id: true,
                name: true,
                email: true,
                position: true,
              },
            },
          },
        },
        bills: {
          include: {
            bill: true,
          },
        },
      },
    });

    res.status(200).json(reimbursements.map(formatReimbursement));
  } catch (error) {
    console.error("Get my reimbursements error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function getReimbursementDetails(req, res) {
  try {
    const { id } = req.params;

    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        approvals: {
          include: {
            administrator: {
              select: {
                id: true,
                name: true,
                email: true,
                position: true,
              },
            },
          },
          orderBy: { priority: "asc" },
        },
        bills: {
          include: { bill: true },
        },
      },
    });

    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    // Access control: only the submitting user can view details
    if (reimbursement.userId !== req.user.id) {
      return res.status(403).json({
        message: "Forbidden: You can only view your own reimbursements",
      });
    }

    res.status(200).json(formatReimbursement(reimbursement));
  } catch (error) {
    console.error("Get reimbursement details error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * POST /api/user/reimbursements/:id/cancel
 * Allows a user to cancel their own PENDING reimbursement.
 */
async function cancelReimbursement(req, res) {
  try {
    const { id } = req.params;

    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id },
    });

    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (reimbursement.userId !== req.user.id) {
      return res.status(403).json({
        message: "Forbidden: You can only cancel your own reimbursements",
      });
    }

    if (reimbursement.status !== "PENDING" && reimbursement.status !== "QUERY_RAISED") {
      return res.status(400).json({
        message: `Cannot cancel a reimbursement that is already ${reimbursement.status}`,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.reimbursement.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      await logActivity(
        {
          reimbursementId: id,
          action: "CANCELLED",
          activity: "Reimbursement cancelled by the submitter",
          actorType: "USER",
          userId: req.user.id,
          actorRole: "USER",
        },
        tx
      );

      return r;
    });

    res.status(200).json({
      message: "Reimbursement cancelled successfully",
      reimbursement: updated,
    });
  } catch (error) {
    console.error("Cancel reimbursement error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * GET /api/user/reimbursements/:id/activity
 * Returns the activity log for a reimbursement (owner only).
 */
async function getActivityLog(req, res) {
  try {
    const { id } = req.params;

    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (reimbursement.userId !== req.user.id) {
      return res.status(403).json({
        message: "Forbidden: You can only view logs for your own reimbursements",
      });
    }

    const logs = await prisma.activityLog.findMany({
      where: { reimbursementId: id },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        administrator: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(200).json(logs);
  } catch (error) {
    console.error("Get activity log error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * POST /api/user/reimbursements/:id/resubmit
 * Allows a user to resubmit a reimbursement that has a QUERY_RAISED status.
 */
async function resubmitReimbursement(req, res) {
  try {
    const { id } = req.params;
    const { remark } = req.body;

    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (reimbursement.userId !== req.user.id) {
      return res.status(403).json({
        message: "Forbidden: You can only resubmit your own reimbursements",
      });
    }

    if (reimbursement.status !== "QUERY_RAISED") {
      return res.status(400).json({
        message: `Cannot resubmit a reimbursement that is in ${reimbursement.status} status. Only QUERY_RAISED claims can be resubmitted.`,
      });
    }

    const currentPriority = reimbursement.currentPriority;

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Transition status back to PENDING
      const r = await tx.reimbursement.update({
        where: { id },
        data: { status: "PENDING" },
      });

      // 2. Set any QUERY_RAISED approvals at currentPriority back to PENDING
      await tx.reimbursementApproval.updateMany({
        where: {
          reimbursementId: id,
          priority: currentPriority,
          status: "QUERY_RAISED",
        },
        data: {
          status: "PENDING",
        },
      });

      // 3. Log the resubmission activity
      await logActivity(
        {
          reimbursementId: id,
          action: "RESUBMITTED",
          activity: remark ? `Resubmitted with remark: ${remark.trim()}` : "Resubmitted",
          actorType: "USER",
          userId: req.user.id,
          actorRole: "USER",
        },
        tx
      );

      return r;
    });

    // 4. Send email notification to administrators at the current priority level
    const admins = await prisma.administrator.findMany({
      where: { position: { priority: currentPriority } },
    });

    const transporter = require("../config/mailer");
    for (const admin of admins) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: admin.email,
          subject: `Reimbursement Resubmitted - ${reimbursement.event}`,
          html: `
            <h2>Reimbursement Resubmitted</h2>
            <p>Dear ${admin.name},</p>
            <p>The submitting user has resubmitted their reimbursement request after addressing a query/concern.</p>

            <table style="border-collapse:collapse;width:100%;margin:16px 0;">
              <tr><td style="padding:8px;font-weight:bold;background:#f3f4f6;">Event</td><td style="padding:8px;">${reimbursement.event}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;background:#f3f4f6;">Committee</td><td style="padding:8px;">${reimbursement.committee}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;background:#f3f4f6;">Amount</td><td style="padding:8px;">₹${reimbursement.amount.toFixed(2)}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;background:#f3f4f6;">Submitted By</td><td style="padding:8px;">${reimbursement.user.name} (${reimbursement.user.email})</td></tr>
            </table>

            ${remark ? `
            <div style="background:#f3f4f6;border-left:4px solid #3b82f6;padding:12px 16px;margin:16px 0;">
              <p style="margin:0;font-weight:bold;">User Response Remark:</p>
              <p style="margin:8px 0 0;">${remark.trim()}</p>
            </div>
            ` : ""}

            <p>Please log in to the dashboard to review and approve/reject the claim.</p>
            <p style="color:#9CA3AF;font-size:12px;">This is an automated notification from the Reimbursement Platform.</p>
          `,
        });
      } catch (mailError) {
        console.warn(`Could not send resubmission email to admin ${admin.email}:`, mailError.message);
      }
    }

    res.status(200).json({
      message: "Reimbursement resubmitted successfully",
      reimbursement: updated,
    });
  } catch (error) {
    console.error("Resubmit reimbursement error:", error);
    res.status(400).json({ message: error.message || "Internal Server Error" });
  }
}

/**
 * GET /api/user/my-budget?month=YYYY-MM
 * Returns the club budget for the authenticated C/DC user's club, for the given month.
 * Also computes how much has been spent (approved + paid claims from this club in the month).
 */
async function getMyClubBudget(req, res) {
  try {
    const user = req.user;
    if (!user.clubName) {
      return res.status(200).json({ hasBudget: false });
    }

    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const targetMonth = req.query.month || defaultMonth;

    let budget = await prisma.clubBudget.findUnique({
      where: { clubName_targetMonth: { clubName: user.clubName.trim(), targetMonth } },
    });

    // Fallback: if no budget specifically for targetMonth, check if any budget exists for this club
    if (!budget && !req.query.month) {
      budget = await prisma.clubBudget.findFirst({
        where: { clubName: user.clubName.trim() },
        orderBy: { updatedAt: "desc" },
      });
    }

    if (!budget) {
      return res.status(200).json({ hasBudget: false, clubName: user.clubName, targetMonth });
    }

    res.status(200).json({
      hasBudget: true,
      id: budget.id,
      clubName: budget.clubName,
      targetMonth: budget.targetMonth,
      allocatedAmount: budget.allocatedAmount,
      spentAmount: budget.spentAmount,
      remainingAmount: Math.max(0, budget.allocatedAmount - budget.spentAmount),
      notes: budget.notes,
    });
  } catch (error) {
    console.error("Get my club budget error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function getSignatureAuditCertificate(req, res) {
  try {
    const { id } = req.params;
    const raw = await buildAuditTrailCertificate(id);
    if (!raw) {
      return res.status(404).json({ message: "Reimbursement claim not found" });
    }
    // Normalise into a shape the front-end and tests expect
    const certificate = {
      certificateNumber: raw.certificateId,
      claim: {
        id: raw.claimId,
        committee: raw.committee,
        event: raw.event,
        amount: raw.amount,
        claimType: raw.claimType,
        status: raw.status,
        currentStage: raw.currentStage,
        isPaid: raw.isPaid,
        paymentReference: raw.paymentReference,
        paidAt: raw.paidAt,
      },
      generatedAt: raw.generatedAt,
      verificationStatus: raw.isTamperProof ? "100% VERIFIED AUTHENTIC" : "INTEGRITY WARNING",
      isTamperProof: raw.isTamperProof,
      signatures: (raw.signatures || []).map((s) => ({
        stage: s.stage,
        signerRole: s.role,
        signerName: s.signerName,
        signerEmail: s.signerEmail,
        signatureHash: s.signatureHash,
        signatureImageUrl: s.signatureImageUrl,
        signedAt: s.signedAt,
        isValid: s.isValid,
        remarks: s.remarks,
      })),
    };
    res.status(200).json({ certificate });
  } catch (error) {
    console.error("Get signature audit certificate error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = {
  createReimbursement,
  getMyReimbursements,
  getReimbursementDetails,
  cancelReimbursement,
  getActivityLog,
  resubmitReimbursement,
  getMyClubBudget,
  getSignatureAuditCertificate,
};

