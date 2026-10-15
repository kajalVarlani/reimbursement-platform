const express = require("express");
const superAdminMiddleware = require("../middleware/superAdminMiddleware");
const {
  createUser,
  listUsers,
  deleteUser,
  createAdmin,
  listAdmins,
  deleteAdmin,
  createPosition,
  listPositions,
  updatePosition,
  deletePosition,
  listAllReimbursements,
  listClubMappings,
  upsertClubMapping,
  deleteClubMapping,
  listFacultyMentors,
  getBufferStatus,
  replenishBuffer,
  topUpBuffer,
  getClubBudgets,
  upsertClubBudget,
  deleteClubBudget,
} = require("../controllers/adminController");

const router = express.Router();

// All SUPER_ADMIN endpoints are protected
router.use(superAdminMiddleware);

// User CRUD
router.post("/create-user", createUser); // For backwards compatibility
router.post("/users", createUser);
router.get("/users", listUsers);
router.delete("/users/:id", deleteUser);

// Admin CRUD
router.post("/admins", createAdmin);
router.get("/admins", listAdmins);
router.delete("/admins/:id", deleteAdmin);
router.get("/faculty-mentors", listFacultyMentors);

// Position CRUD
router.post("/positions", createPosition);
router.get("/positions", listPositions);
router.put("/positions/:id", updatePosition);
router.delete("/positions/:id", deletePosition);

// Club-to-Faculty Mentor Mappings
router.get("/club-mappings", listClubMappings);
router.post("/club-mappings", upsertClubMapping);
router.delete("/club-mappings/:id", deleteClubMapping);

// Advance Buffer Management
router.get("/buffer", getBufferStatus);
router.post("/buffer/replenish", replenishBuffer);
router.post("/buffer/top-up", topUpBuffer);

// Club Budget Allocation (per club/committee, per month)
router.get("/club-budgets", getClubBudgets);
router.post("/club-budgets", upsertClubBudget);
router.delete("/club-budgets/:id", deleteClubBudget);

// Global reimbursement overview (audit)
router.get("/reimbursements", listAllReimbursements);

module.exports = router;