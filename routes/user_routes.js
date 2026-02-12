const router = require("express").Router();
const { register, login,googleAuth } = require("../controllers/user_controller");

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleAuth);
module.exports = router;
