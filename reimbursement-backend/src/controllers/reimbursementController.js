const prisma = require("../prisma/client");
const cloudinary = require("../config/cloudinary");

const { logActivity } = require("../services/activityLogService");

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
    const { committee, event, amount, description } = req.body;

    if (!committee || !event || !amount) {
      return res.status(400).json({
        message: "Committee, event, and amount are required",
      });
    }

    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat)) {
      return res.status(400).json({
        message: "Amount must be a number",
      });
    }

    if (amountFloat <= 0) {
      return res.status(400).json({
        message: "Amount must be greater than zero",
      });
    }


    // Upload to Cloudinary
    if (!req.file) {
      return res.status(400).json({ message: "Receipt is required" });
    }

    let receiptUrl;
    if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_CLOUD_NAME) {
      console.warn("Cloudinary not configured. Using fallback mock receipt URL.");
      receiptUrl = "https://res.cloudinary.com/demo/image/upload/v1580976523/sample.jpg";
    } else {
      try {
        const uploadResult = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
        receiptUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError);
        return res.status(500).json({
          message: "Failed to upload receipt image to Cloudinary",
        });
      }
    }

    // Use Prisma transaction to create reimbursement and its initial approval tracking rows

    const reimbursement = await prisma.$transaction(async (tx) => {
      // Resolve the lowest-priority position dynamically so the claim is routed
      // correctly even if the hierarchy doesn’t start at 1.
      const lowestPosition = await tx.position.findFirst({
        orderBy: { priority: "asc" },
      });

      if (!lowestPosition) {
        throw new Error("No approval positions configured. Cannot submit reimbursement.");
      }

      // Create reimbursement
      const r = await tx.reimbursement.create({
        data: {
          committee,
          event,
          amount: amountFloat,
          description,
          status: "PENDING",
          currentPriority: lowestPosition.priority,
          userId: req.user.id,
        },
      });

      // Find administrators at the lowest priority
      const admins = await tx.administrator.findMany({
        where: { position: { priority: lowestPosition.priority } },
      });

      // Create approval stubs
      if (admins.length > 0) {
        await tx.reimbursementApproval.createMany({
          data: admins.map((admin) => ({
            reimbursementId: r.id,
            administratorId: admin.id,
            priority: lowestPosition.priority,
            status: "PENDING",
          })),
        });
      }

      // Write activity log
      await logActivity(
        {
          reimbursementId: r.id,
          action: "SUBMITTED",
          activity: `Reimbursement submitted for ₹${amountFloat.toFixed(2)}`,
          actorType: "USER",
          userId: req.user.id,
          actorRole: "USER",
        },
        tx
      );

      return r;
    });

    res.status(201).json({
      message: "Reimbursement submitted successfully",
      reimbursement,
    });
  } catch (error) {
    console.error("Create reimbursement error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function getMyReimbursements(req, res) {
  try {
    const reimbursements = await prisma.reimbursement.findMany({
      where: { userId: req.user.id },
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

    res.status(200).json(reimbursements);
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

    res.status(200).json(reimbursement);
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
};
