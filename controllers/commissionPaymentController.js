const User = require('../models/user_model');
const JobApplication = require('../models/JobApplication');
const JobPost = require('../models/jobpost');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ==================== CREATE COMMISSION PAYMENT INTENT ====================
exports.createCommissionPaymentIntent = async (req, res) => {
  try {
    const { applicationId } = req.body;
    const employerId = req.user.id;

    console.log(`🟡 Creating commission payment for application: ${applicationId}`);

    // Get application details
    const application = await JobApplication.findById(applicationId)
      .populate('jobId')
      .populate('employeeId');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Verify this application belongs to this employer
    if (application.employerId.toString() !== employerId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Check if already hired and paid
    if (application.status === 'hired' && application.hiringCommission?.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'This candidate is already hired'
      });
    }

    // Get job salary
    const job = application.jobId;
    const salaryAmount = job.salaryAmount || 0;
    
    // Calculate 20% commission
    const commissionAmount = Math.round(salaryAmount * 0.2 * 100); // Convert to cents/paise

    console.log(`💰 Job Salary: ${salaryAmount}, Commission (20%): ${commissionAmount/100}`);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: commissionAmount,
      currency: 'usd', // or 'inr', 'pkr' etc
      metadata: {
        type: 'hiring_commission',
        applicationId: applicationId,
        jobId: job._id.toString(),
        employeeId: application.employeeId._id.toString(),
        employerId: employerId,
        salaryAmount: salaryAmount.toString(),
        commissionAmount: commissionAmount.toString()
      }
    });

    return res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: commissionAmount,
      salaryAmount: salaryAmount,
      commissionAmount: commissionAmount
    });

  } catch (error) {
    console.error('❌ Error creating commission payment:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

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

    // Mark as hired with commission paid
    application.status = 'hired';
    application.hiringCommission = {
      salaryAmount: parseInt(paymentIntent.metadata.salaryAmount),
      commissionAmount: parseInt(paymentIntent.metadata.commissionAmount),
      commissionRate: 20,
      paymentStatus: 'paid',
      paidAt: new Date(),
      paymentId: paymentIntentId
    };
    
    await application.save();

    // Update job status (optional)
    await JobPost.findByIdAndUpdate(application.jobId, {
      status: 'filled',
      hiredEmployeeId: application.employeeId
    });

    console.log(`✅ Commission paid for application ${applicationId}`);
    console.log(`💰 Admin commission: ${paymentIntent.metadata.commissionAmount/100}`);

    return res.status(200).json({
      success: true,
      message: 'Payment verified and candidate hired successfully',
      application: application
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