const prisma = require("../prisma/client");
const cloudinary = require("../config/cloudinary");
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

    if (!req.file) {
      return res.status(400).json({
        message: "Receipt scanned file is required",
      });
    }

    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat)) {
      return res.status(400).json({
        message: "Amount must be a number",
      });
    }

    // Upload to Cloudinary
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
      // Create reimbursement
      const r = await tx.reimbursement.create({
        data: {
          committee,
          event,
          amount: amountFloat,
          description,
          receiptUrl,
          status: "PENDING",
          currentPriority: 1,
          userId: req.user.id,
        },
      });

      // Find administrators at priority 1
      const admins = await tx.administrator.findMany({
        where: {
          position: {
            priority: 1,
          },
        },
      });

      // Create approvals
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
                position: true,
              },
            },
          },
          orderBy: { priority: "asc" },
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

module.exports = {
  createReimbursement,
  getMyReimbursements,
  getReimbursementDetails,
};
