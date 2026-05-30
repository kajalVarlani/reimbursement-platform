const express = require("express");
const adminAuthMiddleware = require("../middleware/adminAuthMiddleware");
const {
  getVisibleReimbursements,
  approveReimbursement,
  rejectReimbursement,
  raiseQuery,
  getApprovalHistory,
} = require("../controllers/approvalController");

const router = express.Router();

router.use(adminAuthMiddleware);

router.get("/", getVisibleReimbursements);
router.get("/history", getApprovalHistory);
router.post("/:id/approve", approveReimbursement);
router.post("/:id/reject", rejectReimbursement);
router.post("/:id/query", raiseQuery);

module.exports = router;
