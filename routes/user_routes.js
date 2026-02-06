const express = require("express");
const router = express.Router();
const { register, getProfile } = require("../controllers/user_controller");
const authMiddleware = require("../middleware/auth_middleware");

router.post("/register", register);
router.get("/profile", authMiddleware, getProfile);

module.exports = router;
