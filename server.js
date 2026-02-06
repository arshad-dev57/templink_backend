const express = require("express");
require("dotenv").config();
const cors = require("cors");

const app = express();

const dbConnection = require("./config/db");
const userRoutes = require("./routes/user_routes");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend running on Vercel 🚀",
  });
});

app.use("/api", userRoutes);
app.use("/api/stripe", require("./routes/stripe_routes"));

// DB connect (ensure your dbConnection doesn't crash if called multiple times)
dbConnection();

// ✅ IMPORTANT: Do NOT listen on a port in Vercel serverless
module.exports = app;
