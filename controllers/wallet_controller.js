  const mongoose = require('mongoose');
  const { Wallet, WalletTransaction } = require('../models/Wallet');
  const User = require('../models/user_model');
  const Withdrawal = require('../models/Withdrawal');

  // ==================== GET WALLET BALANCE ====================
  exports.getWalletBalance = async (req, res) => {
    try {
      const userId = req.user.id;

      let wallet = await Wallet.findOne({ userId });
      
      if (!wallet) {
        wallet = await Wallet.create({
          userId,
          balance: 0
        });
      }
      
      // Get user for Stripe Connect status
      const user = await User.findById(userId).select('stripeConnectOnboarded stripeConnectAccountId');

      return res.status(200).json({
        success: true,
        balance: wallet.balance,
        currency: wallet.currency,
        lastTransactionAt: wallet.lastTransactionAt,
        stripeConnected: user?.stripeConnectOnboarded || false,
        stripeAccountId: user?.stripeConnectAccountId
      });

    } catch (error) {
      console.error('Get wallet balance error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Server error'
      });
    }
  };

  // ==================== GET WALLET DETAILS (Enhanced) ====================
  exports.getWalletDetails = async (req, res) => {
    try {
      const userId = req.user.id;
      
      // Get wallet
      let wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        wallet = await Wallet.create({ userId, balance: 0 });
      }
      
      // Get user for Stripe Connect status
      const user = await User.findById(userId).select(
        'stripeConnectOnboarded stripeConnectAccountId stripeConnectPayoutsEnabled'
      );
      
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
      
      // Get today's withdrawal total
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayWithdrawals = await Withdrawal.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
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
            minimum: 10,
            maximum: 5000,
            fee: '0.25%',
            dailyLimit: 10000
          },
          stripeConnected: user?.stripeConnectOnboarded || false,
          stripePayoutsEnabled: user?.stripeConnectPayoutsEnabled || false,
          lastTransactionAt: wallet.lastTransactionAt,
          recentTransactions
        }
      });

    } catch (error) {
      console.error('Get wallet details error:', error);
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
      
      // Enhance transactions with withdrawal status
      const enhancedTransactions = await Promise.all(transactions.map(async (t) => {
        if (t.metadata?.type === 'withdrawal_request' && t.metadata?.withdrawalId) {
          const withdrawal = await Withdrawal.findById(t.metadata.withdrawalId).select('status stripeTransferId');
          return {
            ...t.toObject(),
            withdrawalStatus: withdrawal?.status,
            withdrawalId: t.metadata?.withdrawalId,
            transferId: withdrawal?.stripeTransferId
          };
        }
        return t;
      }));

      return res.status(200).json({
        success: true,
        transactions: enhancedTransactions,
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

  // ==================== WALLET PAYMENT (Debit) ====================
  exports.processWalletPayment = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const userId = req.user.id;
      const { projectId, milestoneId, amount, description } = req.body;

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

  // ==================== GET PENDING WITHDRAWALS (Admin) ====================
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
      console.error('Get pending withdrawals error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Server error'
      });
    }
  };