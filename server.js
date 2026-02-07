const express = require("express");
require("dotenv").config();
const cors = require("cors");

const app = express();

const dbConnection = require("./config/db");
const userRoutes = require("./routes/user_routes");

// ✅ STRIPE KEY DEBUG LOGS (SAFE)
const stripeKey = process.env.STRIPE_SECRET_KEY || "";

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


dbConnection();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
 });
