const express = require("express");
const userAuthMiddleware = require("../middleware/userAuthMiddleware");
const upload = require("../middleware/upload");
const {
  createReimbursement,
  getMyReimbursements,
  getReimbursementDetails,
  cancelReimbursement,
  getActivityLog,
  resubmitReimbursement,
} = require("../controllers/reimbursementController");
const { attachBill, detachBill, getBills } = require("../controllers/billController");

const router = express.Router();

router.use(userAuthMiddleware);

// ── Reimbursement CRUD ──────────────────────────────────────────────────────
router.post("/", createReimbursement);
router.get("/", getMyReimbursements);
router.get("/:id", getReimbursementDetails);
router.post("/:id/cancel", cancelReimbursement);
router.post("/:id/resubmit", resubmitReimbursement);

// ── Activity log ────────────────────────────────────────────────────────────
router.get("/:id/activity", getActivityLog);

// ── Bills ───────────────────────────────────────────────────────────────────
router.get("/:id/bills", getBills);
router.post("/:id/bills", upload.single("receipt"), attachBill);
router.delete("/:id/bills/:billId", detachBill);

module.exports = router;
