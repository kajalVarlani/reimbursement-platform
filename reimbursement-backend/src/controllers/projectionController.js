const prisma = require("../prisma/client");

/**
 * Treasurer sets or launches a 40-45 day Projection Cycle
 * Enforces single active cycle at a time.
 */
async function setProjectionWindow(req, res) {
  try {
    const {
      cycleName,
      targetMonth,
      startDate,
      endDate,
      durationDays = 45,
      deadline,
      bufferAmount = 100000.0,
      instructions,
    } = req.body;

    if (!deadline) {
      return res.status(400).json({ message: "Submission deadline is required" });
    }

    const parsedDeadline = new Date(deadline);
    if (isNaN(parsedDeadline.getTime())) {
      return res.status(400).json({ message: "Invalid deadline date format" });
    }

    const start = startDate ? new Date(startDate) : new Date();
    let end = endDate ? new Date(endDate) : null;
    if (!end) {
      end = new Date(start);
      end.setDate(end.getDate() + parseInt(durationDays || 45, 10));
    }

    // Default unique cycle key if not supplied
    const monthKey =
      targetMonth ||
      `CYCLE-${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${durationDays}D`;

    const name = cycleName || `Cycle ${start.toLocaleDateString("en-IN", { month: "short" })}-${end.toLocaleDateString("en-IN", { month: "short", year: "numeric" })} (${durationDays} Days)`;

    // Deactivate previous cycles to ensure only ONE active cycle at a time
    await prisma.projectionWindow.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    const window = await prisma.projectionWindow.upsert({
      where: { targetMonth: monthKey },
      update: {
        cycleName: name,
        startDate: start,
        endDate: end,
        durationDays: parseInt(durationDays || 45, 10),
        deadline: parsedDeadline,
        bufferAmount: parseFloat(bufferAmount) || 100000.0,
        instructions: instructions || null,
        isActive: true,
      },
      create: {
        cycleName: name,
        targetMonth: monthKey,
        startDate: start,
        endDate: end,
        durationDays: parseInt(durationDays || 45, 10),
        deadline: parsedDeadline,
        bufferAmount: parseFloat(bufferAmount) || 100000.0,
        usedBufferAmount: 0.0,
        instructions: instructions || null,
        isActive: true,
      },
    });

    res.status(200).json({
      message: `Projection cycle '${name}' activated successfully with deadline ${parsedDeadline.toLocaleString()}`,
      window,
    });
  } catch (error) {
    console.error("Set projection cycle error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * Get active projection cycle to display notification banner, countdown & buffer meter to C / DC & Admins
 */
async function getActiveWindow(req, res) {
  try {
    const now = new Date();
    const window = await prisma.projectionWindow.findFirst({
      where: { isActive: true },
      orderBy: { deadline: "desc" },
    });

    if (!window) {
      return res.status(200).json({ active: false });
    }

    const isExpired = new Date(window.deadline) < now;
    const remainingBuffer = Math.max(0, window.bufferAmount - window.usedBufferAmount);

    res.status(200).json({
      active: true,
      id: window.id,
      cycleName: window.cycleName || `Cycle (${window.durationDays || 45} Days)`,
      targetMonth: window.targetMonth,
      startDate: window.startDate,
      endDate: window.endDate,
      durationDays: window.durationDays || 45,
      deadline: window.deadline,
      bufferAmount: window.bufferAmount,
      usedBufferAmount: window.usedBufferAmount,
      remainingBuffer,
      instructions: window.instructions,
      isExpired,
    });
  } catch (error) {
    console.error("Get active cycle error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * Get logged-in user's club projection for active cycle
 */
async function getMyProjection(req, res) {
  try {
    const user = req.user;
    if (!user.clubName) {
      return res.status(200).json({ projection: null, message: "No club assigned to user" });
    }

    const activeCycle = await prisma.projectionWindow.findFirst({
      where: { isActive: true },
    });

    if (!activeCycle) {
      return res.status(200).json({ projection: null, activeCycle: null });
    }

    const projection = await prisma.monthlyProjection.findFirst({
      where: {
        clubName: user.clubName,
        OR: [
          { cycleId: activeCycle.id },
          { targetMonth: activeCycle.targetMonth },
        ],
      },
      include: {
        items: true,
      },
    });

    const remainingFastTrackQuota = projection
      ? Math.max(0, projection.totalEstimatedAmount - (projection.spentAmount || 0))
      : 0;

    res.status(200).json({
      projection,
      activeCycle,
      remainingFastTrackQuota,
    });
  } catch (error) {
    console.error("Get my projection error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * C / DC submits itemized expense projection
 * Enforces:
 * 1. Active cycle & deadline compliance
 * 2. Club overall budget compliance (sanctioned limit)
 * 3. FCFS atomic buffer check (Option A: all-or-nothing fallback to post-event manual flow)
 * 4. Automated approval without manual treasurer intervention
 */
async function submitProjection(req, res) {
  try {
    const user = req.user;
    const { targetMonth, items } = req.body;

    if (!user.clubName) {
      return res.status(403).json({ message: "Only users assigned to a club or committee can submit projections" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one planned event item is required" });
    }

    // 1. Fetch Active Cycle
    const activeCycle = await prisma.projectionWindow.findFirst({
      where: { isActive: true },
    });

    if (!activeCycle) {
      return res.status(400).json({
        message: "There is no active projection cycle currently open for submissions.",
      });
    }

    const cycleKey = targetMonth || activeCycle.targetMonth;

    if (new Date(activeCycle.deadline) < new Date()) {
      return res.status(400).json({
        message: `The deadline for submitting projections for ${activeCycle.cycleName || cycleKey} closed on ${new Date(activeCycle.deadline).toLocaleString()}`,
      });
    }

    // Validate items and calculate total
    let totalEstimated = 0;
    const validatedItems = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const amountFloat = parseFloat(item.expectedAmount);

      if (!item.eventName || !item.eventName.trim()) {
        return res.status(400).json({ message: `Item #${i + 1} must specify an event name` });
      }

      if (isNaN(amountFloat) || amountFloat <= 0) {
        return res.status(400).json({ message: `Item #${i + 1} must have an expected amount greater than 0` });
      }

      totalEstimated += amountFloat;
      validatedItems.push({
        eventName: item.eventName.trim(),
        expectedAmount: amountFloat,
        description: item.description ? item.description.trim() : null,
        tentativeDate: item.tentativeDate ? new Date(item.tentativeDate) : null,
      });
    }

    // 2. Club Sanctioned Budget Check
    const clubBudget = await prisma.clubBudget.findFirst({
      where: { clubName: user.clubName },
      orderBy: { createdAt: "desc" },
    });

    if (clubBudget && totalEstimated > clubBudget.allocatedAmount) {
      return res.status(400).json({
        message: `Requested projection (₹${totalEstimated.toLocaleString()}) exceeds your club's allocated budget ceiling of ₹${clubBudget.allocatedAmount.toLocaleString()}. Please adjust your planned estimates to stay within budget.`,
        allocatedBudget: clubBudget.allocatedAmount,
        requestedAmount: totalEstimated,
      });
    }

    // 3. FCFS Concurrency & Atomic Buffer Reservation with Automated Approval
    const result = await prisma.$transaction(async (tx) => {
      // Fetch fresh cycle status inside transaction
      const currentCycle = await tx.projectionWindow.findUnique({
        where: { id: activeCycle.id },
      });

      if (!currentCycle || !currentCycle.isActive) {
        throw new Error("Active projection cycle was closed or updated.");
      }

      // Existing projection for this club in this cycle
      const existing = await tx.monthlyProjection.findFirst({
        where: {
          clubName: user.clubName,
          OR: [{ cycleId: currentCycle.id }, { targetMonth: cycleKey }],
        },
      });

      const currentCommitted = existing ? existing.totalEstimatedAmount : 0;
      const additionalBufferNeeded = totalEstimated - currentCommitted;
      const availableBuffer = currentCycle.bufferAmount - currentCycle.usedBufferAmount;

      // Check if buffer capacity allows this advance projection (Option A: All-or-Nothing)
      if (additionalBufferNeeded > availableBuffer) {
        return {
          exhausted: true,
          remainingBuffer: Math.max(0, availableBuffer),
          message: `The advance buffer pool for this cycle has only ₹${Math.max(0, availableBuffer).toLocaleString()} remaining, which is insufficient for your ₹${totalEstimated.toLocaleString()} request. Advance funds are exhausted. Your event expenses cannot be secured in advance and must go through the Post-Event Manual Reimbursement process after bills are incurred.`,
        };
      }

      // Update usedBufferAmount atomically
      await tx.projectionWindow.update({
        where: { id: currentCycle.id },
        data: {
          usedBufferAmount: {
            increment: additionalBufferNeeded,
          },
        },
      });

      let projectionRecord;
      if (existing) {
        await tx.projectionItem.deleteMany({
          where: { projectionId: existing.id },
        });

        projectionRecord = await tx.monthlyProjection.update({
          where: { id: existing.id },
          data: {
            cycleId: currentCycle.id,
            targetMonth: cycleKey,
            totalEstimatedAmount: totalEstimated,
            status: "APPROVED",
            isAutoApproved: true,
            submittedById: user.id,
            items: {
              create: validatedItems,
            },
          },
          include: { items: true, submittedBy: { select: { name: true, email: true, designation: true } } },
        });
      } else {
        projectionRecord = await tx.monthlyProjection.create({
          data: {
            clubName: user.clubName,
            targetMonth: cycleKey,
            cycleId: currentCycle.id,
            totalEstimatedAmount: totalEstimated,
            status: "APPROVED",
            isAutoApproved: true,
            submittedById: user.id,
            items: {
              create: validatedItems,
            },
          },
          include: { items: true, submittedBy: { select: { name: true, email: true, designation: true } } },
        });
      }

      return {
        exhausted: false,
        projection: projectionRecord,
      };
    });

    if (result.exhausted) {
      return res.status(400).json({
        exhausted: true,
        remainingBuffer: result.remainingBuffer,
        message: result.message,
      });
    }

    res.status(201).json({
      success: true,
      autoApproved: true,
      message: `Projection for ${user.clubName} (₹${totalEstimated.toLocaleString()}) has met all compliance checks and is AUTOMATICALLY APPROVED! ₹${totalEstimated.toLocaleString()} is reserved under the cycle advance buffer.`,
      projection: result.projection,
    });
  } catch (error) {
    console.error("Submit projection error:", error);
    res.status(500).json({ message: error.message || "Internal Server Error" });
  }
}

/**
 * List projections for the active cycle or queried month (Treasurer view)
 */
async function listProjections(req, res) {
  try {
    const { cycleId, month } = req.query;

    let cycle;
    if (cycleId) {
      cycle = await prisma.projectionWindow.findUnique({ where: { id: cycleId } });
    } else {
      cycle = await prisma.projectionWindow.findFirst({
        where: month ? { targetMonth: month } : { isActive: true },
        orderBy: { createdAt: "desc" },
      });
    }

    const whereClause = cycle
      ? { OR: [{ cycleId: cycle.id }, { targetMonth: cycle.targetMonth }] }
      : month
      ? { targetMonth: month }
      : {};

    const projections = await prisma.monthlyProjection.findMany({
      where: whereClause,
      include: {
        items: true,
        submittedBy: {
          select: { id: true, name: true, email: true, designation: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const totalProjectedAmount = projections.reduce((acc, p) => acc + p.totalEstimatedAmount, 0);

    res.status(200).json({
      cycle,
      totalProjectedAmount,
      bufferAmount: cycle ? cycle.bufferAmount : 0,
      usedBufferAmount: cycle ? cycle.usedBufferAmount : 0,
      remainingBuffer: cycle ? Math.max(0, cycle.bufferAmount - cycle.usedBufferAmount) : 0,
      projections,
    });
  } catch (error) {
    console.error("List projections error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = {
  setProjectionWindow,
  getActiveWindow,
  getMyProjection,
  submitProjection,
  listProjections,
};
