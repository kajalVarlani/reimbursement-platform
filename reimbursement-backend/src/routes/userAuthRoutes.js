const express = require("express");
const userAuthMiddleware = require("../middleware/userAuthMiddleware");
const {
  login,
  forgotPassword,
  resetPassword,
  getMe,
} = require("../controllers/userAuthController");

const router = express.Router();

router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", userAuthMiddleware, getMe);

module.exports = router;
