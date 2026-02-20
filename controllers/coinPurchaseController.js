const User = require('../models/user_model');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Coin packages configuration - prices in cents (USD)
const COIN_PACKAGES = [
  { id: 'basic', coins: 50, price: 499, name: 'Basic Pack' },        // $4.99 for 50 coins
  { id: 'popular', coins: 120, price: 999, name: 'Popular Pack' },   // $9.99 for 120 coins
  { id: 'pro', coins: 300, price: 1999, name: 'Pro Pack' },          // $19.99 for 300 coins
  { id: 'enterprise', coins: 800, price: 4999, name: 'Enterprise Pack' } // $49.99 for 800 coins
]; 

// ==================== GET COIN PACKAGES ====================
exports.getCoinPackages = async (req, res) => {
  try {
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

// ==================== CREATE PAYMENT INTENT FOR COINS ====================
exports.createCoinPaymentIntent = async (req, res) => {
  try {
    const { packageId } = req.body;
    const userId = req.user.id;

    // Find the package
    const selectedPackage = COIN_PACKAGES.find(p => p.id === packageId);
    
    if (!selectedPackage) {
      return res.status(400).json({
        success: false,
        message: 'Invalid package selected'
      });
    }

    console.log(`🟡 Creating payment intent for user ${userId} - Package: ${selectedPackage.name}`);
    console.log(`💰 Amount: ${selectedPackage.price} cents ($${selectedPackage.price/100})`);

    // ✅ FIXED: Remove *100 multiplication, price already in cents
    const paymentIntent = await stripe.paymentIntents.create({
      amount: selectedPackage.price, // Already in cents, no multiplication needed
      currency: 'usd', // ✅ Changed from 'pkr' to 'usd'
      metadata: {
        userId: userId,
        packageId: packageId,
        coins: selectedPackage.coins.toString()
      }
    });

    return res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
      package: selectedPackage
    });

  } catch (error) {
    console.error('❌ Error creating coin payment intent:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== VERIFY PAYMENT AND ADD COINS ====================
exports.verifyCoinPayment = async (req, res) => {
  try {
    const { paymentIntentId, packageId } = req.body;
    const userId = req.user.id;

    console.log(`🟡 Verifying payment ${paymentIntentId} for user ${userId}`);

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: 'Payment not successful'
      });
    }

    // Verify metadata matches
    if (paymentIntent.metadata.userId !== userId || 
        paymentIntent.metadata.packageId !== packageId) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    // Find the package
    const selectedPackage = COIN_PACKAGES.find(p => p.id === packageId);
    if (!selectedPackage) {
      return res.status(400).json({
        success: false,
        message: 'Invalid package'
      });
    }

    // Update user's coin balance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add coins to user's balance
    user.pointsBalance = (user.pointsBalance || 0) + selectedPackage.coins;
    await user.save();

    console.log(`✅ Added ${selectedPackage.coins} coins to user ${userId}. New balance: ${user.pointsBalance}`);

    return res.status(200).json({
      success: true,
      message: 'Coins added successfully',
      newBalance: user.pointsBalance,
      coinsAdded: selectedPackage.coins
    });

  } catch (error) {
    console.error('❌ Error verifying coin payment:', error);
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
    
    const user = await User.findById(userId).select('pointsBalance');
    
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