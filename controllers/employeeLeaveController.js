const JobApplication = require('../models/JobApplication');
const JobPost = require('../models/jobpost');

// ============== EMPLOYEE LEFT COMPANY ==============
exports.employeeLeft = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { reason } = req.body;
    const employerId = req.user.id;

    console.log(`👋 Employee left application: ${applicationId}`);

    // Get application with job details
    const application = await JobApplication.findById(applicationId)
      .populate('jobId');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Verify employer owns this job
    if (application.employerId.toString() !== employerId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // ✅ Check if already marked as left
    if (application.employmentStatus === 'left') {
      return res.status(400).json({
        success: false,
        message: 'Employee already marked as left'
      });
    }

    const now = new Date();
    const hiredAt = application.hiredAt || application.createdAt;
    
    // ✅ Calculate days worked
    const diffTime = Math.abs(now - hiredAt);
    const daysWorked = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    console.log('📅 Days worked:', daysWorked);

    // ✅ Update application
    application.employmentStatus = 'left';
    application.leftAt = now;
    application.leftReason = reason || 'Not specified';
    
    // ✅ Check if within 30 days
    const within30Days = daysWorked <= 30;

    if (within30Days) {
      // Get job and activate protection
      const job = await JobPost.findById(application.jobId);
      
      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }

      // Set protection expiry (30 days from now)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      job.protection = {
        isActive: true,
        expiryDate: expiryDate,
        originalHireId: application._id,
        originalEmployeeId: application.employeeId
      };

      // Add to hire history
      if (!job.hireHistory) job.hireHistory = [];
      job.hireHistory.push({
        applicationId: application._id,
        employeeId: application.employeeId,
        hiredAt: hiredAt,
        leftAt: now,
        commissionPaid: application.hiringCommission?.commissionAmount || 0,
        protectionUsed: true,
        daysWorked: daysWorked
      });

      await job.save();

      application.protectionEligible = true;

      console.log('🛡️ Protection activated until:', expiryDate);
    }

    await application.save();

    return res.status(200).json({
      success: true,
      message: within30Days 
        ? `✅ Employee left within 30 days (${daysWorked} days worked). Job is now protected for 30 days.`
        : `Employee left after 30 days (${daysWorked} days worked). No protection applied.`,
      daysWorked: daysWorked,
      protectionActivated: within30Days,
      protectionExpiry: within30Days ? job.protection.expiryDate : null
    });

  } catch (error) {
    console.error('❌ Error in employeeLeft:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============== CHECK JOB PROTECTION STATUS ==============
exports.checkJobProtection = async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await JobPost.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    const now = new Date();
    let response = {
      isProtected: false,
      canHireFree: false,
      message: 'No active protection',
      daysRemaining: 0
    };

    // ✅ Check if protection is active and not expired
    if (job.protection?.isActive && job.protection?.expiryDate > now) {
      const daysRemaining = Math.ceil(
        (job.protection.expiryDate - now) / (1000 * 60 * 60 * 24)
      );

      response = {
        isProtected: true,
        canHireFree: true,
        message: `✅ Job is protected! You can hire another candidate for FREE for ${daysRemaining} more days.`,
        daysRemaining: daysRemaining,
        expiryDate: job.protection.expiryDate
      };
    } else if (job.protection?.expiryDate && job.protection.expiryDate <= now) {
      // ✅ Auto-deactivate expired protection
      job.protection.isActive = false;
      await job.save();
    }

    return res.status(200).json({
      success: true,
      ...response
    });

  } catch (error) {
    console.error('❌ Error checking protection:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};