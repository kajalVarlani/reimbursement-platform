const prisma = require("../prisma/client");
const transporter = require("../config/mailer");
const { logActivity } = require("../services/activityLogService");
const { generateSignatureHash } = require("../services/digitalSignatureService");

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Returns the human-readable role string for an admin actor. */
function adminActorRole(admin) {
  if (admin.role === "SUPER_ADMIN") return "SUPER_ADMIN";
  if (admin.role) return admin.role;
  return admin.position ? admin.position.name : "ADMINISTRATOR";
}

/** Check if the admin is authorized to act (approve/reject/query) at the claim's current stage */
function canAdminActOnReimbursement(admin, reimbursement) {
  if (!admin || !reimbursement) return false;
  if (admin.role === "SUPER_ADMIN") return true;

  if (reimbursement.currentStage === "TREASURER") {
    return admin.role === "SUPER_ADMIN";
  }

  if (reimbursement.currentStage === "FACULTY_MENTOR") {
    return (
      admin.role === "FACULTY_MENTOR" &&
      (!reimbursement.assignedFacultyId || reimbursement.assignedFacultyId === admin.id)
    );
  }

  if (reimbursement.currentStage === "DEAN_STUDENTS") {
    return admin.role === "DEAN_STUDENTS";
  }

  if (reimbursement.currentStage === "ACCOUNTANT_REVIEW") {
    return admin.role === "ACCOUNTANT";
  }

  if (reimbursement.currentStage === "AWAITING_PAYMENT") {
    return admin.role === "SUPER_ADMIN";
  }

  return false;
}

/** Inject duplicate bill/metadata details for standard/super admins */
async function injectDuplicateInfo(reimbursements, admin) {
  if (!reimbursements || reimbursements.length === 0) return reimbursements;

  const billIds = [];
  for (const r of reimbursements) {
    if (r.bills) {
      for (const rb of r.bills) {
        if (rb.billId && !billIds.includes(rb.billId)) {
          billIds.push(rb.billId);
        }
      }
    }
  }

  if (billIds.length === 0) return reimbursements;

  const allRelatedBills = await prisma.reimbursementBill.findMany({
    where: { billId: { in: billIds } },
    include: {
      reimbursement: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });

  const currentPriority = admin.role === "SUPER_ADMIN" ? null : admin.position?.priority;

  for (const r of reimbursements) {
    if (!r.bills) continue;
    for (const rb of r.bills) {
      const conflicts = [];
      const matches = allRelatedBills.filter(
        (b) => b.billId === rb.billId && b.reimbursementId !== r.id
      );

      for (const match of matches) {
        const otherReim = match.reimbursement;
        if (!otherReim) continue;

        let isUnderSameApprovalRightNow = false;
        if (admin.role === "SUPER_ADMIN") {
          isUnderSameApprovalRightNow = ["PENDING", "QUERY_RAISED"].includes(otherReim.status);
        } else if (currentPriority !== null && currentPriority !== undefined) {
          isUnderSameApprovalRightNow =
            otherReim.currentPriority === currentPriority &&
            ["PENDING", "QUERY_RAISED"].includes(otherReim.status);
        }

        conflicts.push({
          reimbursementId: otherReim.id,
          event: otherReim.event,
          committee: otherReim.committee,
          amount: otherReim.amount,
          status: otherReim.status,
          currentPriority: otherReim.currentPriority,
          isPaid: otherReim.isPaid,
          user: otherReim.user,
          allocatedAmount: match.allocatedAmount,
          isUnderSameApprovalRightNow,
        });
      }

      rb.conflicts = conflicts;
    }
  }

  return reimbursements;
}

// ─── Controllers ──────────────────────────────────────────────────────────────

async function getVisibleReimbursements(req, res) {
  try {
    const admin = req.admin;
    const { status, page, limit } = req.query;

    const pageInt = parseInt(page, 10) || 1;
    const limitInt = parseInt(limit, 10) || 50;
    const skip = (pageInt - 1) * limitInt;
    const take = limitInt;

    const VALID_STATUSES = ["PENDING", "APPROVED", "REJECTED", "QUERY_RAISED", "CANCELLED"];
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Invalid status filter value: ${status}` });
    }

    let where = status ? { status } : {};

    // Role-based visibility
    if (admin.role === "SUPER_ADMIN") {
      // Super Admin (Treasurer): Global audit access to all claims
    } else if (admin.role === "FACULTY_MENTOR") {
      // Faculty Mentor: strictly claims where they are the mapped faculty mentor
      where.OR = [
        { assignedFacultyId: admin.id },
        { approvals: { some: { administratorId: admin.id } } },
      ];
    } else if (admin.role === "DEAN_STUDENTS") {
      // Dean Students: claims awaiting final sanction or all claims
      if (status === "PENDING") {
        where.currentStage = "DEAN_STUDENTS";
      }
    } else if (admin.role === "ACCOUNTANT") {
      // Accountant: only claims that have reached ACCOUNTANT_REVIEW stage in pending queue
      if (status === "PENDING") {
        where.currentStage = "ACCOUNTANT_REVIEW";
      } else {
        where.routedToAccountant = true;
      }
    } else if (admin.position) {
      const priority = admin.position.priority;
      where.currentPriority = priority;
      where.status = "PENDING";
    }

    const reimbursements = await prisma.reimbursement.findMany({
      where,
      skip,
      take,
      include: {
        user: {
          select: { id: true, name: true, email: true, designation: true, clubName: true },
        },
        approvals: {
          include: {
            administrator: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                position: { select: { name: true, priority: true } },
              },
            },
          },
          orderBy: { priority: "asc" },
        },
        bills: { include: { bill: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatReimbursement = (r) => {
      const firstBill = r.bills?.[0]?.bill;
      return {
        ...r,
        receiptUrl: firstBill ? firstBill.receiptUrl : null,
      };
    };

    const enriched = await injectDuplicateInfo(reimbursements, admin);
    return res.status(200).json(enriched.map(formatReimbursement));
  } catch (error) {
    console.error("Get visible reimbursements error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function approveReimbursement(req, res) {
  try {
    const { id } = req.params;
    const { remark } = req.body;
    const admin = req.admin;

    const reimbursement = await prisma.reimbursement.findUnique({ where: { id } });

    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (reimbursement.status !== "PENDING") {
      return res.status(400).json({
        message: `Reimbursement is already in ${reimbursement.status} status. It must be PENDING to be approved.`,
      });
    }

    // Strict sequential stage hierarchy validation
    if (reimbursement.currentStage === "TREASURER") {
      if (admin.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          message: "Forbidden: Stage 1 requires review and approval by the Treasurer (Super Admin)",
        });
      }
    } else if (reimbursement.currentStage === "FACULTY_MENTOR") {
      if (admin.role !== "FACULTY_MENTOR" && admin.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          message: "Forbidden: Stage 2 requires approval by the designated Club Faculty Mentor",
        });
      }
      if (admin.role === "FACULTY_MENTOR" && reimbursement.assignedFacultyId && reimbursement.assignedFacultyId !== admin.id) {
        return res.status(403).json({
          message: "Forbidden: You are not the designated Faculty Mentor for this club's claims",
        });
      }
    } else if (reimbursement.currentStage === "DEAN_STUDENTS") {
      if (admin.role !== "DEAN_STUDENTS" && admin.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          message: "Forbidden: Stage 3 sanction must be performed by Dean Students",
        });
      }
    } else if (reimbursement.currentStage === "ACCOUNTANT_REVIEW") {
      if (admin.role !== "ACCOUNTANT" && admin.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          message: "Forbidden: Stage 4 invoice audit must be performed by the University Accountant",
        });
      }
    } else {
      return res.status(400).json({
        message: `Claim is in ${reimbursement.currentStage} stage and cannot be approved further in the review queue.`,
      });
    }

    const currentPriority = reimbursement.currentPriority;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Upsert the ReimbursementApproval record for this admin
      const existingApproval = await tx.reimbursementApproval.findFirst({
        where: {
          reimbursementId: id,
          administratorId: admin.id,
        },
      });

      const actedAt = new Date();
      const roleStr = adminActorRole(admin);
      let sigHash = req.body.signatureHash || null;
      if (req.body.signatureImageUrl && !sigHash) {
        sigHash = generateSignatureHash({
          reimbursementId: id,
          amount: reimbursement.amount,
          signerId: admin.id,
          signerEmail: admin.email,
          signerRole: roleStr,
          timestamp: actedAt,
        });
      }

      const approvalData = {
        status: "APPROVED",
        remark,
        actedAt,
        signatureImageUrl: req.body.signatureImageUrl || null,
        signatureHash: sigHash,
        signerName: admin.name,
        signerRole: roleStr,
        signerEmail: admin.email,
      };

      if (existingApproval) {
        await tx.reimbursementApproval.update({
          where: { id: existingApproval.id },
          data: approvalData,
        });
      } else {
        await tx.reimbursementApproval.create({
          data: {
            reimbursementId: id,
            administratorId: admin.id,
            priority: currentPriority,
            ...approvalData,
          },
        });
      }

      // 2. Log this admin's approval
      await logActivity(
        {
          reimbursementId: id,
          action: "APPROVED",
          activity: remark ? `Approved with remark: ${remark}` : "Approved",
          actorType: "ADMINISTRATOR",
          administratorId: admin.id,
          actorRole: adminActorRole(admin),
        },
        tx
      );

      // 3. Stage Progression Engine
      // ── Stage 1: Treasurer Approval ➔ Faculty Mentor
      if (reimbursement.currentStage === "TREASURER" || currentPriority === 1) {
        const updatedReimbursement = await tx.reimbursement.update({
          where: { id },
          data: {
            currentStage: "FACULTY_MENTOR",
            currentPriority: 2,
          },
        });

        if (reimbursement.assignedFacultyId) {
          await tx.reimbursementApproval.create({
            data: {
              reimbursementId: id,
              administratorId: reimbursement.assignedFacultyId,
              priority: 2,
              status: "PENDING",
            },
          });
        }

        return {
          status: "ADVANCED",
          stage: "FACULTY_MENTOR",
          nextPriority: 2,
          reimbursement: updatedReimbursement,
        };
      }

      // ── Stage 2: Faculty Mentor Approval ➔ Dean Students
      if (reimbursement.currentStage === "FACULTY_MENTOR" || currentPriority === 2) {
        const updatedReimbursement = await tx.reimbursement.update({
          where: { id },
          data: {
            currentStage: "DEAN_STUDENTS",
            currentPriority: 3,
          },
        });

        const dean = await tx.administrator.findFirst({
          where: { role: "DEAN_STUDENTS" },
        });
        if (dean) {
          await tx.reimbursementApproval.create({
            data: {
              reimbursementId: id,
              administratorId: dean.id,
              priority: 3,
              status: "PENDING",
            },
          });
        }

        return {
          status: "ADVANCED",
          stage: "DEAN_STUDENTS",
          nextPriority: 3,
          reimbursement: updatedReimbursement,
        };
      }

      // ── Stage 3: Dean Students Sanction
      if (reimbursement.currentStage === "DEAN_STUDENTS" || currentPriority === 3) {
        // If claimed amount exceeds treasurer buffer -> Routes to Accountant
        if (reimbursement.routedToAccountant || !reimbursement.withinBuffer) {
          const updatedReimbursement = await tx.reimbursement.update({
            where: { id },
            data: {
              currentStage: "ACCOUNTANT_REVIEW",
              currentPriority: 4,
            },
          });

          const accountant = await tx.administrator.findFirst({
            where: { role: "ACCOUNTANT" },
          });
          if (accountant) {
            await tx.reimbursementApproval.create({
              data: {
                reimbursementId: id,
                administratorId: accountant.id,
                priority: 4,
                status: "PENDING",
              },
            });
          }

          return {
            status: "ADVANCED",
            stage: "ACCOUNTANT_REVIEW",
            nextPriority: 4,
            reimbursement: updatedReimbursement,
          };
        }

        // If Advance / Within-Projection -> Sanctioned! Directly loops back to Treasurer for Payment Mark-off
        const updatedReimbursement = await tx.reimbursement.update({
          where: { id },
          data: {
            status: "APPROVED",
            currentStage: "AWAITING_PAYMENT",
            currentPriority: 4,
          },
        });

        return {
          status: "APPROVED",
          stage: "AWAITING_PAYMENT",
          nextPriority: 4,
          reimbursement: updatedReimbursement,
        };
      }

      // ── Stage 4: Accountant Review (Post-Event only) ➔ Awaiting Payment Mark-off (Treasurer Loopback)
      if (reimbursement.currentStage === "ACCOUNTANT_REVIEW" || currentPriority === 4) {
        const updatedReimbursement = await tx.reimbursement.update({
          where: { id },
          data: {
            status: "APPROVED",
            currentStage: "AWAITING_PAYMENT",
            currentPriority: 5,
          },
        });

        return {
          status: "APPROVED",
          stage: "AWAITING_PAYMENT",
          nextPriority: 5,
          reimbursement: updatedReimbursement,
        };
      }

      return { status: "APPROVED", reimbursement };
    });

    res.status(200).json({
      message:
        result.status === "ADVANCED"
          ? `Claim approved and advanced to ${result.stage} (Stage ${result.nextPriority})`
          : "Claim fully sanctioned! Advanced to Treasurer for disbursement & payment mark-off.",
      reimbursement: result.reimbursement,
    });
  } catch (error) {
    console.error("Approve reimbursement error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function rejectReimbursement(req, res) {
  try {
    const { id } = req.params;
    const { remark } = req.body;
    const admin = req.admin;

    const reimbursement = await prisma.reimbursement.findUnique({ where: { id } });

    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (reimbursement.status !== "PENDING") {
      return res.status(400).json({
        message: `Reimbursement is already in ${reimbursement.status} status. It must be PENDING to be rejected.`,
      });
    }

    if (!canAdminActOnReimbursement(admin, reimbursement)) {
      return res.status(403).json({
        message: "Forbidden: You cannot act on this reimbursement at the current workflow priority stage",
      });
    }

    const currentPriority = reimbursement.currentPriority;

    const updatedReimbursement = await prisma.$transaction(async (tx) => {
      const existingApproval = await tx.reimbursementApproval.findFirst({
        where: {
          reimbursementId: id,
          administratorId: admin.id,
          priority: currentPriority,
        },
      });

      if (existingApproval) {
        await tx.reimbursementApproval.update({
          where: { id: existingApproval.id },
          data: { status: "REJECTED", remark, actedAt: new Date() },
        });
      } else {
        await tx.reimbursementApproval.create({
          data: {
            reimbursementId: id,
            administratorId: admin.id,
            priority: currentPriority,
            status: "REJECTED",
            remark,
            actedAt: new Date(),
          },
        });
      }

      const r = await tx.reimbursement.update({
        where: { id },
        data: { status: "REJECTED" },
      });

      await logActivity(
        {
          reimbursementId: id,
          action: "REJECTED",
          activity: remark ? `Rejected with remark: ${remark}` : "Rejected",
          actorType: "ADMINISTRATOR",
          administratorId: admin.id,
          actorRole: adminActorRole(admin),
        },
        tx
      );

      return r;
    });

    res.status(200).json({
      message: "Reimbursement rejected. Workflow terminated.",
      reimbursement: updatedReimbursement,
    });
  } catch (error) {
    console.error("Reject reimbursement error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function raiseQuery(req, res) {
  try {
    const { id } = req.params;
    const { remark } = req.body;
    const admin = req.admin;

    if (!remark || remark.trim() === "") {
      return res.status(400).json({
        message: "A remark explaining the query/concern is required",
      });
    }

    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (reimbursement.status !== "PENDING") {
      return res.status(400).json({
        message: `Cannot raise a query on a reimbursement that is in ${reimbursement.status} status. It must be PENDING to raise a query.`,
      });
    }

    if (!canAdminActOnReimbursement(admin, reimbursement)) {
      return res.status(403).json({
        message: "Forbidden: You cannot act on this reimbursement at the current workflow priority stage",
      });
    }

    const currentPriority = reimbursement.currentPriority;

    const updatedReimbursement = await prisma.$transaction(async (tx) => {
      const existingApproval = await tx.reimbursementApproval.findFirst({
        where: {
          reimbursementId: id,
          administratorId: admin.id,
          priority: currentPriority,
        },
      });

      if (existingApproval) {
        await tx.reimbursementApproval.update({
          where: { id: existingApproval.id },
          data: { status: "QUERY_RAISED", remark: remark.trim(), actedAt: new Date() },
        });
      } else {
        await tx.reimbursementApproval.create({
          data: {
            reimbursementId: id,
            administratorId: admin.id,
            priority: currentPriority,
            status: "QUERY_RAISED",
            remark: remark.trim(),
            actedAt: new Date(),
          },
        });
      }

      const r = await tx.reimbursement.update({
        where: { id },
        data: { status: "QUERY_RAISED" },
      });

      await logActivity(
        {
          reimbursementId: id,
          action: "QUERY_RAISED",
          activity: `Query raised: ${remark.trim()}`,
          actorType: "ADMINISTRATOR",
          administratorId: admin.id,
          actorRole: adminActorRole(admin),
        },
        tx
      );

      return r;
    });

    // Send email notification to the submitting user
    const { email: userEmail, name: userName } = reimbursement.user;
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: `Query Raised on Your Reimbursement Request - ${reimbursement.event}`,
        html: `
          <h2>Query Raised on Your Reimbursement</h2>
          <p>Dear ${userName},</p>
          <p>An administrator has raised a query regarding your reimbursement request and requires clarification before proceeding.</p>

          <table style="border-collapse:collapse;width:100%;margin:16px 0;">
            <tr><td style="padding:8px;font-weight:bold;background:#f3f4f6;">Event</td><td style="padding:8px;">${reimbursement.event}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;background:#f3f4f6;">Committee</td><td style="padding:8px;">${reimbursement.committee}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;background:#f3f4f6;">Amount</td><td style="padding:8px;">₹${reimbursement.amount.toFixed(2)}</td></tr>
          </table>

          <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px 16px;margin:16px 0;">
            <p style="margin:0;font-weight:bold;">Query / Concern:</p>
            <p style="margin:8px 0 0;">${remark.trim()}</p>
          </div>

          <p>Please resolve this concern directly with the administrator: <strong>${admin.name}</strong> (${admin.email}).</p>
          <p>Once resolved, the administrator will proceed to approve or reject your request.</p>
          <p style="color:#9CA3AF;font-size:12px;">Your reimbursement approval process is temporarily paused until this query is resolved.</p>
        `,
      });
    } catch (mailError) {
      console.warn(`Could not send query email to ${userEmail}:`, mailError.message);
    }

    res.status(200).json({
      message: "Query raised successfully. The user has been notified via email.",
      reimbursement: updatedReimbursement,
    });
  } catch (error) {
    console.error("Raise query error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function getApprovalHistory(req, res) {
  try {
    const admin = req.admin;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const take = limit;

    const approvals = await prisma.reimbursementApproval.findMany({
      where: {
        administratorId: admin.id,
        status: { not: "PENDING" },
      },
      skip,
      take,
      include: {
        reimbursement: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            approvals: {
              include: {
                administrator: { select: { id: true, name: true, email: true } },
              },
              orderBy: { priority: "asc" },
            },
            bills: { include: { bill: true } },
          },
        },
      },
      orderBy: { actedAt: "desc" },
    });

    const formatApproval = (app) => {
      if (!app.reimbursement) return app;
      const firstBill = app.reimbursement.bills?.[0]?.bill;
      return {
        ...app,
        reimbursement: {
          ...app.reimbursement,
          receiptUrl: firstBill ? firstBill.receiptUrl : null,
        },
      };
    };

    res.status(200).json(approvals.map(formatApproval));
  } catch (error) {
    console.error("Get approval history error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * POST /api/admin/reimbursements/:id/mark-paid
 *
 * Super Admin only — marks an APPROVED reimbursement as paid.
 */
async function markAsPaid(req, res) {
  try {
    const { id } = req.params;
    const admin = req.admin;

    if (admin.role !== "SUPER_ADMIN" && admin.role !== "ACCOUNTANT") {
      return res.status(403).json({
        message: "Forbidden: Only the Treasurer (Super Admin) or Accountant can mark reimbursements as paid",
      });
    }

    const { paymentReference, paymentProofUrl, notes } = req.body;

    const reimbursement = await prisma.reimbursement.findUnique({ where: { id } });

    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (reimbursement.status !== "APPROVED") {
      return res.status(400).json({
        message: `Only APPROVED reimbursements can be marked as paid. Current status: ${reimbursement.status}`,
      });
    }

    if (reimbursement.isPaid) {
      return res.status(409).json({ message: "Reimbursement is already marked as paid" });
    }

    const isAccountant = admin.role === "ACCOUNTANT";
    const isSuperAdmin = admin.role === "SUPER_ADMIN";

    if (!isSuperAdmin && !isAccountant) {
      return res.status(403).json({
        message: "Forbidden: Only the Treasurer or Central Accountant can record payment disbursals.",
      });
    }

    // Advance claims (within buffer) are handled directly by Treasurer
    if (isAccountant && !reimbursement.routedToAccountant && reimbursement.withinBuffer) {
      return res.status(403).json({
        message: "Forbidden: Advance buffer claims are disbursed directly by the Treasurer.",
      });
    }

    if (isAccountant && reimbursement.accountantPaid) {
      return res.status(409).json({
        message: "Accountant has already marked this claim as paid. Awaiting Treasurer final ledger confirmation.",
      });
    }

    const updatedResult = await prisma.$transaction(async (tx) => {
      // ── Step 1 in Accountant Flow: Accountant marks payment disbursed ➔ Loops back to Treasurer
      if (isAccountant) {
        const r = await tx.reimbursement.update({
          where: { id },
          data: {
            accountantPaid: true,
            accountantPaidAt: new Date(),
            accountantPaidByAdminId: admin.id,
            accountantPaymentRef: paymentReference || null,
            accountantProofUrl: paymentProofUrl || null,
            accountantNotes: notes || null,
            // Keep isPaid as false until Treasurer completes ledger confirmation
            isPaid: false,
            currentStage: "AWAITING_PAYMENT",
          },
        });

        await logActivity(
          {
            reimbursementId: id,
            action: "PAYMENT_MARKED",
            activity: `Accountant marked payment disbursed (₹${reimbursement.amount.toFixed(2)}). UTR/Ref: ${paymentReference || "N/A"}. Looped back to Treasurer for final ledger mark-off & budget debit.`,
            actorType: "ADMINISTRATOR",
            administratorId: admin.id,
            actorRole: admin.role,
          },
          tx
        );

        return { role: "ACCOUNTANT", reimbursement: r };
      }

      // ── Step 2 in Accountant Flow / Direct in Advance Flow: Treasurer final payment mark-off & budget debit
      let paidFromBuffer = false;

      // 1. Debit from Treasurer Buffer if claim was within buffer
      if (reimbursement.withinBuffer) {
        paidFromBuffer = true;
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

        if (buffer) {
          const newBalance = Math.max(0, buffer.currentBalance - reimbursement.amount);
          await tx.treasurerBuffer.update({
            where: { id: buffer.id },
            data: { currentBalance: newBalance },
          });

          await tx.bufferTransaction.create({
            data: {
              bufferId: buffer.id,
              type: "REIMBURSEMENT_PAYOUT",
              amount: reimbursement.amount,
              balanceAfter: newBalance,
              reimbursementId: id,
              notes: notes || `Disbursed for ${reimbursement.committee} - ${reimbursement.event} (${paymentReference || "Direct"})`,
            },
          });
        }
      }

      // 2. Debit Club Sanctioned Budget
      try {
        const committeeName = (reimbursement.committee || "").trim();
        let clubBudget = await tx.clubBudget.findFirst({
          where: { clubName: committeeName },
          orderBy: { updatedAt: "desc" },
        });
        if (clubBudget) {
          const newSpent = clubBudget.spentAmount + reimbursement.amount;
          await tx.clubBudget.update({
            where: { id: clubBudget.id },
            data: { spentAmount: newSpent },
          });
        }
      } catch (budgetErr) {
        console.warn("Could not update club budget on mark-paid:", budgetErr.message);
      }

      // 3. Debit Cycle Projection Quota if claimed against an approved projection
      if (reimbursement.projectionId) {
        try {
          await tx.monthlyProjection.update({
            where: { id: reimbursement.projectionId },
            data: {
              spentAmount: {
                increment: reimbursement.amount,
              },
            },
          });
        } catch (projErr) {
          console.warn("Could not update projection spentAmount:", projErr.message);
        }
      }

      const effectivePaymentRef = paymentReference || reimbursement.accountantPaymentRef || null;
      const effectiveProofUrl = paymentProofUrl || reimbursement.accountantProofUrl || null;

      const r = await tx.reimbursement.update({
        where: { id },
        data: {
          isPaid: true,
          paidAt: new Date(),
          paidByAdminId: admin.id,
          paidFromBuffer,
          paymentReference: effectivePaymentRef,
          paymentProofUrl: effectiveProofUrl,
          currentStage: "COMPLETED",
        },
      });

      await logActivity(
        {
          reimbursementId: id,
          action: "PAYMENT_MARKED",
          activity: reimbursement.accountantPaid
            ? `Treasurer confirmed accountant disbursal (₹${reimbursement.amount.toFixed(2)}). Debited club budget. Ref: ${effectivePaymentRef || "N/A"}`
            : `Payment disbursed and portal debited (₹${reimbursement.amount.toFixed(2)}). Ref: ${effectivePaymentRef || "N/A"}`,
          actorType: "ADMINISTRATOR",
          administratorId: admin.id,
          actorRole: admin.role,
        },
        tx
      );

      return { role: "SUPER_ADMIN", reimbursement: r };
    });

    // If Treasurer finalized, send user payment confirmation email
    if (updatedResult.role === "SUPER_ADMIN") {
      const reimbursementWithUser = await prisma.reimbursement.findUnique({
        where: { id },
        include: { user: { select: { name: true, email: true } } },
      });

      if (reimbursementWithUser?.user) {
        const { name: userName, email: userEmail } = reimbursementWithUser.user;
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject: `Payment Processed for Your Reimbursement - ${reimbursementWithUser.event}`,
            html: `
              <h2>Your Reimbursement Has Been Paid</h2>
              <p>Dear ${userName},</p>
              <p>Great news! Your reimbursement request has been fully sanctioned and payment has now been disbursed.</p>

              <table style="border-collapse:collapse;width:100%;margin:16px 0;">
                <tr><td style="padding:8px;font-weight:bold;background:#f3f4f6;">Event</td><td style="padding:8px;">${reimbursementWithUser.event}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;background:#f3f4f6;">Committee</td><td style="padding:8px;">${reimbursementWithUser.committee}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;background:#f3f4f6;">Amount</td><td style="padding:8px;">₹${reimbursementWithUser.amount.toFixed(2)}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;background:#f3f4f6;">Payment Ref / UTR</td><td style="padding:8px;">${paymentReference || reimbursement.accountantPaymentRef || "Direct Bank Settlement"}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;background:#f3f4f6;">Paid On</td><td style="padding:8px;">${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</td></tr>
              </table>

              <div style="background:#d1fae5;border-left:4px solid #10b981;padding:12px 16px;margin:16px 0;">
                <p style="margin:0;font-weight:bold;">Payment confirmed ✅</p>
                <p style="margin:8px 0 0;">The amount of ₹${reimbursementWithUser.amount.toFixed(2)} has been marked as disbursed to the provided account/UPI details.</p>
              </div>

              <p>If you have any questions, please reach out to the finance team.</p>
              <p style="color:#9CA3AF;font-size:12px;">This is an automated notification from ClaimNest Reimbursement Platform.</p>
            `,
          });
        } catch (mailError) {
          console.warn(`Could not send payment confirmation email to ${userEmail}:`, mailError.message);
        }
      }
    }

    res.status(200).json({
      message:
        updatedResult.role === "ACCOUNTANT"
          ? "Payment marked as disbursed by Accountant! Claim has looped back to the Treasurer for final ledger confirmation & budget debit."
          : "Reimbursement payment confirmed & marked as paid successfully.",
      reimbursement: updatedResult.reimbursement,
    });
  } catch (error) {
    console.error("Mark as paid error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * GET /api/admin/reimbursements/:id/activity
 *
 * Returns the full activity log for a reimbursement (admin access).
 */
async function getActivityLog(req, res) {
  try {
    const { id } = req.params;

    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
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
    console.error("Get activity log (admin) error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = {
  getVisibleReimbursements,
  approveReimbursement,
  rejectReimbursement,
  raiseQuery,
  getApprovalHistory,
  markAsPaid,
  getActivityLog,
};
