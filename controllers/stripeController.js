const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.createPaymentIntent = async (req, res) => {
  try {
    const { amount, currency } = req.body;

    
    if (!amount || !currency) {
      return res.status(400).json({ error: "amount and currency are required" });
    }

    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    // Stripe expects amount in minor units (e.g. 10.99 USD -> 1099) :contentReference[oaicite:1]{index=1}
    // PKR is a 2-decimal currency in general, so multiply by 100.
    const amountInMinorUnit = Math.round(amountNumber * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInMinorUnit,
      currency: String(currency).toLowerCase(),
      payment_method_types: ["card"],
    }); // :contentReference[oaicite:2]{index=2}

    return res.json({
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
    });
  } catch (err) {
    console.error("Stripe error:", err);
    return res.status(500).json({ error: err.message });
  }
};
