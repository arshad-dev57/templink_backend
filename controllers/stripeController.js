const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.createPaymentIntent = async (req, res) => {
  try {
    // ✅ Only allow POST
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    // ✅ Guard against undefined body
    const { amount, currency } = req.body || {};

    if (!amount || !currency) {
      return res.status(400).json({ error: "amount and currency are required" });
    }

    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    // Stripe expects amount in minor units
    const amountInMinorUnit = Math.round(amountNumber * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInMinorUnit,
      currency: String(currency).toLowerCase(),
      payment_method_types: ["card"],
    });

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
    });
  } catch (err) {
    console.error("Stripe error:", err);
    return res.status(500).json({ error: err.message });
  }
};
