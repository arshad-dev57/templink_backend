const axios = require("axios");

function buildExternalId(mongoUserId) {
  const env = (process.env.ONESIGNAL_ENV || "dev").trim();
  return `${env}:${String(mongoUserId).trim()}`;
}

async function sendToUser({ mongoUserId, subscriptionId, title, message, data = {}, collapseId }) {
  const externalId = buildExternalId(mongoUserId);

  const payload = {
    app_id: process.env.ONESIGNAL_APP_ID,
    headings: { en: title || "Templink" },
    contents: { en: message || "" },
    data,
    // ✅ WhatsApp style: same collapseId wali purani notification replace ho jaati hai
    // Har conversation ka alag collapseId hoga (e.g. "chat_<convoId>")
    ...(collapseId ? { collapse_id: collapseId } : {}),
  };

  // ✅ subscriptionId se bhejo agar available ho (foran kaam karta hai)
  if (subscriptionId) {
    payload.include_subscription_ids = [subscriptionId];
  } else {
    // Fallback: external_id (thodi der baad kaam karta hai)
    payload.target_channel = "push";
    payload.include_aliases = { external_id: [externalId] };
  }

  const res = await axios.post(
    "https://api.onesignal.com/notifications?c=push",
    payload,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      timeout: 15000,
    }
  );

  return res.data;
}

module.exports = { sendToUser, buildExternalId };