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
    if (!employer.employerProfile.stats) {
      employer.employerProfile.stats = {
        totalHires: 0,
        activeEmployees: 0,
        totalFreeHiresUsed: 0,
        totalCommissionPaid: 0,
        averageEmployeeTenure: 0
      };
    }

    // Check if already in team (avoid duplicates)
    const existingMember = employer.employerProfile.teamMembers.find(
      member => member.employeeId && 
                member.employeeId.toString() === employeeId.toString() && 
                member.jobId && member.jobId.toString() === jobId.toString() &&
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
      employer.employerProfile.stats.totalHires = (employer.employerProfile.stats.totalHires || 0) + 1;
      employer.employerProfile.stats.activeEmployees = (employer.employerProfile.stats.activeEmployees || 0) + 1;
      
      if (!isFreeHire) {
        employer.employerProfile.stats.totalCommissionPaid = (employer.employerProfile.stats.totalCommissionPaid || 0) + commissionPaid;
      } else {
        employer.employerProfile.stats.totalFreeHiresUsed = (employer.employerProfile.stats.totalFreeHiresUsed || 0) + 1;
      }

      await employer.save();
      console.log(`✅ Added employee ${employeeId} to team members of employer ${employerId}`);
    }

    // Also add to employee's myEmployers list
    const employee = await User.findById(employeeId);
    if (employee) {
      if (!employee.myEmployers) employee.myEmployers = [];
      
      const existingEmployer = employee.myEmployers.find(
        e => e.employerId && e.employerId.toString() === employerId.toString() && 
             e.jobId && e.jobId.toString() === jobId.toString() &&
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
    console.error('❌ Error adding to team members:', error);
  }
}

// ============== CREATE COMMISSION PAYMENT (WITH EMPLOYER LEVEL PROTECTION) ==============
exports.createCommissionPaymentIntent = async (req, res) => {
  try {
    const { applicationId } = req.body;
    const employerId = req.user.id;

    console.log('\n🟡 ===== CREATE COMMISSION PAYMENT STARTED =====');
    console.log('📝 Application ID:', applicationId);
    console.log('👤 Employer ID:', employerId);

    // Validate input
    if (!applicationId) {
      return res.status(400).json({
        success: false,
        message: 'Application ID is required'
      });
    }

    // Get application and job details
    const application = await JobApplication.findById(applicationId)
      .populate('jobId');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    console.log('📊 Application Status:', application.status);
    console.log('📊 Application Employment Status:', application.employmentStatus);

    // Check if already hired
    if (application.status === 'hired') {
      return res.status(400).json({
        success: false,
        message: 'This candidate is already hired'
      });
    }

    // Verify employer owns this application
    if (application.employerId.toString() !== employerId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to hire this candidate'
      });
    }

    const job = application.jobId;
    const now = new Date();

    // ✅ CHECK EMPLOYER LEVEL PROTECTION FIRST
    const employer = await User.findById(employerId);
    
    if (!employer) {
      return res.status(404).json({
        success: false,
        message: 'Employer not found'
      });
    }

    console.log('🔍 Checking employer protection...');
    console.log('👔 Employer:', employer.companyName || employer.firstName);

    let isFreeHire = false;
    let commissionAmount = 0;
    let remainingHires = 0;

    // Check if employer has active protection
    if (employer?.employerProfile?.protection?.isActive && 
        employer.employerProfile.protection.expiryDate > now &&
        employer.employerProfile.protection.remainingHires > 0) {
      
      // ✅ FREE HIRE - No commission
      isFreeHire = true;
      commissionAmount = 0;
      
      console.log('🎉 FREE HIRE! Employer level protection active. No commission.');
      console.log('💰 Remaining hires before:', employer.employerProfile.protection.remainingHires);
      
      // Decrement remaining hires
      employer.employerProfile.protection.remainingHires -= 1;
      remainingHires = employer.employerProfile.protection.remainingHires;
      
      console.log('💰 Remaining hires after:', remainingHires);
      
      if (employer.employerProfile.protection.remainingHires <= 0) {
        employer.employerProfile.protection.isActive = false;
        console.log('🛡️ Protection deactivated - no remaining hires');
      }
      
      // Update stats
      if (!employer.employerProfile.stats) {
        employer.employerProfile.stats = {
          totalHires: 0,
          activeEmployees: 0,
          totalFreeHiresUsed: 0,
          totalCommissionPaid: 0,
          averageEmployeeTenure: 0
        };
      }
      
      employer.employerProfile.stats.totalFreeHiresUsed = (employer.employerProfile.stats.totalFreeHiresUsed || 0) + 1;
      
      await employer.save();
      
      // Mark application as hired directly
      application.status = 'hired';
      application.hiredAt = now;
      application.employmentStatus = 'active';
      application.hiringCommission = {
        salaryAmount: job.salaryAmount || 0,
        commissionAmount: 0,
        commissionRate: 20,
        paymentStatus: 'free_hire_protection',
        paidAt: now,
        isFreeHire: true
      };
      
      await application.save();

      // Add to job hire history
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

      console.log('✅ Free hire completed successfully');
      console.log('🟢 ===== CREATE COMMISSION PAYMENT ENDED =====');

      return res.status(200).json({
        success: true,
        isFreeHire: true,
        message: 'Employer protection active! Candidate hired without commission.',
        remainingHires: remainingHires,
        application: {
          id: application._id,
          status: application.status,
          hiredAt: application.hiredAt
        }
      });
    }

    // ✅ NORMAL HIRE - Calculate 20% commission
    const salaryAmount = job.salaryAmount || 5000; // Default if not set
    commissionAmount = Math.round(salaryAmount * 0.2 * 100); // Convert to cents

    console.log('💰 Normal hire - Salary:', salaryAmount);
    console.log('💰 Commission (20%):', commissionAmount / 100);
    console.log('💰 Commission in cents:', commissionAmount);

    if (isNaN(commissionAmount) || commissionAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid commission amount'
      });
    }

    // Create payment intent with Stripe
    try {
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
        },
        description: `Commission for hiring ${application.employeeSnapshot.firstName} ${application.employeeSnapshot.lastName} for ${job.title}`
      });

      console.log('✅ Payment intent created:', paymentIntent.id);
      console.log('🟢 ===== CREATE COMMISSION PAYMENT ENDED =====');

      return res.status(200).json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: commissionAmount,
        salaryAmount: salaryAmount,
        commissionAmount: commissionAmount,
        isFreeHire: false
      });

    } catch (stripeError) {
      console.error('❌ Stripe error:', stripeError);
      return res.status(500).json({
        success: false,
        message: 'Payment service error: ' + stripeError.message
      });
    }

  } catch (error) {
    console.error('❌ Error creating commission payment:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while creating payment'
    });
  }
};

// ============== VERIFY COMMISSION PAYMENT ==============
exports.verifyCommissionPayment = async (req, res) => {
  try {
    const { paymentIntentId, applicationId } = req.body;
    const employerId = req.user.id;

    console.log('\n🟡 ===== VERIFY COMMISSION PAYMENT STARTED =====');
    console.log('📝 Payment Intent ID:', paymentIntentId);
    console.log('📝 Application ID:', applicationId);
    console.log('👤 Employer ID:', employerId);

    // Validate input
    if (!paymentIntentId || !applicationId) {
      return res.status(400).json({
        success: false,
        message: 'PaymentIntent ID and Application ID are required'
      });
    }

    // Retrieve payment intent from Stripe
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      console.log('📊 Payment Intent Status:', paymentIntent.status);
    } catch (stripeError) {
      console.error('❌ Stripe error:', stripeError);
      return res.status(400).json({
        success: false,
        message: 'Invalid payment intent ID'
      });
    }

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: 'Payment not successful. Status: ' + paymentIntent.status
      });
    }

    // Verify metadata
    if (paymentIntent.metadata.applicationId !== applicationId ||
        paymentIntent.metadata.employerId !== employerId) {
      console.error('❌ Metadata mismatch');
      console.log('Expected:', { applicationId, employerId });
      console.log('Received:', {
        applicationId: paymentIntent.metadata.applicationId,
        employerId: paymentIntent.metadata.employerId
      });
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed - metadata mismatch'
      });
    }

    // Update application
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
        message: 'Application already marked as hired'
      });
    }

    const now = new Date();
    const job = application.jobId;

    // Parse commission amount from metadata
    const commissionAmount = parseInt(paymentIntent.metadata.commissionAmount) || 0;
    const salaryAmount = parseInt(paymentIntent.metadata.salaryAmount) || 0;

    // Mark as hired with commission paid
    application.status = 'hired';
    application.hiredAt = now;
    application.employmentStatus = 'active';
    application.hiringCommission = {
      salaryAmount: salaryAmount,
      commissionAmount: commissionAmount,
      commissionRate: 20,
      paymentStatus: 'paid',
      paidAt: now,
      paymentId: paymentIntentId,
      isFreeHire: false,
      stripeMetadata: paymentIntent.metadata
    };
    
    await application.save();
    console.log('✅ Application updated to hired');

    // Add to job hire history
    if (job) {
      if (!job.hireHistory) job.hireHistory = [];
      job.hireHistory.push({
        applicationId: application._id,
        employeeId: application.employeeId,
        hiredAt: now,
        commissionPaid: commissionAmount,
        protectionUsed: false
      });
      await job.save();
      console.log('✅ Job hire history updated');
    }

    // ✅ ADD TO TEAM MEMBERS
    await addToTeamMembers(
      employerId,
      application.employeeId,
      job._id,
      application._id,
      job.title,
      now,
      commissionAmount,
      false
    );

    console.log(`✅ Commission paid for application ${applicationId} and added to team`);
    console.log('🟢 ===== VERIFY COMMISSION PAYMENT ENDED =====');

    return res.status(200).json({
      success: true,
      message: 'Payment verified, candidate hired successfully and added to team',
      application: {
        id: application._id,
        status: application.status,
        hiredAt: application.hiredAt,
        employeeName: `${application.employeeSnapshot.firstName} ${application.employeeSnapshot.lastName}`,
        jobTitle: job.title
      }
    });

  } catch (error) {
    console.error('❌ Error verifying commission payment:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while verifying payment'
    });
  }
};

// ============== GET COMMISSION HISTORY (Admin only) ==============
exports.getCommissionHistory = async (req, res) => {
  try {
    console.log('\n🟡 ===== GET COMMISSION HISTORY STARTED =====');
    
    // Only admin can access this
    const user = await User.findById(req.user.id);
    
    if (!user || user.role !== 'admin') {
      console.log('❌ Unauthorized access attempt by:', req.user.id);
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    console.log('👤 Admin:', user.email);

    const applications = await JobApplication.find({
      'hiringCommission.paymentStatus': { $in: ['paid', 'free_hire_protection'] }
    })
    .populate('jobId', 'title salaryAmount')
    .populate('employeeId', 'firstName lastName email')
    .populate('employerId', 'firstName lastName email employerProfile.companyName')
    .sort({ 'hiringCommission.paidAt': -1 })
    .limit(100); // Limit results for performance

    console.log('📊 Found', applications.length, 'commission records');

    const totalCommission = applications.reduce((sum, app) => {
      return sum + (app.hiringCommission?.commissionAmount || 0);
    }, 0);

    const freeHires = applications.filter(app => app.hiringCommission?.isFreeHire).length;

    const response = {
      success: true,
      summary: {
        totalCommission: totalCommission / 100, // Convert back from cents
        totalApplications: applications.length,
        freeHires: freeHires,
        paidHires: applications.length - freeHires
      },
      count: applications.length,
      data: applications.map(app => ({
        id: app._id,
        jobTitle: app.jobId?.title || 'N/A',
        salaryAmount: app.hiringCommission?.salaryAmount || 0,
        commissionAmount: (app.hiringCommission?.commissionAmount || 0) / 100,
        paidAt: app.hiringCommission?.paidAt,
        employeeName: app.employeeId ? 
          `${app.employeeId.firstName || ''} ${app.employeeId.lastName || ''}`.trim() : 'N/A',
        employerName: app.employerId?.employerProfile?.companyName || 
                     (app.employerId ? 
                       `${app.employerId.firstName || ''} ${app.employerId.lastName || ''}`.trim() : 'N/A'),
        isFreeHire: app.hiringCommission?.isFreeHire || false
      }))
    };

    console.log('🟢 ===== GET COMMISSION HISTORY ENDED =====');
    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Error fetching commission history:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching commission history'
    });
  }
};

// ============== GET EMPLOYER COMMISSION SUMMARY ==============
exports.getEmployerCommissionSummary = async (req, res) => {
  try {
    const employerId = req.user.id;

    console.log('\n🟡 ===== GET EMPLOYER COMMISSION SUMMARY STARTED =====');
    console.log('👤 Employer ID:', employerId);

    const applications = await JobApplication.find({
      employerId: employerId,
      status: 'hired',
      'hiringCommission.paymentStatus': { $in: ['paid', 'free_hire_protection'] }
    });

    const totalCommission = applications.reduce((sum, app) => {
      return sum + (app.hiringCommission?.commissionAmount || 0);
    }, 0);

    const freeHires = applications.filter(app => app.hiringCommission?.isFreeHire).length;
    const paidHires = applications.filter(app => !app.hiringCommission?.isFreeHire).length;

    // Get employer for protection info
    const employer = await User.findById(employerId);
    const protection = employer?.employerProfile?.protection;

    const response = {
      success: true,
      summary: {
        totalHires: applications.length,
        totalCommission: totalCommission / 100,
        freeHires: freeHires,
        paidHires: paidHires,
        averageCommission: applications.length > 0 
          ? (totalCommission / applications.length) / 100 
          : 0
      },
      protection: protection ? {
        isActive: protection.isActive,
        remainingHires: protection.remainingHires,
        expiryDate: protection.expiryDate,
        daysRemaining: protection.expiryDate 
          ? Math.ceil((protection.expiryDate - new Date()) / (1000 * 60 * 60 * 24))
          : 0
      } : null
    };

    console.log('📊 Summary:', response.summary);
    console.log('🟢 ===== GET EMPLOYER COMMISSION SUMMARY ENDED =====');

    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Error getting employer commission summary:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};