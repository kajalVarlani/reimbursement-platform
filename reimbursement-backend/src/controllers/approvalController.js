const prisma = require("../prisma/client");
const transporter = require("../config/mailer");
const { logActivity } = require("../services/activityLogService");

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Returns the human-readable role string for an admin actor. */
function adminActorRole(admin) {
  if (admin.role === "SUPER_ADMIN") return "SUPER_ADMIN";
  return admin.position ? admin.position.name : "ADMINISTRATOR";
}

// ─── Controllers ──────────────────────────────────────────────────────────────

async function getVisibleReimbursements(req, res) {
  try {
    const admin = req.admin;
    const { status, page, limit } = req.query;

    const pageInt = parseInt(page, 10) || 1;
    const limitInt = parseInt(limit, 10) || 20;
    const skip = (pageInt - 1) * limitInt;
    const take = limitInt;

    // Super Admin gets global audit access (all reimbursements)
    if (admin.role === "SUPER_ADMIN") {
      const VALID_STATUSES = ["PENDING", "APPROVED", "REJECTED", "QUERY_RAISED", "CANCELLED"];
      if (status && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ message: `Invalid status filter value: ${status}` });
      }

      const where = status ? { status } : {};
      const reimbursements = await prisma.reimbursement.findMany({
        where,
        skip,
        take,
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

      return res.status(200).json(reimbursements.map(formatReimbursement));
    }

    // Check if the administrator is assigned a position and priority
    if (!admin.position) {
      return res.status(403).json({
        message: "Access forbidden: You must be assigned a position with a priority to review claims",
      });
    }

    const priority = admin.position.priority;

    const reimbursements = await prisma.reimbursement.findMany({
      where: {
        status: { in: ["PENDING", "QUERY_RAISED"] },
        currentPriority: priority,
      },
      skip,
      take,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        approvals: {
          include: {
            administrator: {
              select: { id: true, name: true, email: true },
            },
          },
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

    res.status(200).json(reimbursements.map(formatReimbursement));
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

    if (!admin.position) {
      return res.status(403).json({
        message: "Access forbidden: You must be assigned a position with a priority to review claims",
      });
    }

    const currentPriority = admin.position.priority;

    const reimbursement = await prisma.reimbursement.findUnique({ where: { id } });

    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (reimbursement.status !== "PENDING") {
      return res.status(400).json({
        message: `Reimbursement is already in ${reimbursement.status} status. It must be PENDING to be approved.`,
      });
    }

    if (reimbursement.currentPriority !== currentPriority) {
      return res.status(403).json({
        message: "Forbidden: You cannot act on this reimbursement at the current workflow priority stage",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Upsert the ReimbursementApproval record for this admin
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
          data: { status: "APPROVED", remark, actedAt: new Date() },
        });
      } else {
        await tx.reimbursementApproval.create({
          data: {
            reimbursementId: id,
            administratorId: admin.id,
            priority: currentPriority,
            status: "APPROVED",
            remark,
            actedAt: new Date(),
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

      // 3. Check if all administrators at current priority have approved
      const allAdminsAtLevel = await tx.administrator.findMany({
        where: { position: { priority: currentPriority } },
      });

      const approvedAtLevel = await tx.reimbursementApproval.findMany({
        where: { reimbursementId: id, priority: currentPriority, status: "APPROVED" },
      });

      const approvedAdminIds = new Set(approvedAtLevel.map((a) => a.administratorId));
      const allApproved = allAdminsAtLevel.every((adm) => approvedAdminIds.has(adm.id));

      if (allApproved) {
        const nextPosition = await tx.position.findFirst({
          where: { priority: { gt: currentPriority } },
          orderBy: { priority: "asc" },
        });

        if (nextPosition) {
          const updatedReimbursement = await tx.reimbursement.update({
            where: { id },
            data: { currentPriority: nextPosition.priority },
          });

          const nextAdmins = await tx.administrator.findMany({
            where: { position: { priority: nextPosition.priority } },
          });

          if (nextAdmins.length > 0) {
            await tx.reimbursementApproval.createMany({
              data: nextAdmins.map((na) => ({
                reimbursementId: id,
                administratorId: na.id,
                priority: nextPosition.priority,
                status: "PENDING",
              })),
              // Guard against the race condition where two admins at the same
              // level approve simultaneously: both may independently conclude
              // "all approved" and attempt to insert identical stubs for the
              // next level. skipDuplicates prevents a crash / ghost records.
              skipDuplicates: true,
            });
          }

          return { status: "ADVANCED", nextPriority: nextPosition.priority, reimbursement: updatedReimbursement };
        } else {
          const updatedReimbursement = await tx.reimbursement.update({
            where: { id },
            data: { status: "APPROVED" },
          });

          return { status: "APPROVED", reimbursement: updatedReimbursement };
        }
      }

      return { status: "PENDING_OTHERS" };
    });

    res.status(200).json({
      message:
        result.status === "ADVANCED"
          ? `Reimbursement approved at level ${currentPriority} and advanced to level ${result.nextPriority}`
          : result.status === "APPROVED"
          ? "Reimbursement fully approved!"
          : "Reimbursement approved. Waiting for other administrators at this level.",
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

    if (!admin.position) {
      return res.status(403).json({
        message: "Access forbidden: You must be assigned a position with a priority to review claims",
      });
    }

    const currentPriority = admin.position.priority;

    const reimbursement = await prisma.reimbursement.findUnique({ where: { id } });

    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (reimbursement.status !== "PENDING") {
      return res.status(400).json({
        message: `Reimbursement is already in ${reimbursement.status} status. It must be PENDING to be rejected.`,
      });
    }

    if (reimbursement.currentPriority !== currentPriority) {
      return res.status(403).json({
        message: "Forbidden: You cannot act on this reimbursement at the current workflow priority stage",
      });
    }

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

    if (!admin.position) {
      return res.status(403).json({
        message: "Access forbidden: You must be assigned a position with a priority to review claims",
      });
    }

    if (!remark || remark.trim() === "") {
      return res.status(400).json({
        message: "A remark explaining the query/concern is required",
      });
    }

    const currentPriority = admin.position.priority;

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

    if (reimbursement.currentPriority !== currentPriority) {
      return res.status(403).json({
        message: "Forbidden: You cannot act on this reimbursement at the current workflow priority stage",
      });
    }

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

    if (admin.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        message: "Forbidden: Only Super Admins can mark reimbursements as paid",
      });
    }

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

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.reimbursement.update({
        where: { id },
        data: { isPaid: true, paidAt: new Date() },
      });

      await logActivity(
        {
          reimbursementId: id,
          action: "PAYMENT_MARKED",
          activity: "Reimbursement marked as paid",
          actorType: "ADMINISTRATOR",
          administratorId: admin.id,
          actorRole: "SUPER_ADMIN",
        },
        tx
      );

      return r;
    });

    // Re-fetch with the user relation so we can send the confirmation email
    const reimbursementWithUser = await prisma.reimbursement.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true } } },
    });

    // Notify the submitting user that their payment is on the way.
    // This runs outside the transaction: a mail failure must never roll back
    // the payment mark that was already committed.
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
            <p>Great news! Your reimbursement request has been fully approved and payment has now been processed.</p>

            <table style="border-collapse:collapse;width:100%;margin:16px 0;">
              <tr><td style="padding:8px;font-weight:bold;background:#f3f4f6;">Event</td><td style="padding:8px;">${reimbursementWithUser.event}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;background:#f3f4f6;">Committee</td><td style="padding:8px;">${reimbursementWithUser.committee}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;background:#f3f4f6;">Amount</td><td style="padding:8px;">₹${reimbursementWithUser.amount.toFixed(2)}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;background:#f3f4f6;">Paid On</td><td style="padding:8px;">${new Date(updated.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</td></tr>
            </table>

            <div style="background:#d1fae5;border-left:4px solid #10b981;padding:12px 16px;margin:16px 0;">
              <p style="margin:0;font-weight:bold;">Payment confirmed ✅</p>
              <p style="margin:8px 0 0;">The amount of ₹${reimbursementWithUser.amount.toFixed(2)} has been marked as disbursed. Please allow a short processing window for the funds to reflect in your account.</p>
            </div>

            <p>If you have any questions, please reach out to the finance team.</p>
            <p style="color:#9CA3AF;font-size:12px;">This is an automated notification from the Reimbursement Platform.</p>
          `,
        });
      } catch (mailError) {
        console.warn(`Could not send payment confirmation email to ${userEmail}:`, mailError.message);
      }
    }

    res.status(200).json({
      message: "Reimbursement marked as paid",
      reimbursement: updated,
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
