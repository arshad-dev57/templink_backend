const JobApplication = require('../models/JobApplication');
const JobPost = require('../models/jobpost');
const User = require('../models/user_model');

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

    // Check if already marked as left
    if (application.employmentStatus === 'left') {
      return res.status(400).json({
        success: false,
        message: 'Employee already marked as left'
      });
    }

    const now = new Date();
    const hiredAt = application.hiredAt || application.createdAt;
    
    // Calculate days worked
    const diffTime = Math.abs(now - hiredAt);
    const daysWorked = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    console.log('📅 Days worked:', daysWorked);

    // Update application
    application.employmentStatus = 'left';
    application.leftAt = now;
    application.leftReason = reason || 'Not specified';
    
    // ✅ Check if within 30 days for EMPLOYER LEVEL protection
    const within30Days = daysWorked <= 30;

    if (within30Days) {
      // Get employer
      const employer = await User.findById(employerId);
      
      if (!employer) {
        return res.status(404).json({
          success: false,
          message: 'Employer not found'
        });
      }

      // Initialize employerProfile if needed
      if (!employer.employerProfile) {
        employer.employerProfile = {};
      }

      // ✅ ACTIVATE EMPLOYER LEVEL PROTECTION
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      employer.employerProfile.protection = {
        isActive: true,
        expiryDate: expiryDate,
        remainingHires: 1, // Ek free hire available
        totalFreeHires: 1,
        originalEmployeeId: application.employeeId,
        reason: reason || 'Employee left within 30 days',
        activatedAt: now
      };

      // Add to protection history
      if (!employer.employerProfile.protectionHistory) {
        employer.employerProfile.protectionHistory = [];
      }
      
      employer.employerProfile.protectionHistory.push({
        employeeId: application.employeeId,
        jobId: application.jobId,
        hiredAt: hiredAt,
        leftAt: now,
        daysWorked: daysWorked,
        protectionGranted: true,
        expiryDate: expiryDate
      });

      await employer.save();

      // Also update the specific job for reference
      const job = await JobPost.findById(application.jobId);
      if (job) {
        // Add to job hire history
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
      }

      application.protectionEligible = true;

      console.log('🛡️ EMPLOYER LEVEL protection activated until:', expiryDate);
      console.log('🛡️ Free hires available: 1 for ALL jobs');
    }

    await application.save();

    // ✅ UPDATE EMPLOYER'S TEAM MEMBERS
    const employer = await User.findById(application.employerId);
    if (employer && employer.employerProfile?.teamMembers) {
      const teamMember = employer.employerProfile.teamMembers.find(
        member => member.employeeId.toString() === application.employeeId.toString() &&
                  member.status === 'active'
      );

      if (teamMember) {
        teamMember.status = 'left';
        teamMember.leftAt = now;
        teamMember.leftReason = reason || 'Not specified';
        
        // Update active employees count
        employer.employerProfile.activeEmployees = Math.max(0, (employer.employerProfile.activeEmployees || 1) - 1);
        
        await employer.save();
      }
    }

    // ✅ UPDATE EMPLOYEE'S MYEMPLOYERS LIST
    const employee = await User.findById(application.employeeId);
    if (employee && employee.myEmployers) {
      const employerRelation = employee.myEmployers.find(
        e => e.employerId.toString() === application.employerId.toString() &&
             e.status === 'active'
      );

      if (employerRelation) {
        employerRelation.status = 'left';
        employerRelation.leftAt = now;
        await employee.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: within30Days 
        ? `✅ Employee left within 30 days (${daysWorked} days worked). Employer now has FREE HIRE protection for ALL jobs for 30 days!`
        : `Employee left after 30 days (${daysWorked} days worked). No protection applied.`,
      daysWorked: daysWorked,
      protectionActivated: within30Days,
      protectionExpiry: within30Days ? employer.employerProfile.protection.expiryDate : null,
      freeHiresAvailable: within30Days ? 1 : 0,
      protectionType: 'employer_level'
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