const Stripe = require("stripe");

exports.  createPaymentIntent = async (req, res) => {
  try {
    
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    const { amount, currency } = req.body || {};
    if (!amount || !currency) {
      return res.status(400).json({ error: "amount and currency are required" });
    }

    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    const amountInMinorUnit = Math.round(amountNumber * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInMinorUnit,
      currency: String(currency).toLowerCase(),
      payment_method_types: ["card"],
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
    });
  } catch (err) {
    console.error("Stripe error:", err);
    return res.status(500).json({ error: err.message });
  }
};
