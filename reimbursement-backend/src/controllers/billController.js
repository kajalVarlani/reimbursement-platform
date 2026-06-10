/**
 * billController.js
 *
 * Handles bill creation, attachment to reimbursements, and detachment.
 * Bills are uploaded to Cloudinary; a uniqueIdentifier prevents duplicates.
 */

const prisma = require("../prisma/client");
const cloudinary = require("../config/cloudinary");
const { logActivity } = require("../services/activityLogService");

// ─── Cloudinary upload helper ─────────────────────────────────────────────────

const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "bills" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.write(fileBuffer);
    stream.end();
  });
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a uniqueIdentifier from bill metadata.
 * Falls back to transactionId if provided.
 */
function buildUniqueIdentifier({ vendorName, invoiceNumber, billDate, amount, transactionId }) {
  if (transactionId) return `txn:${transactionId.trim()}`;
  const parts = [
    (vendorName || "").trim().toLowerCase(),
    (invoiceNumber || "").trim().toLowerCase(),
    billDate ? new Date(billDate).toISOString().slice(0, 10) : "",
    String(amount),
  ];
  return `inv:${parts.join("|")}`;
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/user/reimbursements/:id/bills
 *
 * Upload a receipt, create (or reuse) a Bill record, attach it to the
 * reimbursement with an allocated amount, and log the activity.
 *
 * Body (multipart/form-data):
 *   receipt          - file (required)
 *   allocatedAmount  - number (required)
 *   amount           - total bill amount (required)
 *   vendorName       - string (optional)
 *   invoiceNumber    - string (optional)
 *   transactionId    - string (optional)
 *   billDate         - ISO date string (optional)
 */
async function attachBill(req, res) {
  try {
    const { id: reimbursementId } = req.params;
    const {
      allocatedAmount,
      amount,
      vendorName,
      invoiceNumber,
      transactionId,
      billDate,
    } = req.body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!allocatedAmount || !amount) {
      return res.status(400).json({
        message: "allocatedAmount and amount are required",
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Receipt file is required" });
    }

    const amountFloat = parseFloat(amount);
    const allocatedFloat = parseFloat(allocatedAmount);

    if (isNaN(amountFloat) || isNaN(allocatedFloat)) {
      return res.status(400).json({ message: "amount and allocatedAmount must be numbers" });
    }

    if (allocatedFloat > amountFloat) {
      return res.status(400).json({
        message: "allocatedAmount cannot exceed the total bill amount",
      });
    }

    // ── Ownership check ───────────────────────────────────────────────────────
    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id: reimbursementId },
    });

    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (reimbursement.userId !== req.user.id) {
      return res.status(403).json({
        message: "Forbidden: You can only attach bills to your own reimbursements",
      });
    }

    if (!["PENDING", "QUERY_RAISED"].includes(reimbursement.status)) {
      return res.status(400).json({
        message: `Cannot attach bills to a reimbursement in ${reimbursement.status} status`,
      });
    }

    // ── Upload receipt to Cloudinary ──────────────────────────────────────────
    let receiptUrl;
    if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_CLOUD_NAME) {
      console.warn("Cloudinary not configured. Using fallback mock receipt URL.");
      receiptUrl = "https://res.cloudinary.com/demo/image/upload/v1580976523/sample.jpg";
    } else {
      const uploadResult = await uploadToCloudinary(req.file.buffer);
      receiptUrl = uploadResult.secure_url;
    }

    const uniqueIdentifier = buildUniqueIdentifier({
      vendorName,
      invoiceNumber,
      billDate,
      amount: amountFloat,
      transactionId,
    });

    // ── Upsert Bill + attach to Reimbursement ─────────────────────────────────
    const reimbursementBill = await prisma.$transaction(async (tx) => {
      // Find existing bill or create new
      let bill = await tx.bill.findUnique({ where: { uniqueIdentifier } });

      if (!bill) {
        bill = await tx.bill.create({
          data: {
            vendorName: vendorName || null,
            invoiceNumber: invoiceNumber || null,
            transactionId: transactionId || null,
            billDate: billDate ? new Date(billDate) : null,
            amount: amountFloat,
            receiptUrl,
            uniqueIdentifier,
          },
        });
      }

      // Check if already attached
      const existing = await tx.reimbursementBill.findUnique({
        where: {
          reimbursementId_billId: {
            reimbursementId,
            billId: bill.id,
          },
        },
      });

      if (existing) {
        throw Object.assign(new Error("This bill is already attached to this reimbursement"), {
          statusCode: 409,
        });
      }

      const rb = await tx.reimbursementBill.create({
        data: {
          reimbursementId,
          billId: bill.id,
          allocatedAmount: allocatedFloat,
        },
        include: { bill: true },
      });

      await logActivity(
        {
          reimbursementId,
          action: "BILL_ATTACHED",
          activity: `Bill attached: ${bill.vendorName || bill.invoiceNumber || bill.id} — ₹${allocatedFloat.toFixed(2)} allocated`,
          actorType: "USER",
          userId: req.user.id,
          actorRole: "USER",
        },
        tx
      );

      return rb;
    });

    res.status(201).json({
      message: "Bill attached successfully",
      reimbursementBill,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Attach bill error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * DELETE /api/user/reimbursements/:id/bills/:billId
 *
 * Detach a bill from a reimbursement (does NOT delete the Bill record itself).
 */
async function detachBill(req, res) {
  try {
    const { id: reimbursementId, billId } = req.params;

    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id: reimbursementId },
    });

    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (reimbursement.userId !== req.user.id) {
      return res.status(403).json({
        message: "Forbidden: You can only detach bills from your own reimbursements",
      });
    }

    if (!["PENDING", "QUERY_RAISED"].includes(reimbursement.status)) {
      return res.status(400).json({
        message: `Cannot detach bills from a reimbursement in ${reimbursement.status} status`,
      });
    }

    const link = await prisma.reimbursementBill.findUnique({
      where: {
        reimbursementId_billId: { reimbursementId, billId },
      },
      include: { bill: true },
    });

    if (!link) {
      return res.status(404).json({ message: "Bill is not attached to this reimbursement" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.reimbursementBill.delete({
        where: {
          reimbursementId_billId: { reimbursementId, billId },
        },
      });

      await logActivity(
        {
          reimbursementId,
          action: "BILL_DETACHED",
          activity: `Bill detached: ${link.bill.vendorName || link.bill.invoiceNumber || billId}`,
          actorType: "USER",
          userId: req.user.id,
          actorRole: "USER",
        },
        tx
      );
    });

    res.status(200).json({ message: "Bill detached successfully" });
  } catch (error) {
    console.error("Detach bill error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

/**
 * GET /api/user/reimbursements/:id/bills
 *
 * List all bills attached to a reimbursement (owner only).
 */
async function getBills(req, res) {
  try {
    const { id: reimbursementId } = req.params;

    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id: reimbursementId },
      select: { userId: true },
    });

    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (reimbursement.userId !== req.user.id) {
      return res.status(403).json({
        message: "Forbidden: You can only view bills for your own reimbursements",
      });
    }

    const bills = await prisma.reimbursementBill.findMany({
      where: { reimbursementId },
      include: { bill: true },
      orderBy: { createdAt: "asc" },
    });

    res.status(200).json(bills);
  } catch (error) {
    console.error("Get bills error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = { attachBill, detachBill, getBills };
