const { sendToUser } = require("../services/onesignal");

exports.sendNotificationToUser = async (req, res) => {
  try {
    const { userId, title, message, data } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ ok: false, msg: "userId and message required" });
    }

    const result = await sendToUser({
      mongoUserId: userId,
      title,
      message,
      data: data || {},
    });

    return res.json({ ok: true, result });
  } catch (err) {
    const apiErr = err?.response?.data || null;
    return res.status(500).json({
      ok: false,
      msg: "OneSignal send failed",
      error: err.message,
      apiErr,
    });
  }
};
