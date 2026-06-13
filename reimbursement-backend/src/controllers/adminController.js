const prisma = require("../prisma/client");
const bcrypt = require("bcrypt");
const generatePassword = require("../utils/generatePassword");
const sendCredentialsEmail = require("../services/sendCredentialsEmail");

// ================= USER CRUD =================

async function createUser(req, res) {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    const existingAdmin = await prisma.administrator.findUnique({ where: { email } });

    if (existingUser || existingAdmin) {
      return res.status(400).json({ message: "Email already exists in system" });
    }

    const plainPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    // Send credentials email
    try {
      await sendCredentialsEmail(email, plainPassword);
    } catch (mailError) {
      console.warn(`Could not send credentials email to ${email}. Temp password: ${plainPassword}`);
    }

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function listUsers(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const take = limit;

    const users = await prisma.user.findMany({
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });
    res.status(200).json(users);
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    // Guard: reject deletion if the user has any associated reimbursements.
    // Without onDelete: Cascade in the schema, Prisma would throw an FK
    // constraint violation and return a cryptic 500.
    const reimbursementCount = await prisma.reimbursement.count({
      where: { userId: id },
    });

    if (reimbursementCount > 0) {
      return res.status(400).json({
        message: `Cannot delete user: they have ${reimbursementCount} existing reimbursement(s). Reassign or remove them first.`,
      });
    }

    await prisma.user.delete({ where: { id } });
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// ================= ADMINISTRATOR CRUD =================

async function createAdmin(req, res) {
  try {
    const { name, email, role, positionId } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ message: "Name, email, and role are required" });
    }

    if (role !== "SUPER_ADMIN" && role !== "ADMINISTRATOR") {
      return res.status(400).json({ message: "Invalid role specified" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    const existingAdmin = await prisma.administrator.findUnique({ where: { email } });

    if (existingUser || existingAdmin) {
      return res.status(400).json({ message: "Email already exists in system" });
    }

    // Verify position if standard administrator
    if (role === "ADMINISTRATOR" && !positionId) {
      return res.status(400).json({ message: "Position is required for administrators" });
    }

    const plainPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const admin = await prisma.administrator.create({
      data: {
        name,
        email,
        role,
        password: hashedPassword,
        positionId: role === "ADMINISTRATOR" ? positionId : null,
      },
      include: { position: true },
    });

    // Send credentials email
    try {
      await sendCredentialsEmail(email, plainPassword);
    } catch (mailError) {
      console.warn(`Could not send credentials email to admin ${email}. Temp password: ${plainPassword}`);
    }

    res.status(201).json({
      message: "Administrator created successfully",
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        position: admin.position,
      },
    });
  } catch (error) {
    console.error("Create admin error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function listAdmins(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const take = limit;

    const admins = await prisma.administrator.findMany({
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        position: true,
        createdAt: true,
      },
    });
    res.status(200).json(admins);
  } catch (error) {
    console.error("List admins error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function deleteAdmin(req, res) {
  try {
    const { id } = req.params;

    // Prevent self deletion
    if (id === req.admin.id) {
      return res.status(400).json({ message: "Cannot delete yourself" });
    }

    // Guard: reject deletion if the administrator has any approval records.
    // Without onDelete: Cascade in the schema, Prisma would throw an FK
    // constraint violation and return a cryptic 500.
    const approvalCount = await prisma.reimbursementApproval.count({
      where: { administratorId: id },
    });

    if (approvalCount > 0) {
      return res.status(400).json({
        message: `Cannot delete administrator: they have ${approvalCount} existing approval record(s). Remove those records first.`,
      });
    }

    await prisma.administrator.delete({ where: { id } });
    res.status(200).json({ message: "Administrator deleted successfully" });
  } catch (error) {
    console.error("Delete admin error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// ================= POSITION CRUD =================

async function createPosition(req, res) {
  try {
    const { name, priority } = req.body;

    if (!name || priority === undefined) {
      return res.status(400).json({ message: "Name and priority are required" });
    }

    const priorityInt = parseInt(priority, 10);
    if (isNaN(priorityInt)) {
      return res.status(400).json({ message: "Priority must be an integer" });
    }

    const existingPosition = await prisma.position.findUnique({ where: { name } });
    if (existingPosition) {
      return res.status(400).json({ message: "Position name already exists" });
    }

    const position = await prisma.position.create({
      data: {
        name,
        priority: priorityInt,
      },
    });

    res.status(201).json(position);
  } catch (error) {
    console.error("Create position error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function listPositions(req, res) {
  try {
    const positions = await prisma.position.findMany({
      orderBy: { priority: "asc" },
    });
    res.status(200).json(positions);
  } catch (error) {
    console.error("List positions error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function updatePosition(req, res) {
  try {
    const { id } = req.params;
    const { name, priority } = req.body;

    if (!name || priority === undefined) {
      return res.status(400).json({ message: "Name and priority are required" });
    }

    const priorityInt = parseInt(priority, 10);
    if (isNaN(priorityInt)) {
      return res.status(400).json({ message: "Priority must be an integer" });
    }

    // Fetch the current position so we can check if the priority is actually changing
    const existingPosition = await prisma.position.findUnique({ where: { id } });
    if (!existingPosition) {
      return res.status(404).json({ message: "Position not found" });
    }

    // Block a priority number change when active reimbursements sit at the old level.
    // Changing the priority value while claims point to it would leave those claims
    // stuck — their currentPriority would reference a priority level that no longer
    // exists, making them invisible to every admin.
    if (priorityInt !== existingPosition.priority) {
      const activeCount = await prisma.reimbursement.count({
        where: {
          currentPriority: existingPosition.priority,
          status: { in: ["PENDING", "QUERY_RAISED"] },
        },
      });

      if (activeCount > 0) {
        return res.status(400).json({
          message: `Cannot change priority: ${activeCount} active reimbursement(s) are currently at priority ${existingPosition.priority}. Resolve them first.`,
        });
      }
    }

    const position = await prisma.position.update({
      where: { id },
      data: {
        name,
        priority: priorityInt,
      },
    });

    res.status(200).json(position);
  } catch (error) {
    console.error("Update position error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function deletePosition(req, res) {
  try {
    const { id } = req.params;

    // Check if any administrator belongs to this position
    const adminsCount = await prisma.administrator.count({
      where: { positionId: id },
    });

    if (adminsCount > 0) {
      return res.status(400).json({
        message: "Cannot delete position. Some administrators are assigned to it.",
      });
    }

    // Also block deletion when active reimbursements are sitting at this priority.
    // If all admins are first reassigned away and then the position is deleted,
    // any in-flight claims whose currentPriority points here become permanently
    // stuck — visible to nobody and actionable by nobody.
    const position = await prisma.position.findUnique({ where: { id } });
    if (!position) {
      return res.status(404).json({ message: "Position not found" });
    }

    const activeCount = await prisma.reimbursement.count({
      where: {
        currentPriority: position.priority,
        status: { in: ["PENDING", "QUERY_RAISED"] },
      },
    });

    if (activeCount > 0) {
      return res.status(400).json({
        message: `Cannot delete position: ${activeCount} active reimbursement(s) are currently awaiting review at this priority level. Resolve them first.`,
      });
    }

    await prisma.position.delete({ where: { id } });
    res.status(200).json({ message: "Position deleted successfully" });
  } catch (error) {
    console.error("Delete position error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function listAllReimbursements(req, res) {
  try {
    // Optional filter: ?status=PENDING|APPROVED|REJECTED|QUERY_RAISED|CANCELLED
    const { status } = req.query;

    const VALID_STATUSES = ["PENDING", "APPROVED", "REJECTED", "QUERY_RAISED", "CANCELLED"];
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Invalid status filter value: ${status}` });
    }

    const where = status ? { status } : {};

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const take = limit;

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
        bills: {
          include: { bill: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Map bills[0].bill.receiptUrl to reimbursement.receiptUrl for frontend compatibility
    const formatReimbursement = (r) => {
      const firstBill = r.bills?.[0]?.bill;
      return {
        ...r,
        receiptUrl: firstBill ? firstBill.receiptUrl : null,
      };
    };

    res.status(200).json(reimbursements.map(formatReimbursement));
  } catch (error) {
    console.error("List all reimbursements error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = {
  createUser,
  listUsers,
  deleteUser,
  createAdmin,
  listAdmins,
  deleteAdmin,
  createPosition,
  listPositions,
  updatePosition,
  deletePosition,
  listAllReimbursements,
};