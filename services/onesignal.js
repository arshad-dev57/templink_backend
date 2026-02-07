const axios = require("axios");

function buildExternalId(mongoUserId) {
  const env = (process.env.ONESIGNAL_ENV || "dev").trim();
  return `${env}:${String(mongoUserId).trim()}`;
}

async function sendToUser({ mongoUserId, title, message, data = {} }) {
  const externalId = buildExternalId(mongoUserId);

  const payload = {
    app_id: process.env.ONESIGNAL_APP_ID,
    target_channel: "push",
    include_aliases: {
      external_id: [externalId], // must be array
    },
    headings: { en: title || "Templink" },
    contents: { en: message || "" },
    data, // additionalData -> flutter me event.notification.additionalData
  };

  
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

  return res.data; // id, recipients etc
}

module.exports = { sendToUser, buildExternalId };

