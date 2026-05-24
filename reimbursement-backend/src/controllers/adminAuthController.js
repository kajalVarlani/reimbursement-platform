const prisma = require("../prisma/client");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const transporter = require("../config/mailer");

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const admin = await prisma.administrator.findUnique({
      where: { email },
      include: { position: true },
    });

    if (!admin) {
      return res.status(404).json({
        message: "Administrator not found",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, admin.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      { id: admin.id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        position: admin.position,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const admin = await prisma.administrator.findUnique({
      where: { email },
    });

    if (!admin) {
      // Return 200 for security reasons (avoid email enumeration)
      return res.status(200).json({
        message: "If the email exists in our system, a reset link has been sent.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.administrator.update({
      where: { id: admin.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Send email with clickable reset link
    const resetLink = `${process.env.FRONTEND_URL}/admin/reset-password?token=${resetToken}`;
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: admin.email,
        subject: "Admin Password Reset Request",
        html: `
          <h2>Admin Password Reset Request</h2>
          <p>You requested a password reset. Click the button below to set a new password.</p>
          <p>
            <a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
              Reset Password
            </a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break:break-all;color:#6B7280;">${resetLink}</p>
          <p>This link is valid for <strong>1 hour</strong> and can only be used once.</p>
          <p style="color:#9CA3AF;font-size:12px;">If you did not request this, you can safely ignore this email.</p>
        `,
      });
    } catch (mailError) {
      console.warn("Mail dispatch failed. Reset link:", resetLink);
    }

    res.status(200).json({
      message: "If the email exists in our system, a reset link has been sent.",
    });
  } catch (error) {
    console.error("Admin forgotPassword error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        message: "Token and new password are required",
      });
    }

    const admin = await prisma.administrator.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
    });

    if (!admin) {
      return res.status(400).json({
        message: "Invalid or expired reset token",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.administrator.update({
      where: { id: admin.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.status(200).json({
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("Admin resetPassword error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = {
  login,
  forgotPassword,
  resetPassword,
};
