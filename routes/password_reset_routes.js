const router = require("express").Router();
const ctrl = require("../controllers/password_reset_controller");

router.post("/forgot-password/request", ctrl.requestOtp);
router.post("/forgot-password/verify", ctrl.verifyOtp);
router.post("/forgot-password/reset", ctrl.resetPassword);

module.exports = router;
