const express = require("express");
const cors = require("cors");

const adminRoutes = require("./routes/adminRoutes");
const adminAuthRoutes = require("./routes/adminAuthRoutes");
const userAuthRoutes = require("./routes/userAuthRoutes");

const reimbursementRoutes = require("./routes/reimbursementRoutes");
const approvalRoutes = require("./routes/approvalRoutes");

const app = express();

app.use(cors({
    origin: "https://claimnestdau.netlify.app",
    credentials: true,
}));
app.use(express.json());

// Admin Routes
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/reimbursements", approvalRoutes);
app.use("/api/admin", adminRoutes);

// User (Treasurer) Routes
app.use("/api/user/auth", userAuthRoutes);
app.use("/api/user/reimbursements", reimbursementRoutes);


module.exports = app;