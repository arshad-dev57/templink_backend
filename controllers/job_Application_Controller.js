const JobPost = require('../models/jobpost');
const User = require('../models/user_model');
const JobApplication = require('../models/JobApplication');

// @desc    Apply for job with PDF resume
// @route   POST /api/job-applications/apply/:jobId
// @access  Private (Employee only)
exports.applyForJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const employeeId = req.user.id;
    const { coverLetter } = req.body;

    // Check if file uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload your resume (PDF)'
      });
    }

    // Get user
    const user = await User.findById(employeeId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check if employee
    if (user.role !== 'employee') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only employees can apply' 
      });
    }

    // Get job
    const job = await JobPost.findById(jobId);
    if (!job) {
      return res.status(404).json({ 
        success: false, 
        message: 'Job not found' 
      });
    }

    // ============== FIXED: CHECK EXISTING APPLICATIONS ==============
    // ✅ Sirf wahi applications check karo jo:
    // 1. Status 'rejected' nahi hai
    // 2. EmploymentStatus 'left' nahi hai
    // 3. Ya fir pending/reviewed/shortlisted/hired with active status
    const existing = await JobApplication.findOne({
      jobId: jobId,
      employeeId: employeeId,
      $or: [
        { status: { $nin: ['rejected'] } }, // Rejected ko allow karo dobara apply karne
        { 
          status: 'hired',
          employmentStatus: 'active' // Sirf active hired employees ko block karo
        },
        {
          status: { $in: ['pending', 'reviewed', 'shortlisted'] },
          employmentStatus: { $ne: 'left' } // Pending etc with left status allow karo
        }
      ]
    });

    // Agar koi active application exist karti hai to block karo
    if (existing) {
      let message = 'You have already applied for this job';
      
      // Custom message based on status
      if (existing.status === 'hired' && existing.employmentStatus === 'active') {
        message = 'You are currently hired for this job';
      } else if (existing.status === 'pending') {
        message = 'Your application is pending review';
      } else if (existing.status === 'reviewed') {
        message = 'Your application is under review';
      } else if (existing.status === 'shortlisted') {
        message = 'You have been shortlisted for this job';
      }
      
      return res.status(400).json({ 
        success: false, 
        message: message,
        existingApplication: {
          status: existing.status,
          employmentStatus: existing.employmentStatus,
          appliedAt: existing.appliedAt
        }
      });
    }

    // ✅ Agar employee ne pehle apply kiya tha aur left kar diya, to allow karo
    // Ye check upar ke $or mein already handle ho gaya

    // Get employer
    const employer = await User.findById(job.postedBy);

    // Employee snapshot
    const employeeSnapshot = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      country: user.country,
      title: user.employeeProfile?.title || '',
      experienceLevel: user.employeeProfile?.experienceLevel || '',
      category: user.employeeProfile?.category || '',
      skills: user.employeeProfile?.skills || [],
      hourlyRate: user.employeeProfile?.hourlyRate || '',
      photoUrl: user.employeeProfile?.photoUrl || '',
      bio: user.employeeProfile?.bio || '',
      rating: user.employeeProfile?.rating || 0,
      totalReviews: user.employeeProfile?.totalReviews || 0
    };

    // Create application with employmentStatus field
    const application = await JobApplication.create({
      jobId: job._id,
      employeeId: employeeId,
      employerId: job.postedBy,
      
      // Add employmentStatus (default 'active')
      employmentStatus: 'active',
      
      // Resume file info from multer/cloudinary
      resumeFileName: req.file.originalname,
      resumeFileUrl: req.file.path,
      resumeCloudinaryPublicId: req.file.filename,
      resumeFileSize: req.file.size,
      
      coverLetter: coverLetter || '',
      
      employeeSnapshot: employeeSnapshot,
      jobSnapshot: {
        title: job.title,
        company: job.company,
        workplace: job.workplace,
        location: job.location,
        type: job.type,
        about: job.about,
        requirements: job.requirements,
        qualifications: job.qualifications,
        postedDate: job.postedDate,
        salaryAmount: job.salaryAmount || 0
      },
      employerSnapshot: {
        companyName: employer?.employerProfile?.companyName || '',
        logoUrl: employer?.employerProfile?.logoUrl || '',
        industry: employer?.employerProfile?.industry || ''
      },
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Applied successfully',
      data: application
    });

  } catch (error) {
    console.error('Apply error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ==================== GET EMPLOYER APPLICATIONS ====================
exports.getEmployerApplications = async (req, res) => {
  try {
    const employerId = req.user.id;

    const user = await User.findById(employerId);
    if (!user || user.role !== 'employer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only employers can access' 
      });
    }

    const applications = await JobApplication.find({ employerId: employerId })
      .populate('jobId', 'title location type workplace salaryAmount')
      .sort({ appliedAt: -1 });

    // Add employmentStatus in response
    const formattedApps = applications.map(app => ({
      ...app.toObject(),
      employmentStatus: app.employmentStatus || 'active',
      leftAt: app.leftAt,
      leftReason: app.leftReason,
      canReapply: app.status === 'rejected' || 
                 (app.status === 'hired' && app.employmentStatus === 'left')
    }));

    const summary = {
      total: applications.length,
      pending: applications.filter(a => a.status === 'pending').length,
      reviewed: applications.filter(a => a.status === 'reviewed').length,
      shortlisted: applications.filter(a => a.status === 'shortlisted').length,
      rejected: applications.filter(a => a.status === 'rejected').length,
      hired: applications.filter(a => a.status === 'hired').length,
      activeHired: applications.filter(a => a.status === 'hired' && a.employmentStatus === 'active').length,
      leftEmployees: applications.filter(a => a.employmentStatus === 'left').length
    };

    res.json({
      success: true,
      summary,
      data: formattedApps
    });

  } catch (error) {
    console.error('Get employer apps error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ==================== GET EMPLOYEE APPLICATIONS ====================
exports.getEmployeeApplications = async (req, res) => {
  try {
    const employeeId = req.user.id;

    const user = await User.findById(employeeId);
    if (!user || user.role !== 'employee') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only employees can access' 
      });
    }

    // Get all applications
    const applications = await JobApplication.find({ 
      employeeId: employeeId
    })
    .populate('jobId', 'title company location type workplace salaryAmount')
    .sort({ appliedAt: -1 });

    // Format applications with employment status fields
    const formattedApps = applications.map(app => ({
      ...app.toObject(),
      employmentStatus: app.employmentStatus || 'active',
      leftAt: app.leftAt,
      leftReason: app.leftReason,
      canReapply: app.status === 'rejected' || 
                 (app.status === 'hired' && app.employmentStatus === 'left')
    }));

    // Count summary
    const summary = {
      total: formattedApps.length,
      pending: formattedApps.filter(a => a.status === 'pending').length,
      reviewed: formattedApps.filter(a => a.status === 'reviewed').length,
      shortlisted: formattedApps.filter(a => a.status === 'shortlisted').length,
      rejected: formattedApps.filter(a => a.status === 'rejected').length,
      hired: formattedApps.filter(a => a.status === 'hired').length,
      activeHired: formattedApps.filter(a => a.status === 'hired' && a.employmentStatus === 'active').length,
      leftJobs: formattedApps.filter(a => a.employmentStatus === 'left').length
    };

    res.json({
      success: true,
      summary,
      data: formattedApps
    });

  } catch (error) {
    console.error('Get employee apps error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ==================== MARK APPLICATION AS LEFT ====================
exports.markApplicationAsLeft = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { reason } = req.body;
    const employeeId = req.user.id;

    const application = await JobApplication.findById(applicationId);
    
    if (!application) {
      return res.status(404).json({ 
        success: false, 
        message: 'Application not found' 
      });
    }

    // Verify employee owns this application
    if (application.employeeId.toString() !== employeeId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized' 
      });
    }

    // Check if already left
    if (application.employmentStatus === 'left') {
      return res.status(400).json({
        success: false,
        message: 'Already marked as left'
      });
    }

    // Update application
    application.employmentStatus = 'left';
    application.leftAt = new Date();
    application.leftReason = reason || 'Not specified';
    
    await application.save();

    res.json({
      success: true,
      message: 'Job marked as left successfully',
      data: {
        employmentStatus: application.employmentStatus,
        leftAt: application.leftAt,
        leftReason: application.leftReason,
        canReapply: true // Employee can now reapply
      }
    });

  } catch (error) {
    console.error('Mark as left error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ==================== CHECK IF CAN APPLY ====================
exports.checkIfCanApply = async (req, res) => {
  try {
    const { jobId } = req.params;
    const employeeId = req.user.id;

    const existing = await JobApplication.findOne({
      jobId: jobId,
      employeeId: employeeId
    });

    if (!existing) {
      return res.json({
        success: true,
        canApply: true,
        message: 'You can apply for this job'
      });
    }

    // Check if can reapply
    const canReapply = existing.status === 'rejected' || 
                      (existing.status === 'hired' && existing.employmentStatus === 'left');

    let message = '';
    if (!canReapply) {
      if (existing.status === 'hired' && existing.employmentStatus === 'active') {
        message = 'You are currently hired for this job';
      } else if (existing.status === 'pending') {
        message = 'Your application is pending';
      } else if (existing.status === 'reviewed') {
        message = 'Your application is under review';
      } else if (existing.status === 'shortlisted') {
        message = 'You are shortlisted';
      }
    } else {
      message = 'You can reapply for this job';
    }

    res.json({
      success: true,
      canApply: canReapply,
      message: message,
      existingApplication: {
        status: existing.status,
        employmentStatus: existing.employmentStatus,
        appliedAt: existing.appliedAt,
        leftAt: existing.leftAt
      }
    });

  } catch (error) {
    console.error('Check can apply error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};