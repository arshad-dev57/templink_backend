const jwt = require("jsonwebtoken");

module.exports = function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "No token" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Your token uses { sub: userId }
    req.user = { id: payload.sub };

    return next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
};