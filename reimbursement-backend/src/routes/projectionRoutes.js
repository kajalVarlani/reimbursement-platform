const express = require("express");
const userAuthMiddleware = require("../middleware/userAuthMiddleware");
const superAdminMiddleware = require("../middleware/superAdminMiddleware");
const {
  setProjectionWindow,
  getActiveWindow,
  getMyProjection,
  submitProjection,
  listProjections,
} = require("../controllers/projectionController");

const router = express.Router();

// Public / Authenticated check for active deadline banner & buffer meter
router.get("/active-window", getActiveWindow);

// C / DC submission & status (protected by userAuthMiddleware)
router.get("/my-projection", userAuthMiddleware, getMyProjection);
router.post("/submit", userAuthMiddleware, submitProjection);

// Treasurer controls (protected by superAdminMiddleware)
router.post("/window", superAdminMiddleware, setProjectionWindow);
router.get("/list", superAdminMiddleware, listProjections);

module.exports = router;
