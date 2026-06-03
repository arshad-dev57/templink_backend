const User = require('../models/user_model');
const Payment = require('../models/Payment'); // Your existing Payment model
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Coin packages configuration - prices in cents (USD)
const COIN_PACKAGES = [
  { id: 'basic', coins: 50, price: 499, name: 'Basic Pack' },
  { id: 'popular', coins: 120, price: 999, name: 'Popular Pack' },
  { id: 'pro', coins: 300, price: 1999, name: 'Pro Pack' },
  { id: 'enterprise', coins: 800, price: 4999, name: 'Enterprise Pack' }
];

// ==================== GET COIN PACKAGES ====================
exports.getCoinPackages = async (req, res) => {
  try {
    console.log('📦 Fetching coin packages...');
    return res.status(200).json({
      success: true,
      packages: COIN_PACKAGES
    });
  } catch (error) {
    console.error('❌ Error fetching coin packages:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};
// Create Stripe Checkout Session
exports.createCheckoutSession = async (req, res) => {
  try {
    const { packageId } = req.body;
    const userId = req.user.id;

    const selectedPackage = COIN_PACKAGES.find(p => p.id === packageId);
    
    if (!selectedPackage) {
      return res.status(400).json({
        success: false,
        message: 'Invalid package selected'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove trailing slash if present
    let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:50727';
    if (frontendUrl.endsWith('/')) {
      frontendUrl = frontendUrl.slice(0, -1);
    }
    
    // IMPORTANT: Redirect back to buy-coins with session_id in URL
    const SUCCESS_URL = `${frontendUrl}/#/buy-coins?session_id={CHECKOUT_SESSION_ID}`;
    const CANCEL_URL = `${frontendUrl}/#/buy-coins`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: selectedPackage.name,
              description: `${selectedPackage.coins} Coins`,
            },
            unit_amount: selectedPackage.price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: SUCCESS_URL,
      cancel_url: CANCEL_URL,
      customer_email: user.email,
      metadata: {
        userId: userId,
        packageId: packageId,
        coins: selectedPackage.coins.toString(),
        packageName: selectedPackage.name,
        type: 'coin_purchase'
      },
      client_reference_id: userId,
    });

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      sessionUrl: session.url,
      package: selectedPackage
    });

  } catch (error) {
    console.error('❌ Error creating checkout session:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};
exports.verifyPayment = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user.id;

    console.log(`\n🟡 [DEBUG] ========== VERIFY PAYMENT STARTED ==========`);
    console.log(`   ├─ Session ID: ${sessionId}`);
    console.log(`   ├─ User ID: ${userId}`);
    console.log(`   └─ Timestamp: ${new Date().toISOString()}`);

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    console.log(`\n📦 [DEBUG] Stripe Session Details:`);
    console.log(`   ├─ Payment Status: ${session.payment_status}`);
    console.log(`   ├─ Amount Total: $${session.amount_total/100} (${session.amount_total} cents)`);
    console.log(`   ├─ Currency: ${session.currency}`);
    console.log(`   ├─ Payment Intent ID: ${session.payment_intent}`);
    console.log(`   └─ Customer Email: ${session.customer_details?.email}`);

    if (session.payment_status !== 'paid') {
      console.log(`❌ [DEBUG] Payment not completed! Status: ${session.payment_status}`);
      return res.status(400).json({
        success: false,
        message: 'Payment not completed'
      });
    }

    console.log(`✅ [DEBUG] Payment status is 'paid'`);

    // Verify metadata matches
    if (session.metadata.userId !== userId) {
      console.log(`❌ [DEBUG] Metadata verification failed!`);
      console.log(`   ├─ Expected User ID: ${userId}`);
      console.log(`   └─ Actual User ID: ${session.metadata.userId}`);
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    console.log(`✅ [DEBUG] User ID verified`);

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      console.log(`❌ [DEBUG] User not found: ${userId}`);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`\n👤 [DEBUG] User Details:`);
    console.log(`   ├─ User ID: ${user._id}`);
    console.log(`   ├─ Name: ${user.fullName || 'N/A'}`);
    console.log(`   ├─ Email: ${user.email}`);
    console.log(`   └─ Current Balance: ${user.pointsBalance || 0} coins`);

    // Get package details
    const packageId = session.metadata.packageId;
    const selectedPackage = COIN_PACKAGES.find(p => p.id === packageId);
    
    if (!selectedPackage) {
      console.log(`❌ [DEBUG] Package not found: ${packageId}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid package'
      });
    }
    
    const coinsToAdd = selectedPackage.coins;
    const amountInCents = session.amount_total;
    const paymentIntentId = session.payment_intent;

    console.log(`\n📦 [DEBUG] Package Details:`);
    console.log(`   ├─ Package ID: ${packageId}`);
    console.log(`   ├─ Package Name: ${selectedPackage.name}`);
    console.log(`   ├─ Coins to Add: ${coinsToAdd}`);
    console.log(`   └─ Amount: $${amountInCents/100}`);

    // Check if payment already processed
    const existingPayment = await Payment.findOne({ paymentIntentId: paymentIntentId });
    if (existingPayment && existingPayment.status === 'succeeded') {
      console.log(`⚠️ [DEBUG] Payment already processed!`);
      console.log(`   ├─ Payment Intent: ${paymentIntentId}`);
      console.log(`   ├─ Existing Payment ID: ${existingPayment._id}`);
      console.log(`   └─ Status: ${existingPayment.status}`);
      
      return res.status(200).json({
        success: true,
        message: 'Payment already verified',
        newBalance: user.pointsBalance || 0,
        coinsAdded: coinsToAdd,
        alreadyProcessed: true
      });
    }

    // Add coins to user balance
    const previousBalance = user.pointsBalance || 0;
    const newBalance = previousBalance + coinsToAdd;
    
    console.log(`\n💰 [DEBUG] Updating User Balance:`);
    console.log(`   ├─ Previous Balance: ${previousBalance} coins`);
    console.log(`   ├─ Coins Added: +${coinsToAdd} coins`);
    console.log(`   ├─ New Balance: ${newBalance} coins`);
    console.log(`   └─ Increase: ${((coinsToAdd / previousBalance) * 100).toFixed(2)}% (if previous > 0)`);
    
    user.pointsBalance = newBalance;
    await user.save();
    
    console.log(`✅ [DEBUG] User balance updated successfully!`);

    // Create payment record using existing Payment model
    const paymentRecord = new Payment({
      paymentIntentId: paymentIntentId,
      clientSecret: session.client_secret,
      amount: amountInCents,
      currency: session.currency || 'usd',
      status: 'succeeded',
      userId: userId,
      paymentMethod: 'card',
      metadata: {
        sessionId: sessionId,
        packageId: packageId,
        packageName: selectedPackage.name,
        coins: selectedPackage.coins,
        coinsAdded: coinsToAdd,
        previousBalance: previousBalance,
        newBalance: newBalance,
        type: 'coin_purchase',
        customerEmail: session.customer_details?.email || user.email,
        customerName: session.customer_details?.name || user.fullName
      },
      receiptUrl: session.payment_intent?.charges?.data?.[0]?.receipt_url || null
    });

    await paymentRecord.save();

    console.log(`\n📝 [DEBUG] Payment Record Created:`);
    console.log(`   ├─ Payment ID: ${paymentRecord._id}`);
    console.log(`   ├─ Payment Intent ID: ${paymentIntentId}`);
    console.log(`   ├─ Amount: $${amountInCents/100}`);
    console.log(`   ├─ Status: ${paymentRecord.status}`);
    console.log(`   └─ Created At: ${paymentRecord.createdAt}`);

    console.log(`\n🎉 [DEBUG] ========== PAYMENT VERIFIED SUCCESSFULLY ==========`);
    console.log(`📊 [SUMMARY]`);
    console.log(`   ├─ User: ${user.fullName || user.email}`);
    console.log(`   ├─ Package: ${selectedPackage.name}`);
    console.log(`   ├─ Coins Purchased: +${coinsToAdd}`);
    console.log(`   ├─ Balance Before: ${previousBalance}`);
    console.log(`   ├─ Balance After: ${newBalance}`);
    console.log(`   ├─ Amount Paid: $${amountInCents/100}`);
    console.log(`   └─ Payment ID: ${paymentRecord._id}\n`);

    return res.status(200).json({
      success: true,
      message: 'Payment verified and coins added',
      newBalance: newBalance,
      coinsAdded: coinsToAdd,
      paymentId: paymentRecord._id,
      previousBalance: previousBalance
    });

  } catch (error) {
    console.error('❌ Error verifying payment:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== GET COIN BALANCE ====================
exports.getCoinBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`🟡 [DEBUG] Fetching balance for user: ${userId}`);
    
    const user = await User.findById(userId).select('pointsBalance fullName email');
    
    console.log(`💰 [DEBUG] User Balance: ${user?.pointsBalance || 0} coins`);
    
    return res.status(200).json({
      success: true,
      balance: user?.pointsBalance || 0
    });

  } catch (error) {
    console.error('❌ Error fetching coin balance:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== GET PAYMENT HISTORY ====================
exports.getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`🟡 [DEBUG] Fetching payment history for user: ${userId}`);
    
    const payments = await Payment.find({ 
      userId: userId,
      'metadata.type': 'coin_purchase'
    }).sort({ createdAt: -1 }).limit(50);

    console.log(`📊 [DEBUG] Found ${payments.length} coin purchase payments`);
    
    // Log summary of payments
    let totalCoinsPurchased = 0;
    let totalAmountSpent = 0;
    
    payments.forEach((p, index) => {
      const coins = p.metadata?.coinsAdded || 0;
      const amount = p.amount / 100;
      totalCoinsPurchased += coins;
      totalAmountSpent += amount;
      console.log(`   ${index + 1}. ${p.createdAt} - ${p.metadata?.packageName} - +${coins} coins - $${amount}`);
    });
    
    console.log(`📊 [SUMMARY] Total Coins Purchased: ${totalCoinsPurchased}`);
    console.log(`📊 [SUMMARY] Total Amount Spent: $${totalAmountSpent.toFixed(2)}`);

    return res.status(200).json({
      success: true,
      payments: payments,
      total: payments.length,
      summary: {
        totalCoinsPurchased: totalCoinsPurchased,
        totalAmountSpent: totalAmountSpent
      }
    });

  } catch (error) {
    console.error('❌ Error fetching payment history:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== GET SINGLE PAYMENT ====================
exports.getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;
    
    console.log(`🟡 [DEBUG] Fetching payment details: ${paymentId} for user: ${userId}`);
    
    const payment = await Payment.findOne({ 
      _id: paymentId, 
      userId: userId 
    });
    
    if (!payment) {
      console.log(`❌ [DEBUG] Payment not found: ${paymentId}`);
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    console.log(`✅ [DEBUG] Payment found:`);
    console.log(`   ├─ Package: ${payment.metadata?.packageName}`);
    console.log(`   ├─ Coins: ${payment.metadata?.coinsAdded}`);
    console.log(`   ├─ Amount: $${payment.amount/100}`);
    console.log(`   └─ Status: ${payment.status}`);

    return res.status(200).json({
      success: true,
      payment: payment
    });

  } catch (error) {
    console.error('❌ Error fetching payment details:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== STRIPE WEBHOOK HANDLER ====================
exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  console.log(`\n🔔 [DEBUG] ========== WEBHOOK RECEIVED ==========`);
  console.log(`   └─ Timestamp: ${new Date().toISOString()}`);

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log(`✅ [DEBUG] Webhook signature verified`);
    console.log(`   └─ Event Type: ${event.type}`);
  } catch (err) {
    console.log(`⚠️ Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    console.log(`\n✅ [DEBUG] Checkout Session Completed`);
    console.log(`   ├─ Session ID: ${session.id}`);
    console.log(`   ├─ Payment Intent: ${session.payment_intent}`);
    console.log(`   ├─ Amount: $${session.amount_total/100}`);
    console.log(`   └─ Customer: ${session.customer_details?.email}`);

    const { userId, packageId, coins, packageName } = session.metadata;
    const paymentIntentId = session.payment_intent;

    console.log(`\n📦 [DEBUG] Metadata:`);
    console.log(`   ├─ User ID: ${userId}`);
    console.log(`   ├─ Package ID: ${packageId}`);
    console.log(`   ├─ Package Name: ${packageName}`);
    console.log(`   └─ Coins: ${coins}`);

    try {
      // Check if payment already processed
      const existingPayment = await Payment.findOne({ paymentIntentId: paymentIntentId });
      if (existingPayment && existingPayment.status === 'succeeded') {
        console.log(`⚠️ [DEBUG] Payment already processed for intent: ${paymentIntentId}`);
        return res.status(200).json({ received: true });
      }

      // Find user
      const user = await User.findById(userId);
      if (!user) {
        console.error(`❌ [DEBUG] User not found: ${userId}`);
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      console.log(`\n👤 [DEBUG] User found:`);
      console.log(`   ├─ Name: ${user.fullName || 'N/A'}`);
      console.log(`   ├─ Email: ${user.email}`);
      console.log(`   └─ Current Balance: ${user.pointsBalance || 0} coins`);

      // Get package details
      const selectedPackage = COIN_PACKAGES.find(p => p.id === packageId);
      
      if (!selectedPackage) {
        console.error(`❌ [DEBUG] Package not found: ${packageId}`);
        return res.status(400).json({ success: false, message: 'Package not found' });
      }

      // Add coins
      const coinsToAdd = parseInt(coins) || selectedPackage.coins;
      const previousBalance = user.pointsBalance || 0;
      const newBalance = previousBalance + coinsToAdd;
      
      console.log(`\n💰 [DEBUG] Updating Balance:`);
      console.log(`   ├─ Previous Balance: ${previousBalance} coins`);
      console.log(`   ├─ Coins to Add: +${coinsToAdd} coins`);
      console.log(`   └─ New Balance: ${newBalance} coins`);
      
      user.pointsBalance = newBalance;
      await user.save();
      
      console.log(`✅ [DEBUG] Balance updated!`);

      // Create payment record
      const amountInCents = session.amount_total;

      const paymentRecord = new Payment({
        paymentIntentId: paymentIntentId,
        clientSecret: session.client_secret,
        amount: amountInCents,
        currency: session.currency || 'usd',
        status: 'succeeded',
        userId: userId,
        paymentMethod: 'card',
        metadata: {
          sessionId: session.id,
          packageId: packageId,
          packageName: packageName || selectedPackage.name,
          coins: selectedPackage.coins,
          coinsAdded: coinsToAdd,
          previousBalance: previousBalance,
          newBalance: newBalance,
          type: 'coin_purchase',
          customerEmail: session.customer_details?.email || user.email,
          customerName: session.customer_details?.name || user.fullName,
          webhook: true
        },
        receiptUrl: session.payment_intent?.charges?.data?.[0]?.receipt_url || null
      });

      await paymentRecord.save();

      console.log(`\n📝 [DEBUG] Payment Record Saved:`);
      console.log(`   ├─ Payment ID: ${paymentRecord._id}`);
      console.log(`   ├─ Payment Intent: ${paymentIntentId}`);
      console.log(`   └─ Status: ${paymentRecord.status}`);

      console.log(`\n🎉 [DEBUG] ========== WEBHOOK PROCESSED SUCCESSFULLY ==========`);
      console.log(`📊 [SUMMARY]`);
      console.log(`   ├─ User: ${user.fullName || user.email}`);
      console.log(`   ├─ Package: ${selectedPackage.name}`);
      console.log(`   ├─ Coins Added: +${coinsToAdd}`);
      console.log(`   ├─ Balance Before: ${previousBalance}`);
      console.log(`   ├─ Balance After: ${newBalance}`);
      console.log(`   └─ Amount Paid: $${amountInCents/100}\n`);

    } catch (error) {
      console.error('❌ Webhook error updating user balance:', error);
    }
  }

  res.json({ received: true });
};