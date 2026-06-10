const prisma = require("../prisma/client");
const cloudinary = require("../config/cloudinary");
const { logActivity } = require("../services/activityLogService");

// Helper to stream upload Multer buffer to Cloudinary
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "reimbursements" },
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

    // Use Prisma transaction to create reimbursement and initial approval rows
    const reimbursement = await prisma.$transaction(async (tx) => {
      // Create reimbursement
      const r = await tx.reimbursement.create({
        data: {
          committee,
          event,
          amount: amountFloat,
          description,
          status: "PENDING",
          currentPriority: 1,
          userId: req.user.id,
        },
      });

      // Find administrators at priority 1
      const admins = await tx.administrator.findMany({
        where: { position: { priority: 1 } },
      });

      // Create approval stubs
      if (admins.length > 0) {
        await tx.reimbursementApproval.createMany({
          data: admins.map((admin) => ({
            reimbursementId: r.id,
            administratorId: admin.id,
            priority: 1,
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

module.exports = {
  createReimbursement,
  getMyReimbursements,
  getReimbursementDetails,
  cancelReimbursement,
  getActivityLog,
};
