const prisma = require("../prisma/client");
const transporter = require("../config/mailer");

async function getVisibleReimbursements(req, res) {
  try {
    const admin = req.admin;

    // Check if the administrator is assigned a position and priority
    if (!admin.position) {
      return res.status(403).json({
        message: "Access forbidden: You must be assigned a position with a priority to review claims",
      });
    }

    const priority = admin.position.priority;

    // Fetch reimbursements at the administrator's priority level (PENDING or QUERY_RAISED)
    const reimbursements = await prisma.reimbursement.findMany({
      where: {
        status: { in: ["PENDING", "QUERY_RAISED"] },
        currentPriority: priority,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        approvals: {
          include: {
            administrator: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(reimbursements);
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

    // Fetch reimbursement
    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id },
    });

    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (reimbursement.status !== "PENDING" && reimbursement.status !== "QUERY_RAISED") {
      return res.status(400).json({
        message: `Reimbursement is already in ${reimbursement.status} status`,
      });
    }

    if (reimbursement.currentPriority !== currentPriority) {
      return res.status(403).json({
        message: "Forbidden: You cannot act on this reimbursement at the current workflow priority stage",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Find or create the ReimbursementApproval record for this admin
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
          data: {
            status: "APPROVED",
            remark,
            actedAt: new Date(),
          },
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

      // 2. Check if all administrators at the current priority have approved
      const allAdminsAtLevel = await tx.administrator.findMany({
        where: {
          position: {
            priority: currentPriority,
          },
        },
      });

      const approvedAtLevel = await tx.reimbursementApproval.findMany({
        where: {
          reimbursementId: id,
          priority: currentPriority,
          status: "APPROVED",
        },
      });

      // Map to set of administrator IDs who approved
      const approvedAdminIds = new Set(approvedAtLevel.map((a) => a.administratorId));
      const allApproved = allAdminsAtLevel.every((adm) => approvedAdminIds.has(adm.id));

      if (allApproved) {
        // Find next priority level
        const nextPosition = await tx.position.findFirst({
          where: {
            priority: {
              gt: currentPriority,
            },
          },
          orderBy: {
            priority: "asc",
          },
        });

        if (nextPosition) {
          // Advance priority level
          const updatedReimbursement = await tx.reimbursement.update({
            where: { id },
            data: {
              currentPriority: nextPosition.priority,
            },
          });

          // Create pending approval records for the next level administrators
          const nextAdmins = await tx.administrator.findMany({
            where: {
              position: {
                priority: nextPosition.priority,
              },
            },
          });

          if (nextAdmins.length > 0) {
            await tx.reimbursementApproval.createMany({
              data: nextAdmins.map((na) => ({
                reimbursementId: id,
                administratorId: na.id,
                priority: nextPosition.priority,
                status: "PENDING",
              })),
            });
          }

          return { status: "ADVANCED", nextPriority: nextPosition.priority, reimbursement: updatedReimbursement };
        } else {
          // No higher priority level: mark as fully APPROVED
          const updatedReimbursement = await tx.reimbursement.update({
            where: { id },
            data: {
              status: "APPROVED",
            },
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

    // Fetch reimbursement
    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id },
    });

    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (reimbursement.status !== "PENDING" && reimbursement.status !== "QUERY_RAISED") {
      return res.status(400).json({
        message: `Reimbursement is already in ${reimbursement.status} status`,
      });
    }

    if (reimbursement.currentPriority !== currentPriority) {
      return res.status(403).json({
        message: "Forbidden: You cannot act on this reimbursement at the current workflow priority stage",
      });
    }

    const updatedReimbursement = await prisma.$transaction(async (tx) => {
      // 1. Find or create the ReimbursementApproval record and set to REJECTED
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
          data: {
            status: "REJECTED",
            remark,
            actedAt: new Date(),
          },
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

      // 2. Set overall reimbursement status to REJECTED
      return await tx.reimbursement.update({
        where: { id },
        data: {
          status: "REJECTED",
        },
      });
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

    // Fetch reimbursement with submitting user details
    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (reimbursement.status !== "PENDING") {
      return res.status(400).json({
        message: `Cannot raise a query on a reimbursement that is in ${reimbursement.status} status`,
      });
    }

    if (reimbursement.currentPriority !== currentPriority) {
      return res.status(403).json({
        message: "Forbidden: You cannot act on this reimbursement at the current workflow priority stage",
      });
    }

    // Transactionally update approval record and reimbursement status
    const updatedReimbursement = await prisma.$transaction(async (tx) => {
      // Find or create the approval record for this admin
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
          data: {
            status: "QUERY_RAISED",
            remark: remark.trim(),
            actedAt: new Date(),
          },
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

      // Set overall reimbursement status to QUERY_RAISED
      return await tx.reimbursement.update({
        where: { id },
        data: { status: "QUERY_RAISED" },
      });
    });

    // Send email to the submitting user with the concern
    const userEmail = reimbursement.user.email;
    const userName = reimbursement.user.name;
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

    // Fetch all approval records this admin has acted on (non-PENDING)
    const approvals = await prisma.reimbursementApproval.findMany({
      where: {
        administratorId: admin.id,
        status: { not: "PENDING" },
      },
      include: {
        reimbursement: {
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
              orderBy: { priority: "asc" },
            },
          },
        },
      },
      orderBy: { actedAt: "desc" },
    });

    res.status(200).json(approvals);
  } catch (error) {
    console.error("Get approval history error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = {
  getVisibleReimbursements,
  approveReimbursement,
  rejectReimbursement,
  raiseQuery,
  getApprovalHistory,
};
