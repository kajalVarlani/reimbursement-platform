const express = require("express");
const superAdminMiddleware = require("../middleware/superAdminMiddleware");
const { exportTreasurerMonthlyIndent, getIndentSummary } = require("../controllers/indentController");

const router = express.Router();

// Protected for Treasurer (Super Admin)
router.get("/summary", superAdminMiddleware, getIndentSummary);
router.get("/export", superAdminMiddleware, exportTreasurerMonthlyIndent);

module.exports = router;
