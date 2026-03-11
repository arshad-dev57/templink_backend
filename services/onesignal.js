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
    ...(collapseId ? { collapse_id: collapseId } : {}),
  };
  if (subscriptionId) {
    payload.include_subscription_ids = [subscriptionId];
  } else {
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