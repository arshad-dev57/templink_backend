// controllers/milestone_payment_controller.js
const mongoose = require('mongoose');
const Stripe = require('stripe');
const Payment = require('../models/Payment');
const Project = require('../models/project');
const { Wallet, WalletTransaction } = require('../models/Wallet');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ==================== CREATE PAYMENT INTENT ====================
exports.createPaymentIntent = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, milestoneId, amount, paymentMethod } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    // Get project and milestone
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Verify employer owns this project
    if (project.postedBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You do not own this project'
      });
    }

    // Find milestone
    const milestone = project.milestones.id(milestoneId);
    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: 'Milestone not found'
      });
    }

    // Check if milestone is payable
    if (!project.isMilestonePayable(milestoneId)) {
      return res.status(400).json({
        success: false,
        message: 'Milestone is not payable at this time'
      });
    }

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        userId,
        projectId,
        milestoneId,
        milestoneTitle: milestone.title,
        projectTitle: project.title
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Save payment record
    const payment = await Payment.create({
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: amount,
      status: paymentIntent.status,
      userId,
      projectId,
      milestoneId,
      paymentMethod: paymentMethod || 'card',
      metadata: {
        milestoneTitle: milestone.title,
        projectTitle: project.title
      }
    });

    return res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      payment
    });

  } catch (error) {
    console.error('Create payment intent error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== VERIFY PAYMENT WITH RETRY LOGIC ====================
exports.verifyPayment = async (req, res) => {
  const MAX_RETRIES = 3;
  let retryCount = 0;
  
  while (retryCount < MAX_RETRIES) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' }
      });

      const userId = req.user.id;
      const { paymentIntentId, projectId, milestoneId } = req.body;

      console.log(`🔄 Payment verification attempt ${retryCount + 1}/${MAX_RETRIES}`);

      // Retrieve payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      // Find payment record
      const payment = await Payment.findOne({ paymentIntentId }).session(session);
      
      if (!payment) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Payment record not found'
        });
      }

      // Check if payment is successful
      if (paymentIntent.status !== 'succeeded') {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Payment not successful. Status: ${paymentIntent.status}`
        });
      }

      // Update payment status
      payment.status = 'succeeded';
      payment.receiptUrl = paymentIntent.charges?.data[0]?.receipt_url;
      await payment.save({ session });

      // Update project milestone status using updateOne to avoid version conflicts
      const paymentMethodFromPayment = payment.paymentMethod || 'CARD';
      const uppercasePaymentMethod = paymentMethodFromPayment.toUpperCase();
      
      const validPaymentMethods = ['WALLET', 'CARD', 'GOOGLE_PAY', 'APPLE_PAY'];
      const finalPaymentMethod = validPaymentMethods.includes(uppercasePaymentMethod) 
          ? uppercasePaymentMethod 
          : 'CARD';

      const updateResult = await Project.updateOne(
        { 
          _id: projectId,
          'milestones._id': milestoneId,
          'milestones.status': { $ne: 'FUNDED' } // Only update if not already funded
        },
        {
          $set: {
            'milestones.$.status': 'FUNDED',
            'milestones.$.fundedAt': new Date(),
            'milestones.$.paymentMethod': finalPaymentMethod,
            'milestones.$.paymentStatus': 'PAID',
            'milestones.$.paymentIntentId': paymentIntentId
          }
        },
        { session }
      );

      if (updateResult.modifiedCount === 0) {
        // Check if milestone is already funded
        const project = await Project.findById(projectId).session(session);
        const milestone = project?.milestones.id(milestoneId);
        
        if (milestone?.status === 'FUNDED') {
          await session.commitTransaction();
          return res.status(200).json({
            success: true,
            message: 'Payment already verified',
            milestone: {
              id: milestone._id,
              title: milestone.title,
              status: milestone.status,
              amount: milestone.amount,
              fundedAt: milestone.fundedAt
            }
          });
        }
      }

      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        milestone: {
          id: milestoneId,
          status: 'FUNDED',
          fundedAt: new Date()
        },
        payment: {
          id: payment._id,
          amount: payment.amount,
          receiptUrl: payment.receiptUrl
        }
      });

    } catch (error) {
      await session.abortTransaction();
      
      // Check if it's a write conflict error
      if (error.codeName === 'WriteConflict' || error.message.includes('WriteConflict')) {
        retryCount++;
        console.log(`⚠️ Write conflict detected, retrying (${retryCount}/${MAX_RETRIES})...`);
        
        // Exponential backoff
        if (retryCount < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retryCount)));
          session.endSession();
          continue;
        }
      }
      
      console.error('Verify payment error:', error);
      session.endSession();
      return res.status(500).json({
        success: false,
        message: error.message || 'Server error'
      });
    } finally {
      session.endSession();
    }
  }
  
  // If we've exhausted retries
  return res.status(500).json({
    success: false,
    message: 'Transaction failed after multiple retries. Please try again.'
  });
};

// ==================== PAY WITH WALLET WITH RETRY LOGIC ====================
exports.payWithWallet = async (req, res) => {
  const MAX_RETRIES = 3;
  let retryCount = 0;
  
  while (retryCount < MAX_RETRIES) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' }
      });

      const userId = req.user.id;
      const { projectId, milestoneId, amount } = req.body;

      console.log(`🔄 Wallet payment attempt ${retryCount + 1}/${MAX_RETRIES}`);

      // Validate amount
      if (!amount || amount <= 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Invalid amount'
        });
      }

      // Get project and milestone
      const project = await Project.findById(projectId).session(session);
      if (!project) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      // Verify employer owns this project
      if (project.postedBy.toString() !== userId) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: You do not own this project'
        });
      }

      const milestone = project.milestones.id(milestoneId);
      if (!milestone) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Milestone not found'
        });
      }

      // Check if milestone is already funded
      if (milestone.status === 'FUNDED') {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Milestone is already funded'
        });
      }

      // Check if milestone is payable
      if (!project.isMilestonePayable(milestoneId)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Milestone is not payable at this time'
        });
      }

      // Get wallet
      const wallet = await Wallet.findOne({ userId }).session(session);
      
      if (!wallet) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Wallet not found'
        });
      }

      // Check balance
      if (wallet.balance < amount) {
        await session.abortTransaction();
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
      wallet.balance = newBalance;
      wallet.lastTransactionAt = new Date();
      await wallet.save({ session });

      // Create wallet transaction
      const transaction = await WalletTransaction.create([{
        userId,
        type: 'DEBIT',
        amount,
        balance: newBalance,
        description: `Payment for milestone: ${milestone.title} in project: ${project.title}`,
        reference: milestoneId,
        metadata: {
          projectId,
          milestoneId,
          projectTitle: project.title,
          milestoneTitle: milestone.title,
          paymentType: 'milestone'
        }
      }], { session });

      // Update milestone using updateOne to avoid version conflicts
      const updateResult = await Project.updateOne(
        { 
          _id: projectId,
          'milestones._id': milestoneId,
          'milestones.status': { $ne: 'FUNDED' }
        },
        {
          $set: {
            'milestones.$.status': 'FUNDED',
            'milestones.$.fundedAt': new Date(),
            'milestones.$.paymentMethod': 'WALLET',
            'milestones.$.paymentStatus': 'PAID',
            'milestones.$.walletTransactionId': transaction[0]._id
          }
        },
        { session }
      );

      if (updateResult.modifiedCount === 0) {
        throw new Error('Failed to update milestone - may already be updated');
      }

      // Create payment record
      const payment = await Payment.create([{
        paymentIntentId: `wallet_${Date.now()}_${userId}`,
        amount,
        status: 'succeeded',
        userId,
        projectId,
        milestoneId,
        paymentMethod: 'wallet',
        metadata: {
          milestoneTitle: milestone.title,
          projectTitle: project.title,
          transactionId: transaction[0]._id
        }
      }], { session });

      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: 'Payment successful using wallet',
        newBalance,
        milestone: {
          id: milestone._id,
          title: milestone.title,
          status: 'FUNDED',
          amount: milestone.amount,
          fundedAt: new Date()
        },
        payment: payment[0],
        transaction: transaction[0]
      });

    } catch (error) {
      await session.abortTransaction();
      
      if (error.codeName === 'WriteConflict' || error.message.includes('WriteConflict')) {
        retryCount++;
        console.log(`⚠️ Write conflict detected in wallet payment, retrying (${retryCount}/${MAX_RETRIES})...`);
        
        if (retryCount < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retryCount)));
          session.endSession();
          continue;
        }
      }
      
      console.error('Wallet payment error:', error);
      session.endSession();
      return res.status(500).json({
        success: false,
        message: error.message || 'Server error'
      });
    } finally {
      session.endSession();
    }
  }
  
  return res.status(500).json({
    success: false,
    message: 'Transaction failed after multiple retries. Please try again.'
  });
};

// ==================== GET PAYMENT HISTORY ====================
exports.getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, page = 1, limit = 20 } = req.query;

    let query = { userId };
    if (projectId) {
      query.projectId = projectId;
    }

    const payments = await Payment.find(query)
      .populate('projectId', 'title')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(query);

    return res.status(200).json({
      success: true,
      payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get payment history error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== GET MILESTONE PAYMENT STATUS ====================
exports.getMilestonePaymentStatus = async (req, res) => {
  try {
    const { projectId, milestoneId } = req.params;
    const userId = req.user.id;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Check if user is authorized (employer of this project)
    if (project.postedBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const milestone = project.milestones.id(milestoneId);
    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: 'Milestone not found'
      });
    }

    // Find payment records
    const payments = await Payment.find({
      projectId,
      milestoneId,
      userId
    }).sort({ createdAt: -1 });

    // Find wallet transaction if exists
    let walletTransaction = null;
    if (milestone.walletTransactionId) {
      walletTransaction = await WalletTransaction.findById(milestone.walletTransactionId);
    }

    return res.status(200).json({
      success: true,
      milestone: {
        id: milestone._id,
        title: milestone.title,
        status: milestone.status,
        amount: milestone.amount,
        fundedAt: milestone.fundedAt,
        paymentMethod: milestone.paymentMethod,
        paymentStatus: milestone.paymentStatus,
        isPayable: project.isMilestonePayable ? project.isMilestonePayable(milestoneId) : false
      },
      payments,
      walletTransaction
    });

  } catch (error) {
    console.error('Get milestone payment status error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};