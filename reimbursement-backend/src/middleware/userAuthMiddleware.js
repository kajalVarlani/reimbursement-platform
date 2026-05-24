const jwt = require("jsonwebtoken");
const prisma = require("../prisma/client");

async function userAuthMiddleware(req, res, next) {
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
    if (decoded.role !== "USER") {
      return res.status(403).json({
        message: "Access forbidden: Users only",
      });
    }

    // Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(401).json({
        message: "User not found or disabled",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("User auth error:", error);
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}

module.exports = userAuthMiddleware;
