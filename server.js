const express = require("express");
require("dotenv").config();
const cors = require("cors");
const http = require("http");

const app = express();

const dbConnection = require("./config/db");

// ✅ socket init (named export)
const { initChatSocket } = require("./sockets/chat_socket");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend running on localhost 🚀",
  });
});

app.use("/api/users", require("./routes/user_routes"));
app.use("/api/stripe", require("./routes/stripe_routes"));
app.use("/api/paypal", require("./routes/paypal_routes"));
app.use("/api/notifications", require("./routes/notification_routes"));
app.use("/api/auth", require("./routes/password_reset_routes"));
app.use("/auth", require("./routes/linkedin_routes"));
// ✅ NEW: chat routes (inbox + messages)
app.use("/api/chat", require("./routes/chat_routes"));
app.use("/api/jobposts", require("./routes/job_post_routes"));
app.use("/api/projects", require("./routes/project_routes"));

// DB
dbConnection();

// ✅ Create HTTP server + attach socket
const server = http.createServer(app);
initChatSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
