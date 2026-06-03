const mongoose = require('mongoose');
const { Wallet, WalletTransaction } = require('../models/Wallet');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/user_model');

// ==================== REQUEST WITHDRAWAL ====================
exports.requestWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const { 
      amount, 
      bankName, 
      accountNumber, 
      accountName, 
      routingNumber,
      iban,
      swiftCode,
      bankAddress,
      accountType 
    } = req.body;

    console.log(`🟡 Withdrawal request from user ${userId}`);
    console.log(`   Amount: $${amount}`);

    // Validation
    const MIN_WITHDRAWAL = 50;
    const WITHDRAWAL_FEE = 2;
    const MAX_WITHDRAWAL = 5000;
    
    if (amount < MIN_WITHDRAWAL) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is $${MIN_WITHDRAWAL}`
      });
    }
    
    if (amount > MAX_WITHDRAWAL) {
      return res.status(400).json({
        success: false,
        message: `Maximum withdrawal amount per request is $${MAX_WITHDRAWAL}`
      });
    }

    // Get wallet
    let wallet = await Wallet.findOne({ userId }).session(session);
    
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

    // Check daily withdrawal limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayWithdrawals = await Withdrawal.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(userId),
          createdAt: { $gte: today },
          status: { $nin: ['cancelled', 'failed'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    const dailyTotal = todayWithdrawals.length > 0 ? todayWithdrawals[0].total : 0;
    const DAILY_LIMIT = 10000;
    
    if (dailyTotal + amount > DAILY_LIMIT) {
      return res.status(400).json({
        success: false,
        message: `Daily withdrawal limit is $${DAILY_LIMIT}. You have $${dailyTotal} already withdrawn today.`
      });
    }

    // Validate bank details
    if (!bankName || !accountNumber || !accountName) {
      return res.status(400).json({
        success: false,
        message: 'Bank name, account number, and account name are required'
      });
    }

    // Calculate fee and net amount
    const fee = WITHDRAWAL_FEE;
    const netAmount = amount - fee;
    const newBalance = wallet.balance - amount;

    // Create withdrawal request
    const withdrawal = new Withdrawal({
      userId,
      amount,
      fee,
      netAmount,
      currency: 'USD',
      paymentMethod: 'bank_transfer',
      bankName,
      accountNumber,
      accountName,
      routingNumber: routingNumber || '',
      iban: iban || '',
      swiftCode: swiftCode || '',
      bankAddress: bankAddress || '',
      accountType: accountType || 'checking',
      status: 'pending',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      approvalHistory: [{
        action: 'requested',
        at: new Date(),
        notes: 'Withdrawal requested by user'
      }]
    });

    await withdrawal.save({ session });

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
    await WalletTransaction.create([{
      userId,
      type: 'DEBIT',
      amount: amount,
      balance: newBalance,
      description: `Withdrawal request #${withdrawal._id} - Pending`,
      reference: withdrawal._id.toString(),
      metadata: {
        type: 'withdrawal_request',
        withdrawalId: withdrawal._id,
        fee: fee,
        netAmount: netAmount,
        status: 'pending'
      }
    }], { session });

    await session.commitTransaction();

    console.log(`✅ Withdrawal request created: ${withdrawal._id}`);

    return res.status(200).json({
      success: true,
      message: 'Withdrawal request submitted successfully. Admin will review and process within 24-48 hours.',
      data: {
        withdrawalId: withdrawal._id,
        amount: amount,
        fee: fee,
        netAmount: netAmount,
        status: 'pending',
        estimatedProcessingDays: 2
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('❌ Withdrawal request error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  } finally {
    session.endSession();
  }
};

// ==================== GET WITHDRAWAL HISTORY ====================
exports.getWithdrawalHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;

    const query = { userId };
    if (status && status !== 'all') {
      query.status = status;
    }

    const withdrawals = await Withdrawal.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-approvalHistory'); // Exclude history for performance

    const total = await Withdrawal.countDocuments(query);

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
    console.error('❌ Get withdrawal history error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== GET WITHDRAWAL DETAILS ====================
exports.getWithdrawalDetails = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const userId = req.user.id;

    const withdrawal = await Withdrawal.findOne({ _id: withdrawalId, userId });

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: withdrawal
    });

  } catch (error) {
    console.error('❌ Get withdrawal details error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== CANCEL WITHDRAWAL ====================
exports.cancelWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { withdrawalId } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    const withdrawal = await Withdrawal.findOne({ _id: withdrawalId, userId }).session(session);

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel withdrawal in ${withdrawal.status} status`
      });
    }

    // Get wallet
    const wallet = await Wallet.findOne({ userId }).session(session);

    if (wallet) {
      // Refund the amount back to wallet
      const newBalance = wallet.balance + withdrawal.amount;
      
      await Wallet.findByIdAndUpdate(
        wallet._id,
        {
          balance: newBalance,
          lastTransactionAt: new Date()
        },
        { session }
      );

      // Create refund transaction
      await WalletTransaction.create([{
        userId,
        type: 'CREDIT',
        amount: withdrawal.amount,
        balance: newBalance,
        description: `Withdrawal cancelled - Refund #${withdrawal._id}`,
        reference: withdrawal._id.toString(),
        metadata: {
          type: 'withdrawal_cancellation',
          withdrawalId: withdrawal._id,
          reason: reason || 'User cancelled'
        }
      }], { session });
    }

    // Update withdrawal status
    withdrawal.status = 'cancelled';
    withdrawal.cancelledAt = new Date();
    withdrawal.cancellationReason = reason || 'User cancelled';
    withdrawal.approvalHistory.push({
      action: 'cancelled_by_user',
      at: new Date(),
      notes: reason || 'User cancelled'
    });
    
    await withdrawal.save({ session });

    await session.commitTransaction();

    console.log(`✅ Withdrawal cancelled: ${withdrawalId}`);

    return res.status(200).json({
      success: true,
      message: 'Withdrawal cancelled successfully. Amount refunded to wallet.'
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('❌ Cancel withdrawal error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  } finally {
    session.endSession();
  }
};

// ==================== GET WALLET DETAILS ====================
exports.getWalletDetails = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get wallet
    let wallet = await Wallet.findOne({ userId });
    
    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        balance: 0,
        currency: 'USD'
      });
    }

    // Get pending withdrawals
    const pendingWithdrawals = await Withdrawal.find({
      userId,
      status: { $in: ['pending', 'processing'] }
    }).select('amount status createdAt');

    // Get recent transactions
    const recentTransactions = await WalletTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);

    // Calculate total pending amount
    const pendingAmount = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0);

    // Get today's withdrawal total for limit check
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayWithdrawals = await Withdrawal.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(userId),
          createdAt: { $gte: today },
          status: { $nin: ['cancelled', 'failed'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    const dailyWithdrawn = todayWithdrawals.length > 0 ? todayWithdrawals[0].total : 0;

    return res.status(200).json({
      success: true,
      data: {
        balance: wallet.balance,
        currency: wallet.currency,
        availableBalance: wallet.balance - pendingAmount,
        pendingWithdrawals: pendingAmount,
        pendingWithdrawalsCount: pendingWithdrawals.length,
        dailyWithdrawn: dailyWithdrawn,
        dailyLimit: 10000,
        withdrawalLimits: {
          minimum: 50,
          maximum: 5000,
          fee: 2,
          dailyLimit: 10000
        },
        lastTransactionAt: wallet.lastTransactionAt,
        recentTransactions
      }
    });

  } catch (error) {
    console.error('❌ Get wallet details error:', error);
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
    const { page = 1, limit = 20, type } = req.query;

    const query = { userId };
    if (type && type !== 'all') {
      query.type = type;
    }

    const transactions = await WalletTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await WalletTransaction.countDocuments(query);

    // Also include withdrawal status for withdrawal-related transactions
    const enhancedTransactions = await Promise.all(transactions.map(async (t) => {
      if (t.metadata?.type === 'withdrawal_request' && t.metadata?.withdrawalId) {
        const withdrawal = await Withdrawal.findById(t.metadata.withdrawalId).select('status');
        return {
          ...t.toObject(),
          withdrawalStatus: withdrawal?.status
        };
      }
      return t;
    }));

    return res.status(200).json({
      success: true,
      data: {
        transactions: enhancedTransactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('❌ Get transaction history error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== ADMIN: GET ALL WITHDRAWALS (Pending) ====================
exports.getPendingWithdrawals = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const withdrawals = await Withdrawal.find({ status: 'pending' })
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('userId', 'firstName lastName email');

    const total = await Withdrawal.countDocuments({ status: 'pending' });

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
    console.error('❌ Get pending withdrawals error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== ADMIN: PROCESS/MARK WITHDRAWAL AS COMPLETED ====================
exports.markWithdrawalCompleted = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { withdrawalId } = req.params;
    const { transactionReference, adminNotes } = req.body;
    const adminId = req.user.id;

    const withdrawal = await Withdrawal.findById(withdrawalId).session(session);

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot process withdrawal with status: ${withdrawal.status}`
      });
    }

    // Update withdrawal
    withdrawal.status = 'completed';
    withdrawal.processedBy = adminId;
    withdrawal.processedAt = new Date();
    withdrawal.completedAt = new Date();
    withdrawal.transactionReference = transactionReference;
    withdrawal.adminNotes = adminNotes || '';
    withdrawal.approvalHistory.push({
      action: 'completed_by_admin',
      by: adminId,
      at: new Date(),
      notes: `Processed. Reference: ${transactionReference || 'N/A'}`
    });

    await withdrawal.save({ session });

    // Update transaction status
    await WalletTransaction.findOneAndUpdate(
      { reference: withdrawalId.toString() },
      { 
        $set: { 
          'metadata.status': 'completed',
          description: `Withdrawal #${withdrawalId} - Completed`
        }
      },
      { session }
    );

    await session.commitTransaction();

    console.log(`✅ Withdrawal marked as completed: ${withdrawalId}`);

    return res.status(200).json({
      success: true,
      message: 'Withdrawal marked as completed'
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('❌ Mark withdrawal completed error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  } finally {
    session.endSession();
  }
};

// ==================== ADMIN: MARK WITHDRAWAL AS FAILED ====================
exports.markWithdrawalFailed = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { withdrawalId } = req.params;
    const { failureReason, adminNotes } = req.body;
    const adminId = req.user.id;

    const withdrawal = await Withdrawal.findById(withdrawalId).session(session);

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot process withdrawal with status: ${withdrawal.status}`
      });
    }

    // Refund amount back to wallet
    const wallet = await Wallet.findOne({ userId: withdrawal.userId }).session(session);
    
    if (wallet) {
      const newBalance = wallet.balance + withdrawal.amount;
      await Wallet.findByIdAndUpdate(
        wallet._id,
        {
          balance: newBalance,
          lastTransactionAt: new Date()
        },
        { session }
      );

      // Create refund transaction
      await WalletTransaction.create([{
        userId: withdrawal.userId,
        type: 'CREDIT',
        amount: withdrawal.amount,
        balance: newBalance,
        description: `Withdrawal #${withdrawal._id} failed - Refund`,
        reference: withdrawal._id.toString(),
        metadata: {
          type: 'withdrawal_failed',
          withdrawalId: withdrawal._id,
          reason: failureReason
        }
      }], { session });
    }

    // Update withdrawal
    withdrawal.status = 'failed';
    withdrawal.failureReason = failureReason;
    withdrawal.adminNotes = adminNotes || '';
    withdrawal.approvalHistory.push({
      action: 'failed_by_admin',
      by: adminId,
      at: new Date(),
      notes: failureReason
    });

    await withdrawal.save({ session });

    await session.commitTransaction();

    console.log(`✅ Withdrawal marked as failed: ${withdrawalId}`);

    return res.status(200).json({
      success: true,
      message: 'Withdrawal marked as failed and amount refunded'
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('❌ Mark withdrawal failed error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  } finally {
    session.endSession();
  }
};