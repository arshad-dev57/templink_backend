const JobApplication = require('../models/JobApplication');
const JobPost = require('../models/jobpost');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ============== CREATE COMMISSION PAYMENT (WITH PROTECTION CHECK) ==============
exports.createCommissionPaymentIntent = async (req, res) => {
  try {
    const { applicationId } = req.body;
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

    // ✅ Check if already hired
    if (application.status === 'hired') {
      return res.status(400).json({
        success: false,
        message: 'This candidate is already hired'
      });
    }

    const job = application.jobId;
    const now = new Date();

    // ✅ CHECK PROTECTION STATUS FIRST
    let commissionAmount = 0;
    let isFreeHire = false;

    // Check if job has active protection
    if (job.protection?.isActive && job.protection?.expiryDate > now) {
      // ✅ FREE HIRE - No commission
      isFreeHire = true;
      commissionAmount = 0;
      
      console.log('🎉 FREE HIRE! Job under protection. No commission.');
      
      // Mark application as hired directly
      application.status = 'hired';
      application.hiredAt = now;
      application.hiringCommission = {
        salaryAmount: job.salaryAmount || 0,
        commissionAmount: 0,
        commissionRate: 20,
        paymentStatus: 'free_hire_protection',
        paidAt: now,
        isFreeHire: true
      };
      
      await application.save();

      // Add to hire history
      if (!job.hireHistory) job.hireHistory = [];
      job.hireHistory.push({
        applicationId: application._id,
        employeeId: application.employeeId,
        hiredAt: now,
        commissionPaid: 0,
        protectionUsed: true
      });

      // ✅ DEACTIVATE PROTECTION (used up)
      job.protection.isActive = false;
      await job.save();

      return res.status(200).json({
        success: true,
        isFreeHire: true,
        message: 'Job under protection. Candidate hired without commission.',
        application: application
      });
    }

    // ✅ NORMAL HIRE - Calculate 20% commission
    const salaryAmount = job.salaryAmount || 5000; // Default if not set
    commissionAmount = Math.round(salaryAmount * 0.2 * 100); // Convert to cents

    console.log('💰 Normal hire - Salary:', salaryAmount);
    console.log('💰 Commission (20%):', commissionAmount / 100);

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
        jobId: job._id.toString(),
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
      commissionAmount: commissionAmount,
      isFreeHire: false
    });

  } catch (error) {
    console.error('❌ Error creating commission payment:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============== VERIFY COMMISSION PAYMENT ==============
exports.verifyCommissionPayment = async (req, res) => {
  try {
    const { paymentIntentId, applicationId } = req.body;
    const employerId = req.user.id;

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

    const now = new Date();

    // Mark as hired with commission paid
    application.status = 'hired';
    application.hiredAt = now;
    application.hiringCommission = {
      salaryAmount: parseInt(paymentIntent.metadata.salaryAmount),
      commissionAmount: parseInt(paymentIntent.metadata.commissionAmount),
      commissionRate: 20,
      paymentStatus: 'paid',
      paidAt: now,
      paymentId: paymentIntentId
    };
    application.employmentStatus = 'active'; // Add this field
    
    await application.save();

    // Add to job hire history
    const job = await JobPost.findById(application.jobId);
    if (job) {
      if (!job.hireHistory) job.hireHistory = [];
      job.hireHistory.push({
        applicationId: application._id,
        employeeId: application.employeeId,
        hiredAt: now,
        commissionPaid: parseInt(paymentIntent.metadata.commissionAmount),
        protectionUsed: false
      });
      await job.save();
    }

    console.log(`✅ Commission paid for application ${applicationId}`);

    return res.status(200).json({
      success: true,
      message: 'Payment verified and candidate hired successfully',
      application: application
    });

  } catch (error) {
    console.error('❌ Error verifying commission payment:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
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