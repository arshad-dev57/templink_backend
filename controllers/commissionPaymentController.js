const JobApplication = require('../models/JobApplication');
const JobPost = require('../models/jobpost');
const User = require('../models/user_model');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ============== HELPER: Add to Team Members ==============
async function addToTeamMembers(employerId, employeeId, jobId, applicationId, jobTitle, hiredAt, commissionPaid = 0, isFreeHire = false) {
  try {
    const employer = await User.findById(employerId);
    if (!employer || employer.role !== 'employer') return;

    // Initialize employerProfile if needed
    if (!employer.employerProfile) {
      employer.employerProfile = {};
    }
    if (!employer.employerProfile.teamMembers) {
      employer.employerProfile.teamMembers = [];
    }

    // Check if already in team (avoid duplicates)
    const existingMember = employer.employerProfile.teamMembers.find(
      member => member.employeeId.toString() === employeeId.toString() && 
                member.jobId.toString() === jobId.toString() &&
                member.status === 'active'
    );

    if (!existingMember) {
      // Add to team members
      employer.employerProfile.teamMembers.push({
        employeeId: employeeId,
        jobId: jobId,
        applicationId: applicationId,
        jobTitle: jobTitle,
        hiredAt: hiredAt,
        status: 'active',
        commissionPaid: commissionPaid,
        isFreeHire: isFreeHire
      });

      // Update stats
      employer.employerProfile.totalHires = (employer.employerProfile.totalHires || 0) + 1;
      employer.employerProfile.activeEmployees = (employer.employerProfile.activeEmployees || 0) + 1;

      await employer.save();
      console.log(`✅ Added employee ${employeeId} to team members of employer ${employerId}`);
    }

    // Also add to employee's myEmployers list
    const employee = await User.findById(employeeId);
    if (employee) {
      if (!employee.myEmployers) employee.myEmployers = [];
      
      const existingEmployer = employee.myEmployers.find(
        e => e.employerId.toString() === employerId.toString() && 
             e.jobId.toString() === jobId.toString() &&
             e.status === 'active'
      );

      if (!existingEmployer) {
        employee.myEmployers.push({
          employerId: employerId,
          jobId: jobId,
          jobTitle: jobTitle,
          hiredAt: hiredAt,
          status: 'active'
        });
        await employee.save();
      }
    }

  } catch (error) {
    console.error('Error adding to team members:', error);
  }
}
// ============== CREATE COMMISSION PAYMENT (WITH EMPLOYER LEVEL PROTECTION) ==============
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

    // Check if already hired
    if (application.status === 'hired') {
      return res.status(400).json({
        success: false,
        message: 'This candidate is already hired'
      });
    }

    const job = application.jobId;
    const now = new Date();

    // ✅ CHECK EMPLOYER LEVEL PROTECTION FIRST
    const employer = await User.findById(employerId);
    let isFreeHire = false;
    let commissionAmount = 0;

    if (employer?.employerProfile?.protection?.isActive && 
        employer.employerProfile.protection.expiryDate > now &&
        employer.employerProfile.protection.remainingHires > 0) {
      
      // ✅ FREE HIRE - No commission
      isFreeHire = true;
      commissionAmount = 0;
      
      console.log('🎉 FREE HIRE! Employer level protection active. No commission.');
      
      // Decrement remaining hires
      employer.employerProfile.protection.remainingHires -= 1;
      if (employer.employerProfile.protection.remainingHires <= 0) {
        employer.employerProfile.protection.isActive = false;
      }
      await employer.save();
      
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
      await job.save();

      // Add to team members
      await addToTeamMembers(
        employerId,
        application.employeeId,
        job._id,
        application._id,
        job.title,
        now,
        0,
        true
      );

      return res.status(200).json({
        success: true,
        isFreeHire: true,
        message: 'Employer protection active! Candidate hired without commission.',
        remainingHires: employer.employerProfile.protection.remainingHires,
        application: application
      });
    }

    // ✅ NORMAL HIRE - Calculate 20% commission
    const salaryAmount = job.salaryAmount || 5000;
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
    application.employmentStatus = 'active';
    
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

    // ✅ ADD TO TEAM MEMBERS
    await addToTeamMembers(
      employerId,
      application.employeeId,
      job._id,
      application._id,
      job.title,
      now,
      parseInt(paymentIntent.metadata.commissionAmount),
      false
    );

    console.log(`✅ Commission paid for application ${applicationId} and added to team`);

    return res.status(200).json({
      success: true,
      message: 'Payment verified, candidate hired successfully and added to team',
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