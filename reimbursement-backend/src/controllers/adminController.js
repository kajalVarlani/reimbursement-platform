const prisma = require("../prisma/client");
const bcrypt = require("bcrypt");
const generatePassword = require("../utils/generatePassword");
const sendCredentialsEmail = require("../services/sendCredentialsEmail");

// ================= USER CRUD =================

async function createUser(req, res) {
  try {
    const { name, email, designation, clubName } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }

    if (designation && !["CONVENOR", "DEPUTY_CONVENOR"].includes(designation)) {
      return res.status(400).json({ message: "Designation must be CONVENOR or DEPUTY_CONVENOR" });
    }

    // Enforce 1 Convenor and 1 Deputy Convenor per Club
    if (clubName && designation) {
      const existingDesignee = await prisma.user.findFirst({
        where: {
          clubName: clubName.trim(),
          designation,
        },
      });

      if (existingDesignee) {
        return res.status(400).json({
          message: `${clubName.trim()} already has a ${
            designation === "CONVENOR" ? "Convenor" : "Deputy Convenor"
          } (${existingDesignee.name} - ${existingDesignee.email}). Each club can have at most 1 Convenor and 1 Deputy Convenor.`,
        });
      }
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
        designation: designation || null,
        clubName: clubName ? clubName.trim() : null,
      },
    });

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        designation: user.designation,
        clubName: user.clubName,
      },
    });

    process.nextTick(() => {
      sendCredentialsEmail(email, plainPassword).catch((mailError) => {
        console.warn(`Could not send credentials email to ${email}. Temp password: ${plainPassword}`);
      });
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function listUsers(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
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
        designation: true,
        clubName: true,
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

    const VALID_ROLES = ["SUPER_ADMIN", "FACULTY_MENTOR", "DEAN_STUDENTS", "ACCOUNTANT", "ADMINISTRATOR"];
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: `Invalid role specified. Must be one of: ${VALID_ROLES.join(", ")}` });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    const existingAdmin = await prisma.administrator.findUnique({ where: { email } });

    if (existingUser || existingAdmin) {
      return res.status(400).json({ message: "Email already exists in system" });
    }

    // Verify position if standard administrator with position
    if (role === "ADMINISTRATOR" && positionId) {
      const pos = await prisma.position.findUnique({ where: { id: positionId } });
      if (!pos) {
        return res.status(400).json({ message: "Specified position does not exist" });
      }
    }

    const plainPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const admin = await prisma.administrator.create({
      data: {
        name,
        email,
        role,
        password: hashedPassword,
        positionId: positionId || null,
      },
      include: { position: true },
    });

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

    process.nextTick(() => {
      sendCredentialsEmail(email, plainPassword).catch((mailError) => {
        console.warn(`Could not send credentials email to admin ${email}. Temp password: ${plainPassword}`);
      });
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

// ================= CLUB-MENTOR MAPPINGS =================

async function listClubMappings(req, res) {
  try {
    const mappings = await prisma.clubMentorMapping.findMany({
      include: {
        facultyMentor: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { clubName: "asc" },
    });
    res.status(200).json(mappings);
  } catch (error) {
    console.error("List club mappings error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function upsertClubMapping(req, res) {
  try {
    const { clubName, facultyMentorId } = req.body;

    if (!clubName || !facultyMentorId) {
      return res.status(400).json({ message: "Club name and faculty mentor are required" });
    }

    const mentor = await prisma.administrator.findUnique({
      where: { id: facultyMentorId },
    });

    if (!mentor) {
      return res.status(404).json({ message: "Selected faculty mentor does not exist" });
    }

    const mapping = await prisma.clubMentorMapping.upsert({
      where: { clubName: clubName.trim() },
      update: { facultyMentorId },
      create: { clubName: clubName.trim(), facultyMentorId },
      include: {
        facultyMentor: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    res.status(200).json({
      message: `Faculty mentor successfully mapped to ${clubName}`,
      mapping,
    });
  } catch (error) {
    console.error("Upsert club mapping error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function deleteClubMapping(req, res) {
  try {
    const { id } = req.params;
    await prisma.clubMentorMapping.delete({ where: { id } });
    res.status(200).json({ message: "Club mentor mapping deleted successfully" });
  } catch (error) {
    console.error("Delete club mapping error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function listFacultyMentors(req, res) {
  try {
    const mentors = await prisma.administrator.findMany({
      where: {
        role: { in: ["FACULTY_MENTOR", "ADMINISTRATOR"] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });
    res.status(200).json(mentors);
  } catch (error) {
    console.error("List faculty mentors error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// ================= TREASURER ADVANCE BUFFER =================

async function getBufferStatus(req, res) {
  try {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Get buffer or initialize default ₹50,000 for current month
    let buffer = await prisma.treasurerBuffer.findFirst({
      orderBy: { updatedAt: "desc" },
      include: {
        transactions: {
          take: 30,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!buffer) {
      buffer = await prisma.treasurerBuffer.create({
        data: {
          monthlyAdvance: 50000.0,
          currentBalance: 50000.0,
          currentMonth,
          transactions: {
            create: {
              type: "MONTHLY_REPLENISHMENT",
              amount: 50000.0,
              balanceAfter: 50000.0,
              notes: `Initial monthly advance buffer for ${currentMonth}`,
            },
          },
        },
        include: {
          transactions: {
            take: 30,
            orderBy: { createdAt: "desc" },
          },
        },
      });
    }

    res.status(200).json(buffer);
  } catch (error) {
    console.error("Get buffer status error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function replenishBuffer(req, res) {
  try {
    const { amount, month, notes } = req.body;
    const advanceAmount = parseFloat(amount) || 50000.0;
    const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    let buffer = await prisma.treasurerBuffer.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    const result = await prisma.$transaction(async (tx) => {
      let b;
      if (!buffer) {
        b = await tx.treasurerBuffer.create({
          data: {
            monthlyAdvance: advanceAmount,
            currentBalance: advanceAmount,
            currentMonth: targetMonth,
          },
        });
      } else {
        b = await tx.treasurerBuffer.update({
          where: { id: buffer.id },
          data: {
            monthlyAdvance: advanceAmount,
            currentBalance: advanceAmount, // Reset for new month replenishment
            currentMonth: targetMonth,
          },
        });
      }

      await tx.bufferTransaction.create({
        data: {
          bufferId: b.id,
          type: "MONTHLY_REPLENISHMENT",
          amount: advanceAmount,
          balanceAfter: advanceAmount,
          notes: notes || `Monthly buffer replenished for ${targetMonth}`,
        },
      });

      return b;
    });

    res.status(200).json({
      message: `Treasurer advance buffer replenished to ₹${advanceAmount.toLocaleString()} for ${targetMonth}`,
      buffer: result,
    });
  } catch (error) {
    console.error("Replenish buffer error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function topUpBuffer(req, res) {
  try {
    const { amount, notes } = req.body;
    const topUpAmount = parseFloat(amount);

    if (isNaN(topUpAmount) || topUpAmount <= 0) {
      return res.status(400).json({ message: "Valid positive top-up amount is required" });
    }

    let buffer = await prisma.treasurerBuffer.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    if (!buffer) {
      return res.status(404).json({ message: "Buffer not initialized yet" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const newBalance = buffer.currentBalance + topUpAmount;
      const b = await tx.treasurerBuffer.update({
        where: { id: buffer.id },
        data: {
          currentBalance: newBalance,
        },
      });

      await tx.bufferTransaction.create({
        data: {
          bufferId: b.id,
          type: "TOP_UP",
          amount: topUpAmount,
          balanceAfter: newBalance,
          notes: notes || `Buffer top-up of ₹${topUpAmount.toLocaleString()}`,
        },
      });

      return b;
    });

    res.status(200).json({
      message: `Buffer topped up by ₹${topUpAmount.toLocaleString()}. New balance: ₹${updated.currentBalance.toLocaleString()}`,
      buffer: updated,
    });
  } catch (error) {
    console.error("Top up buffer error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// ================= CLUB BUDGET MANAGEMENT =================

/**
 * GET /api/admin/club-budgets?month=YYYY-MM
 * List all club budgets for a given month (Treasurer view).
 */
async function getClubBudgets(req, res) {
  try {
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const targetMonth = req.query.month || defaultMonth;

    const budgets = await prisma.clubBudget.findMany({
      where: { targetMonth },
      orderBy: { clubName: "asc" },
    });

    res.status(200).json({ targetMonth, budgets });
  } catch (error) {
    console.error("Get club budgets error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * POST /api/admin/club-budgets
 * Create or update a club's budget allocation for a given month.
 * Body: { clubName, targetMonth, allocatedAmount, notes? }
 */
async function upsertClubBudget(req, res) {
  try {
    const { clubName, targetMonth, allocatedAmount, notes } = req.body;

    if (!clubName || !targetMonth || allocatedAmount === undefined) {
      return res.status(400).json({ message: "clubName, targetMonth, and allocatedAmount are required" });
    }

    const amount = parseFloat(allocatedAmount);
    if (isNaN(amount) || amount < 0) {
      return res.status(400).json({ message: "allocatedAmount must be a non-negative number" });
    }

    const budget = await prisma.clubBudget.upsert({
      where: { clubName_targetMonth: { clubName: clubName.trim(), targetMonth } },
      update: { allocatedAmount: amount, notes: notes || null },
      create: {
        clubName: clubName.trim(),
        targetMonth,
        allocatedAmount: amount,
        spentAmount: 0,
        notes: notes || null,
      },
    });

    res.status(200).json({
      message: `Budget of ₹${amount.toLocaleString()} set for ${clubName.trim()} — ${targetMonth}`,
      budget,
    });
  } catch (error) {
    console.error("Upsert club budget error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * DELETE /api/admin/club-budgets/:id
 * Remove a club budget entry.
 */
async function deleteClubBudget(req, res) {
  try {
    const { id } = req.params;
    await prisma.clubBudget.delete({ where: { id } });
    res.status(200).json({ message: "Club budget entry deleted" });
  } catch (error) {
    console.error("Delete club budget error:", error);
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
  listClubMappings,
  upsertClubMapping,
  deleteClubMapping,
  listFacultyMentors,
  getBufferStatus,
  replenishBuffer,
  topUpBuffer,
  getClubBudgets,
  upsertClubBudget,
  deleteClubBudget,
};