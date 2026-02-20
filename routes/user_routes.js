const router = require("express").Router();
const { register, login, googleAuth } = require("../controllers/user_controller");
const photoUpload = require("../middleware/image_Upload");

// ✅ register with photo
router.post("/register", photoUpload.single("photo"), register);

router.post("/login", login);
router.post("/google", googleAuth);

module.exports = router;