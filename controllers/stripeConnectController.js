const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const mongoose = require('mongoose');
const { Wallet, WalletTransaction } = require('../models/Wallet');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/user_model');

// ==================== STEP 1: CREATE STRIPE CONNECT ACCOUNT ====================
// User pehli baar bank connect karta hai - Stripe ka onboarding page khulta hai
exports.createConnectAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Agar already connected hai to naya mat banao
    if (user.stripeConnectAccountId && user.stripeConnectOnboarded) {
      return res.status(400).json({
        success: false,
        message: 'Bank account already connected'
      });
    }

    let accountId = user.stripeConnectAccountId;

    // Agar account exist nahi karta to banao
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: user.email,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: { userId: userId.toString() }
      });

      accountId = account.id;

      await User.findByIdAndUpdate(userId, {
        stripeConnectAccountId: accountId,
        stripeConnectOnboarded: false,
        stripeConnectPayoutsEnabled: false
      });
    }

    // Onboarding link banao - user yahan bank details dega
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.FRONTEND_URL}/wallet?connect=refresh`,
      return_url: `${process.env.FRONTEND_URL}/wallet?connect=success`,
      type: 'account_onboarding',
    });

    return res.status(200).json({
      success: true,
      onboardingUrl: accountLink.url,
      accountId: accountId
    });

  } catch (error) {
    console.error('Create connect account error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create Stripe Connect account'
    });
  }
};

// ==================== STEP 2: CHECK ACCOUNT STATUS ====================
exports.checkAccountStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select(
      'stripeConnectAccountId stripeConnectOnboarded stripeConnectPayoutsEnabled'
    );

    if (!user?.stripeConnectAccountId) {
      return res.status(200).json({
        success: true,
        connected: false,
        onboarded: false,
        payoutsEnabled: false,
        accountId: null
      });
    }

    const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);

    const onboarded = account.details_submitted;
    const payoutsEnabled = account.payouts_enabled;

    if (onboarded !== user.stripeConnectOnboarded || payoutsEnabled !== user.stripeConnectPayoutsEnabled) {
      await User.findByIdAndUpdate(userId, {
        stripeConnectOnboarded: onboarded,
        stripeConnectPayoutsEnabled: payoutsEnabled
      });
    }

    return res.status(200).json({
      success: true,
      connected: true,
      onboarded,
      payoutsEnabled,
      accountId: user.stripeConnectAccountId,
      requirementsCount: account.requirements?.currently_due?.length || 0,
      requirements: account.requirements?.currently_due || []
    });

  } catch (error) {
    console.error('Check account status error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to check account status'
    });
  }
};

// ==================== STEP 3: WITHDRAWAL ====================
exports.createWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const { amount } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ success: false, message: 'Valid amount required' });
    }

    const amountFloat = parseFloat(amount);
    const MIN_WITHDRAWAL = 10;
    const MAX_WITHDRAWAL = 5000;

    if (amountFloat < MIN_WITHDRAWAL) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal is $${MIN_WITHDRAWAL}`
      });
    }

    if (amountFloat > MAX_WITHDRAWAL) {
      return res.status(400).json({
        success: false,
        message: `Maximum withdrawal per request is $${MAX_WITHDRAWAL}`
      });
    }

    const [user, wallet] = await Promise.all([
      User.findById(userId).select('stripeConnectAccountId stripeConnectOnboarded stripeConnectPayoutsEnabled email'),
      Wallet.findOne({ userId }).session(session)
    ]);

    if (!user?.stripeConnectAccountId) {
      return res.status(400).json({
        success: false,
        message: 'Please connect your bank account first',
        requiresOnboarding: true
      });
    }

    if (!user.stripeConnectOnboarded) {
      return res.status(400).json({
        success: false,
        message: 'Please complete your bank account setup',
        requiresOnboarding: true
      });
    }

    if (!user.stripeConnectPayoutsEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Payouts are not yet enabled for your account.',
        requiresOnboarding: false
      });
    }

    if (!wallet || wallet.balance < amountFloat) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance',
        currentBalance: wallet?.balance || 0
      });
    }

    // Daily limit check
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayTotal = await Withdrawal.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: todayStart },
          status: { $nin: ['cancelled', 'failed'] }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const dailyUsed = todayTotal[0]?.total || 0;
    const DAILY_LIMIT = 10000;

    if (dailyUsed + amountFloat > DAILY_LIMIT) {
      return res.status(400).json({
        success: false,
        message: `Daily limit $${DAILY_LIMIT}. Used today: $${dailyUsed.toFixed(2)}`
      });
    }

    const amountInCents = Math.round(amountFloat * 100);

    const transfer = await stripe.transfers.create({
      amount: amountInCents,
      currency: 'usd',
      destination: user.stripeConnectAccountId,
      metadata: {
        userId: userId.toString(),
        walletWithdrawal: 'true'
      }
    });

    const newBalance = wallet.balance - amountFloat;

    await Wallet.findByIdAndUpdate(
      wallet._id,
      { balance: newBalance, lastTransactionAt: new Date() },
      { session }
    );

    const withdrawal = await Withdrawal.create([{
      userId,
      amount: amountFloat,
      currency: 'USD',
      status: 'processing',
      stripeTransferId: transfer.id,
      stripeAccountId: user.stripeConnectAccountId,
      paymentMethod: 'stripe_connect',
      approvalHistory: [{
        action: 'transfer_initiated',
        at: new Date(),
        notes: `Stripe transfer ${transfer.id} initiated`
      }]
    }], { session });

    await WalletTransaction.create([{
      userId,
      type: 'DEBIT',
      amount: amountFloat,
      balance: newBalance,
      description: `Withdrawal to bank - Transfer ${transfer.id}`,
      reference: withdrawal[0]._id.toString(),
      metadata: {
        type: 'withdrawal',
        withdrawalId: withdrawal[0]._id,
        stripeTransferId: transfer.id,
        status: 'processing'
      }
    }], { session });

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: 'Withdrawal initiated. Funds will arrive in 1-2 business days.',
      data: {
        withdrawalId: withdrawal[0]._id,
        amount: amountFloat,
        stripeTransferId: transfer.id,
        status: 'processing',
        estimatedArrival: '1-2 business days'
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Withdrawal error:', error);

    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        success: false,
        message: 'Transfer failed: ' + error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Withdrawal failed'
    });
  } finally {
    session.endSession();
  }
};

// ==================== STEP 4: DEPOSIT - CREATE PAYMENT INTENT ====================
exports.createDepositIntent = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount < 10) {
      return res.status(400).json({
        success: false,
        message: 'Minimum deposit is $10'
      });
    }

    if (amount > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum deposit is $5000'
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      metadata: {
        userId: userId.toString(),
        type: 'wallet_deposit'
      }
    });

    return res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amount
    });

  } catch (error) {
    console.error('Create deposit intent error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== STEP 5: DEPOSIT - CONFIRM & ADD TO WALLET ====================
exports.confirmDeposit = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const { paymentIntentId, amount } = req.body;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: 'Payment not completed'
      });
    }

    let wallet = await Wallet.findOne({ userId }).session(session);
    if (!wallet) {
      wallet = await Wallet.create([{ userId, balance: 0 }], { session });
      wallet = wallet[0];
    }

    const newBalance = wallet.balance + amount;

    await Wallet.findByIdAndUpdate(
      wallet._id,
      { balance: newBalance, lastTransactionAt: new Date() },
      { session }
    );

    await WalletTransaction.create([{
      userId,
      type: 'CREDIT',
      amount: amount,
      balance: newBalance,
      description: `Deposit via Stripe - $${amount}`,
      reference: paymentIntentId,
      metadata: {
        type: 'deposit',
        paymentIntentId: paymentIntentId
      }
    }], { session });

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: 'Funds added successfully',
      newBalance: newBalance
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Confirm deposit error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
  }
};

// ==================== STEP 6: DEPOSIT - STRIPE CHECKOUT (Web Easy) ====================
exports.createDepositCheckout = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount < 10) {
      return res.status(400).json({
        success: false,
        message: 'Minimum deposit is $10'
      });
    }

    if (amount > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum deposit is $5000'
      });
    }

    const user = await User.findById(userId);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:50727';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Wallet Deposit',
              description: `Add $${amount} to your wallet`
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${frontendUrl}/#/wallet?deposit_success=${amount}`,
      cancel_url: `${frontendUrl}/#/wallet`,
      customer_email: user.email,
      metadata: {
        userId: userId.toString(),
        type: 'wallet_deposit',
        amount: amount.toString()
      }
    });

    return res.status(200).json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('Create deposit checkout error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== GET WITHDRAWAL HISTORY ====================
exports.getWithdrawalHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;

    const query = { userId };
    if (status && status !== 'all') query.status = status;

    const [withdrawals, total] = await Promise.all([
      Withdrawal.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .select('-approvalHistory'),
      Withdrawal.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        withdrawals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET WITHDRAWAL DETAILS ====================
exports.getWithdrawalDetails = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const userId = req.user.id;

    const withdrawal = await Withdrawal.findOne({ _id: withdrawalId, userId });

    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }

    let stripeStatus = null;
    if (withdrawal.stripeTransferId) {
      try {
        const transfer = await stripe.transfers.retrieve(withdrawal.stripeTransferId);
        stripeStatus = transfer.reversed ? 'reversed' : 'transferred';
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      data: { ...withdrawal.toObject(), stripeStatus }
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET PENDING (ADMIN) ====================
exports.getPendingWithdrawals = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const [withdrawals, total] = await Promise.all([
      Withdrawal.find({ status: 'processing' })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('userId', 'firstName lastName email stripeConnectAccountId'),
      Withdrawal.countDocuments({ status: 'processing' })
    ]);

    return res.status(200).json({
      success: true,
      data: { withdrawals, pagination: { page: parseInt(page), limit: parseInt(limit), total } }
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== MARK COMPLETED (ADMIN - backup) ====================
exports.markWithdrawalCompleted = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    await Withdrawal.findByIdAndUpdate(withdrawalId, {
      status: 'completed',
      completedAt: new Date()
    });
    return res.status(200).json({ success: true, message: 'Marked as completed' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== MARK FAILED (ADMIN - backup) ====================
exports.markWithdrawalFailed = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { withdrawalId } = req.params;
    const { failureReason } = req.body;

    const withdrawal = await Withdrawal.findByIdAndUpdate(
      withdrawalId,
      { status: 'failed', failureReason },
      { new: true, session }
    );

    if (withdrawal) {
      const wallet = await Wallet.findOne({ userId: withdrawal.userId }).session(session);
      if (wallet) {
        const newBalance = wallet.balance + withdrawal.amount;
        await Wallet.findByIdAndUpdate(wallet._id, { balance: newBalance }, { session });
        await WalletTransaction.create([{
          userId: withdrawal.userId,
          type: 'CREDIT',
          amount: withdrawal.amount,
          balance: newBalance,
          description: 'Withdrawal failed - Refund',
          reference: withdrawal._id.toString(),
          metadata: { type: 'withdrawal_failed_refund', withdrawalId: withdrawal._id }
        }], { session });
      }
    }

    await session.commitTransaction();
    return res.status(200).json({ success: true, message: 'Marked as failed and refunded' });
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

// ==================== STRIPE WEBHOOK ====================
exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        
        if (session.metadata?.type === 'wallet_deposit') {
          const userId = session.metadata.userId;
          const amount = parseFloat(session.metadata.amount);
          
          const wallet = await Wallet.findOne({ userId });
          if (wallet) {
            const newBalance = wallet.balance + amount;
            await Wallet.findByIdAndUpdate(wallet._id, {
              balance: newBalance,
              lastTransactionAt: new Date()
            });
            
            await WalletTransaction.create({
              userId,
              type: 'CREDIT',
              amount: amount,
              balance: newBalance,
              description: `Deposit via Stripe - $${amount}`,
              reference: session.id,
              metadata: {
                type: 'deposit',
                checkoutSessionId: session.id
              }
            });
          }
        }
        break;
      }

      case 'payout.paid': {
        const payout = event.data.object;
        const accountId = event.account;

        await Withdrawal.findOneAndUpdate(
          { stripeAccountId: accountId, status: 'processing' },
          {
            status: 'completed',
            completedAt: new Date(),
            $push: {
              approvalHistory: {
                action: 'payout_paid',
                at: new Date(),
                notes: `Payout ${payout.id} arrived in bank`
              }
            }
          }
        );
        break;
      }

      case 'payout.failed': {
        const payout = event.data.object;
        const accountId = event.account;

        const user = await User.findOne({ stripeConnectAccountId: accountId });
        if (!user) break;

        const withdrawal = await Withdrawal.findOneAndUpdate(
          { stripeAccountId: accountId, status: 'processing' },
          {
            status: 'failed',
            failureReason: payout.failure_message || 'Payout failed',
            $push: {
              approvalHistory: {
                action: 'payout_failed',
                at: new Date(),
                notes: payout.failure_message || 'Payout failed'
              }
            }
          },
          { new: true }
        );

        if (withdrawal) {
          const wallet = await Wallet.findOne({ userId: user._id });
          if (wallet) {
            const newBalance = wallet.balance + withdrawal.amount;
            await Wallet.findByIdAndUpdate(wallet._id, {
              balance: newBalance,
              lastTransactionAt: new Date()
            });
            await WalletTransaction.create({
              userId: user._id,
              type: 'CREDIT',
              amount: withdrawal.amount,
              balance: newBalance,
              description: `Withdrawal refunded - Payout failed`,
              reference: withdrawal._id.toString(),
              metadata: { type: 'withdrawal_failed_refund', withdrawalId: withdrawal._id }
            });
          }
        }
        break;
      }

      case 'account.updated': {
        const account = event.data.object;
        await User.findOneAndUpdate(
          { stripeConnectAccountId: account.id },
          {
            stripeConnectOnboarded: account.details_submitted,
            stripeConnectPayoutsEnabled: account.payouts_enabled
          }
        );
        break;
      }

      default:
        break;
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook handling error:', error);
    return res.status(500).json({ error: error.message });
  }
};