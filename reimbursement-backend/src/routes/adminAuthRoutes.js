const express = require("express");
const adminAuthMiddleware = require("../middleware/adminAuthMiddleware");
const {
  login,
  forgotPassword,
  resetPassword,
  getMe,
} = require("../controllers/adminAuthController");

const router = express.Router();

router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", adminAuthMiddleware, getMe);

module.exports = router;
