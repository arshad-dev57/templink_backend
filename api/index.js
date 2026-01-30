const express = require("express");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "API is working fine 🚀",
  });
});

app.get("/api/test", (req, res) => {
  res.json({
    status: "ok",
    env: "local / vercel",
  });
});

// 👇 Local run support
if (require.main === module) {
  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
