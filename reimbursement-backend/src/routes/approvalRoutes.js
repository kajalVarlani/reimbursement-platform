const express = require("express");
const adminAuthMiddleware = require("../middleware/adminAuthMiddleware");
const {
  getVisibleReimbursements,
  approveReimbursement,
  rejectReimbursement,
} = require("../controllers/approvalController");

const router = express.Router();

router.use(adminAuthMiddleware);

router.get("/", getVisibleReimbursements);
router.post("/:id/approve", approveReimbursement);
router.post("/:id/reject", rejectReimbursement);

module.exports = router;
