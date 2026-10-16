const express = require("express");
const cors = require("cors");

const adminRoutes = require("./routes/adminRoutes");
const adminAuthRoutes = require("./routes/adminAuthRoutes");
const userAuthRoutes = require("./routes/userAuthRoutes");

const reimbursementRoutes = require("./routes/reimbursementRoutes");
const approvalRoutes = require("./routes/approvalRoutes");
const projectionRoutes = require("./routes/projectionRoutes");
const indentRoutes = require("./routes/indentRoutes");

const app = express();

const configuredOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const allowedOrigins = [
  ...configuredOrigins,
  "http://localhost:5173",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server / Postman / Render health checks (no origin header)
      if (!origin) return callback(null, true);
      const clean = origin.replace(/\/+$/, "");
      if (allowedOrigins.includes(clean)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check / root
app.get(["/", "/api", "/api/health"], (req, res) => {
  res.json({ status: "ok", message: "Reimbursement Platform API is running" });
});

// Admin Routes (mounted with and without /api prefix for deployment robustness)
app.use(["/api/admin/auth", "/admin/auth"], adminAuthRoutes);
app.use(["/api/admin/reimbursements", "/admin/reimbursements"], approvalRoutes);
app.use(["/api/admin/indent", "/admin/indent"], indentRoutes);
app.use(["/api/admin", "/admin"], adminRoutes);

// Monthly Projections Routes
app.use(["/api/projections", "/projections"], projectionRoutes);

// User Routes
app.use(["/api/user/auth", "/user/auth"], userAuthRoutes);
app.use(["/api/user/reimbursements", "/user/reimbursements"], reimbursementRoutes);

module.exports = app;