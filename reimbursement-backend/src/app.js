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

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean).map((o) => o.replace(/\/$/, "")); // strip trailing slash

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server / Postman (no origin header)
      if (!origin) return callback(null, true);
      const clean = origin.replace(/\/$/, "");
      if (allowedOrigins.includes(clean)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));


// Admin Routes
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/reimbursements", approvalRoutes);
app.use("/api/admin/indent", indentRoutes);
app.use("/api/admin", adminRoutes);

// Monthly Projections Routes
app.use("/api/projections", projectionRoutes);

// User Routes
app.use("/api/user/auth", userAuthRoutes);
app.use("/api/user/reimbursements", reimbursementRoutes);

module.exports = app;