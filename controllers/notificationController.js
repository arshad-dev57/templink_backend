// services/notificationService.js
const { sendToUser } = require("../Services/onesignal");
const User = require("../models/user_model");

async function sendNotification(userId, title, message, data = {}) {
  try {
    const user = await User.findById(userId).select('notificationSettings');
    if (!user) return;
    
    // Check if user has push notifications enabled
    if (user.notificationSettings?.pushNotifications === false) {
      return;
    }
    
    await sendToUser({
      mongoUserId: userId,
      title: title,
      message: message,
      data: data,
      collapseId: data.type || "general"
    });
  } catch (error) {
    console.error("Notification send error:", error);
  }
}

module.exports = { sendNotification };