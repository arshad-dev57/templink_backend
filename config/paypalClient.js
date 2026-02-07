const paypal = require("@paypal/checkout-server-sdk");

function environment() {
  const mode = process.env.PAYPAL_MODE || "sandbox";
  if (mode === "live") {
    return new paypal.core.LiveEnvironment(
      process.env.PAYPAL_CLIENT_ID,
      process.env.PAYPAL_CLIENT_SECRET
    );
  }
  return new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
  );
}

function client() {
  return new paypal.core.PayPalHttpClient(environment());
}

module.exports = { client };
