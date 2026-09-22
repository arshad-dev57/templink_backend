const router = require("express").Router();
const { sendNotification } = require("../controllers/notificationController");

// router.post("/send", authMiddleware, sendNotificationToUser); // if you have auth
router.post("/send", sendNotification);

module.exports = router;
 