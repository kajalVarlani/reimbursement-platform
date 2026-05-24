const express = require("express");
const userAuthMiddleware = require("../middleware/userAuthMiddleware");
const upload = require("../middleware/upload");
const {
  createReimbursement,
  getMyReimbursements,
  getReimbursementDetails,
} = require("../controllers/reimbursementController");

const router = express.Router();

router.use(userAuthMiddleware);

router.post("/", upload.single("receipt"), createReimbursement);
router.get("/", getMyReimbursements);
router.get("/:id", getReimbursementDetails);

module.exports = router;
