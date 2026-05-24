const jwt = require("jsonwebtoken");
const prisma = require("../prisma/client");

async function superAdminMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Token missing or invalid format",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify role is SUPER_ADMIN
    if (decoded.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        message: "Access forbidden: Super Admins only",
      });
    }

    // Verify super admin exists in DB
    const admin = await prisma.administrator.findUnique({
      where: { id: decoded.id },
    });

    if (!admin || admin.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        message: "Access forbidden: Invalid Super Admin account",
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    console.error("Super admin auth error:", error);
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}

module.exports = superAdminMiddleware;
