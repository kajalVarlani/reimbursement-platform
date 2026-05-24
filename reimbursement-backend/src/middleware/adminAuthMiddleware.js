const jwt = require("jsonwebtoken");
const prisma = require("../prisma/client");

async function adminAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Token missing or invalid format",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify token type/role
    if (decoded.role !== "ADMINISTRATOR" && decoded.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        message: "Access forbidden: Administrators only",
      });
    }

    // Verify administrator exists in database and fetch position
    const admin = await prisma.administrator.findUnique({
      where: { id: decoded.id },
      include: { position: true },
    });

    if (!admin) {
      return res.status(401).json({
        message: "Administrator not found or disabled",
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}

module.exports = adminAuthMiddleware;
