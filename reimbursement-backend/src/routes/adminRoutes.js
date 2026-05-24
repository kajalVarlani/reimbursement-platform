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

// Position CRUD
router.post("/positions", createPosition);
router.get("/positions", listPositions);
router.put("/positions/:id", updatePosition);
router.delete("/positions/:id", deletePosition);

module.exports = router;