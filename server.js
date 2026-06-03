const express = require("express");
require("dotenv").config();
const cors = require("cors");
const http = require("http");
const https = require("https");
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

app.get("/ping", (req, res) => {
  res.status(200).json({
    success: true,
    message: "pong 🏓",
    time: new Date().toISOString(),
  });
});

// Ye line pehle se hai ya add karo
app.use('/api/walletwithdrawl', require('./routes/walletWithdrawalRoutes'));app.use("/api/proposals", require("./routes/proposalRoutes"));
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
app.use('/api/employee', require('./routes/employee_project_routes'));
app.use('/api/employee-profile', require('./routes/employeeProfileRoutes'));
app.use('/api/employer', require('./routes/employerProfileRoutes'));
app.use('/api/search', require('./routes/search_routes'));
app.use('/api/employee/stats', require('./routes/employeeStatsRoutes'));
app.use('/api/coins', require('./routes/coinPurchaseRoutes'));
app.use('/api/wallet', require('./routes/wallet_routes'));
app.use('/api/milestone-payments', require('./routes/milestones_payment_routes'));
app.use('/api/submissions', require('./routes/submissionRoutes'));
app.use('/api/invoices', require('./routes/invoice_routes'));
app.use('/api/ratings', require('./routes/ratingRoutes'));
app.use('/api/resume', require('./routes/resume_routes'));
app.use('/api/jobapplication', require('./routes/jobApplicationRoutes'));
app.use('/api/commission', require('./routes/commissionRoutes'));
app.use('/api/protection', require('./routes/employeeLeaveRoutes'));
app.use('/api/interest', require('./routes/interestRoutes'));
app.use('/api/balance', require('./routes/balance_routes'));
app.use('/api/attendance-dashboard', require('./routes/employer_attandance_routes'));
app.use('/api/employee-dashboard', require('./routes/employee_attendance_dashboard_routes'));
app.use('/api/employer-attendance-history', require('./routes/employer_attendance_history_routes'));
app.use('/api/employee-leave', require('./routes/employee_leave_routes'));
app.use('/api/employer-leave', require('./routes/employer_leave_routes'));
app.use("/api/employee-timesheet", require("./routes/employee_timesheet_routes"));
app.use('/api/employer-timesheet', require('./routes/employer_timesheet_routes'));
app.use('/api/tasks', require('./routes/tasks_routes'));

dbConnection();

const server = http.createServer(app);

initChatSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📱 Chat Socket initialized`);
  console.log(`📞 Call Socket initialized`);
  const RENDER_URL = process.env.RENDER_URL || `http://localhost:${PORT}`;
  setInterval(() => {
    try {
      const client = RENDER_URL.startsWith("https") ? https : http;
      client.get(`${RENDER_URL}/ping`, (res) => {
        console.log(`🏓 Self-ping sent — status: ${res.statusCode} — ${new Date().toISOString()}`);
      }).on("error", (e) => {
        console.log(`⚠️ Self-ping failed: ${e.message}`);
      });
    } catch (e) {
      console.log(`⚠️ Self-ping error: ${e.message}`);
    }
  }, 14 * 60 * 1000); 
});

