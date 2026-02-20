// controllers/wallet_controller.js
const mongoose = require('mongoose');
const { Wallet, WalletTransaction } = require('../models/Wallet');
const User = require('../models/user_model');

// ==================== GET WALLET BALANCE ====================
exports.getWalletBalance = async (req, res) => {
  try {
    const userId = req.user.id;

    let wallet = await Wallet.findOne({ userId });
    
    if (!wallet) {
      // Create wallet if doesn't exist
      wallet = await Wallet.create({
        userId,
        balance: 0
      });
    }

    return res.status(200).json({
      success: true,
      balance: wallet.balance,
      currency: wallet.currency,
      lastTransactionAt: wallet.lastTransactionAt
    });

  } catch (error) {
    console.error('Get wallet balance error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== GET TRANSACTION HISTORY ====================
exports.getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const transactions = await WalletTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await WalletTransaction.countDocuments({ userId });

    return res.status(200).json({
      success: true,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== ADD FUNDS TO WALLET ====================
exports.addFunds = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const { amount, paymentIntentId, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    // Get or create wallet
    let wallet = await Wallet.findOne({ userId }).session(session);
    
    if (!wallet) {
      wallet = await Wallet.create([{
        userId,
        balance: 0
      }], { session });
      wallet = wallet[0];
    }

    // Update balance
    const newBalance = wallet.balance + amount;
    
    await Wallet.findByIdAndUpdate(
      wallet._id,
      {
        balance: newBalance,
        lastTransactionAt: new Date()
      },
      { session }
    );

    // Create transaction record
    const transaction = await WalletTransaction.create([{
      userId,
      type: 'CREDIT',
      amount,
      balance: newBalance,
      description: description || 'Added funds to wallet',
      reference: paymentIntentId,
      metadata: {
        method: 'stripe',
        paymentIntentId
      }
    }], { session });

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: 'Funds added successfully',
      newBalance,
      transaction: transaction[0]
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Add funds error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  } finally {
    session.endSession();
  }
};

// ==================== WALLET PAYMENT ====================
exports.processWalletPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const { projectId, milestoneId, amount, description } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    // Get wallet
    const wallet = await Wallet.findOne({ userId }).session(session);
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    // Check sufficient balance
    if (wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance',
        currentBalance: wallet.balance,
        requiredAmount: amount
      });
    }

    // Calculate new balance
    const newBalance = wallet.balance - amount;

    // Update wallet balance
    await Wallet.findByIdAndUpdate(
      wallet._id,
      {
        balance: newBalance,
        lastTransactionAt: new Date()
      },
      { session }
    );

    // Create transaction record
    const transaction = await WalletTransaction.create([{
      userId,
      type: 'DEBIT',
      amount,
      balance: newBalance,
      description: description || `Payment for milestone`,
      reference: milestoneId || projectId,
      metadata: {
        projectId,
        milestoneId,
        paymentType: 'milestone'
      }
    }], { session });

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: 'Payment processed successfully',
      newBalance,
      transaction: transaction[0]
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Wallet payment error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  } finally {
    session.endSession();
  }
};