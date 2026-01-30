const express = require("express");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend running on Vercel 🚀",
  });
});

app.get("/api/test", (req, res) => {
  res.json({
    status: "ok",
    platform: "vercel",
  });
});

module.exports = app;
