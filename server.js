// In your main server file - FIXED
const express = require("express");
require("dotenv").config();
const cors = require("cors");
const http = require("http");
const app = express();
const dbConnection = require("./config/db");
const { initChatSocket } = require("./sockets/chat_socket");
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend running on localhost 🚀",
  });
});
app.use("/api/proposals", require("./routes/proposalRoutes"));
app.use("/api/users", require("./routes/user_routes"));
app.use("/api/stripe", require("./routes/stripe_routes"));
app.use("/api/paypal", require("./routes/paypal_routes"));
app.use("/api/notifications", require("./routes/notification_routes"));
app.use("/api/auth", require("./routes/password_reset_routes"));
app.use("/auth", require("./routes/linkedin_routes"));
app.use("/api/chat", require("./routes/chat_routes"));
app.use("/api/jobposts", require("./routes/job_post_routes"));
app.use("/api/projects", require("./routes/project_routes"));
app.use("/api/toptalent", require("./routes/toptalent_routes"));
app.use("/api/milestones", require("./routes/milestoneRoutes"));
app.use('/api/contracts', require('./routes/contract_routes'));
app.use('/api/employee', require('./routes/employee_project_routes'));  // 👈 YEH SAHI HAI
app.use('/api/employee-profile', require('./routes/employeeProfileRoutes'));  // 👈 CHANGED
app.use('/api/employer', require('./routes/employerProfileRoutes'));
app.use('/api/search', require('./routes/search_routes'));
app.use('/api/employee/stats', require('./routes/employeeStatsRoutes'));
app.use('/api/coins', require('./routes/coinPurchaseRoutes'));
app.use('/api/wallet', require('./routes/wallet_routes'));
app.use('/api/milestone-payments', require('./routes/milestones_payment_routes'));
app.use('/api/submissions', require('./routes/submissionRoutes'));
app.use('/api/invoices',require('./routes/invoice_routes'));
app.use('/api/ratings',require('./routes/ratingRoutes'));
app.use('/api/resume', require('./routes/resume_routes'));

dbConnection();
const server = http.createServer(app);
initChatSocket(server);
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});