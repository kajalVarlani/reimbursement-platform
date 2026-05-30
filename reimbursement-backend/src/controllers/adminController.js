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
    const users = await prisma.user.findMany({
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
    const admins = await prisma.administrator.findMany({
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

    await prisma.position.delete({ where: { id } });
    res.status(200).json({ message: "Position deleted successfully" });
  } catch (error) {
    console.error("Delete position error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function listAllReimbursements(req, res) {
  try {
    const { status } = req.query; // optional filter: ?status=PENDING|APPROVED|REJECTED|QUERY_RAISED

    const where = status ? { status } : {};

    const reimbursements = await prisma.reimbursement.findMany({
      where,
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
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(reimbursements);
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