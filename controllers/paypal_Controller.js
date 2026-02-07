const paypal = require("@paypal/checkout-server-sdk");
const { client } = require("../config/paypalClient");

exports.createOrder = async (req, res) => {
  try {
    const { amount, currency } = req.body || {};
    if (!amount || !currency) {
      return res.status(400).json({ error: "amount and currency are required" });
    }

    // ✅ return/cancel URLs (use your domain later)
    const returnUrl = "https://example.com/paypal-success";
    const cancelUrl = "https://example.com/paypal-cancel";

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: String(currency).toUpperCase(),
            value: String(amount), // PayPal expects normal units (e.g. 10.00)
          },
        },
      ],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        user_action: "PAY_NOW",
      },
    });

    const response = await client().execute(request);

    const approvalLink = response.result.links.find((l) => l.rel === "approve");
    return res.status(200).json({
      orderId: response.result.id,
      approvalUrl: approvalLink?.href,
    });
  } catch (err) {
    console.error("PayPal createOrder error:", err);
    return res.status(500).json({ error: err.message });
  }
};

exports.captureOrder = async (req, res) => {
  try {
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ error: "orderId is required" });

    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});

    const response = await client().execute(request);

    // success check
    const status = response.result.status; // COMPLETED expected
    return res.status(200).json({
      status,
      details: response.result,
    });
  } catch (err) {
    console.error("PayPal captureOrder error:", err);
    return res.status(500).json({ error: err.message });
  }
};
