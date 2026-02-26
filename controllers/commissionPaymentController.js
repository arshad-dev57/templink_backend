const User = require('../models/user_model');
const JobApplication = require('../models/JobApplication');
const JobPost = require('../models/jobpost');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
// ==================== CREATE COMMISSION PAYMENT INTENT ====================
// ==================== CREATE COMMISSION PAYMENT INTENT ====================
exports.createCommissionPaymentIntent = async (req, res) => {
  try {
    const { applicationId, staticAmount, useStatic } = req.body;  // 👈 1. Add these
    const employerId = req.user.id;

    // Get application and job details
    const application = await JobApplication.findById(applicationId)
      .populate('jobId');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    let commissionAmount;

    // 👇 2. Check if using static amount for testing
    if (useStatic && staticAmount) {
      commissionAmount = staticAmount;
      console.log('🧪 TEST MODE: Using static amount:', commissionAmount);
      console.log('💰 Static Amount (cents):', commissionAmount);
    } else {
      // Get job salary
      const job = application.jobId;
      const salaryAmount = job.salaryAmount || 0;
      
      // Calculate 20% commission
      commissionAmount = Math.round(salaryAmount * 0.2 * 100);
      
      console.log('💰 Normal Mode - Salary:', salaryAmount);
      console.log('💰 Commission (20%):', commissionAmount / 100);
    }

    console.log('💰 Stripe Amount (cents):', commissionAmount);
    console.log('💰 Type:', typeof commissionAmount);

    // ✅ Ensure it's a valid integer
    if (isNaN(commissionAmount) || commissionAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid commission amount'
      });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: commissionAmount,
      currency: 'usd',
      metadata: {
        type: 'hiring_commission',
        applicationId: applicationId,
        jobId: application.jobId._id.toString(),
        employerId: employerId,
        salaryAmount: (application.jobId.salaryAmount || 0).toString(),
        commissionAmount: commissionAmount.toString(),
        isTest: useStatic ? 'true' : 'false'  // 👈 3. Add test flag
      }
    });

    return res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: commissionAmount,
      salaryAmount: application.jobId.salaryAmount || 0,
      commissionAmount: commissionAmount
    });

  } catch (error) {
    console.error('❌ Error creating commission payment:', error);
    
    if (error.type === 'StripeInvalidRequestError') {
      console.error('Stripe Error Details:', {
        message: error.message,
        param: error.param,
        code: error.code
      });
    }
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      details: error.param === 'amount' ? 'Invalid amount format' : undefined
    });
  }
};
// ==================== VERIFY COMMISSION PAYMENT ====================
// ==================== VERIFY COMMISSION PAYMENT ====================
exports.verifyCommissionPayment = async (req, res) => {
  try {
    const { paymentIntentId, applicationId } = req.body;
    const employerId = req.user.id;

    console.log(`🟡 Verifying commission payment: ${paymentIntentId}`);

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: 'Payment not successful'
      });
    }

    // Verify metadata
    if (paymentIntent.metadata.applicationId !== applicationId ||
        paymentIntent.metadata.employerId !== employerId) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    // Update application
    const application = await JobApplication.findById(applicationId);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // 👇 Check if this was a test payment
    const isTest = paymentIntent.metadata.isTest === 'true';
    
    // Mark as hired with commission paid
    application.status = 'hired';
    application.hiringCommission = {
      salaryAmount: isTest ? 0 : parseInt(paymentIntent.metadata.salaryAmount), // Test mode mein salary 0
      commissionAmount: parseInt(paymentIntent.metadata.commissionAmount),
      commissionRate: 20,
      paymentStatus: 'paid',
      paidAt: new Date(),
      paymentId: paymentIntentId,
      isTest: isTest  // Optional: track test payments
    };
    
    await application.save();

    // Update job status (only if not test mode)
    if (!isTest) {
      await JobPost.findByIdAndUpdate(application.jobId, {
        status: 'filled',
        hiredEmployeeId: application.employeeId
      });
    } else {
      console.log('🧪 TEST MODE: Not updating job status');
    }

    console.log(`✅ Commission paid for application ${applicationId}`);
    console.log(`💰 Admin commission: ${paymentIntent.metadata.commissionAmount/100}`);
    if (isTest) console.log('🧪 This was a TEST payment');

    return res.status(200).json({
      success: true,
      message: 'Payment verified and candidate hired successfully',
      isTest: isTest
    });

  } catch (error) {
    console.error('❌ Error verifying commission payment:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};
// ==================== GET COMMISSION HISTORY (for admin) ====================
exports.getCommissionHistory = async (req, res) => {
  try {
    // Only admin can access this
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const applications = await JobApplication.find({
      'hiringCommission.paymentStatus': 'paid'
    })
    .populate('jobId', 'title salaryAmount')
    .populate('employeeId', 'firstName lastName email')
    .populate('employerId', 'firstName lastName email employerProfile.companyName')
    .sort({ 'hiringCommission.paidAt': -1 });

    const totalCommission = applications.reduce((sum, app) => {
      return sum + (app.hiringCommission?.commissionAmount || 0);
    }, 0);

    return res.status(200).json({
      success: true,
      totalCommission: totalCommission / 100, // Convert back from cents
      count: applications.length,
      data: applications.map(app => ({
        id: app._id,
        jobTitle: app.jobId?.title,
        salaryAmount: app.hiringCommission?.salaryAmount,
        commissionAmount: app.hiringCommission?.commissionAmount / 100,
        paidAt: app.hiringCommission?.paidAt,
        employeeName: `${app.employeeId?.firstName} ${app.employeeId?.lastName}`,
        employerName: app.employerId?.employerProfile?.companyName || 
                     `${app.employerId?.firstName} ${app.employerId?.lastName}`
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching commission history:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};