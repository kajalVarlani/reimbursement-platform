const prisma = require("../prisma/client");

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

    // Fetch reimbursements at the administrator's priority level
    const reimbursements = await prisma.reimbursement.findMany({
      where: {
        status: "PENDING",
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

    if (reimbursement.status !== "PENDING") {
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

    if (reimbursement.status !== "PENDING") {
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

module.exports = {
  getVisibleReimbursements,
  approveReimbursement,
  rejectReimbursement,
};
