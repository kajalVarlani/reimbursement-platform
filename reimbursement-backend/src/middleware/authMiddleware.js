const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  try {
    const authHeader =
      req.headers.authorization;

    // token missing
    if (!authHeader) {
      return res.status(401).json({
        message: "Token missing",
      });
    }

    // Bearer TOKEN
    const token = authHeader.split(" ")[1];

    // verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // attach user data to request
    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid token",
    });
  }
}

module.exports = authMiddleware;