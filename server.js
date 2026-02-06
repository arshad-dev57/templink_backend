const express = require("express");
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');

const app = express();
const dbConnection = require("./config/db");
const userRoutes = require("./routes/user_routes");

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend running on Vercel 🚀",
  });
});

app.use("/api", userRoutes);

// ✅ STRIPE ROUTES - Add These
app.use("/api/stripe", require("./routes/stripe_routes"));

dbConnection();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`💳 Stripe routes available at /api/stripe`);
});

module.exports = app;