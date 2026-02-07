const router = require("express").Router();
const { sendNotificationToUser } = require("../controllers/notificationController");

// router.post("/send", authMiddleware, sendNotificationToUser); // if you have auth
router.post("/send", sendNotificationToUser);

module.exports = router;
