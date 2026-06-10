const express = require("express");
const adminAuthMiddleware = require("../middleware/adminAuthMiddleware");
const {
  getVisibleReimbursements,
  approveReimbursement,
  rejectReimbursement,
  raiseQuery,
  getApprovalHistory,
  markAsPaid,
  getActivityLog,
} = require("../controllers/approvalController");

const router = express.Router();

router.use(adminAuthMiddleware);

// ── Reimbursement views ─────────────────────────────────────────────────────
router.get("/", getVisibleReimbursements);
router.get("/history", getApprovalHistory);

// ── Approval actions ────────────────────────────────────────────────────────
router.post("/:id/approve", approveReimbursement);
router.post("/:id/reject", rejectReimbursement);
router.post("/:id/query", raiseQuery);

// ── Payment ─────────────────────────────────────────────────────────────────
router.post("/:id/mark-paid", markAsPaid);

// ── Activity log ────────────────────────────────────────────────────────────
router.get("/:id/activity", getActivityLog);

module.exports = router;
