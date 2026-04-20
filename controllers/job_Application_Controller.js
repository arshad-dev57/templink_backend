const JobPost = require('../models/jobpost');
const User = require('../models/user_model');
const JobApplication = require('../models/JobApplication');
const { sendToUser } = require('../services/onesignal'); // ✅ Top pe add karo



exports.applyForJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const employeeId = req.user.id;
    const { coverLetter } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload your resume (PDF)'
      });
    }

    const user = await User.findById(employeeId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role !== 'employee') {
      return res.status(403).json({ success: false, message: 'Only employees can apply' });
    }

    const job = await JobPost.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const existing = await JobApplication.findOne({
      jobId: jobId,
      employeeId: employeeId,
      $or: [
        { status: { $nin: ['rejected'] } },
        { status: 'hired', employmentStatus: 'active' },
        { status: { $in: ['pending', 'reviewed', 'shortlisted'] }, employmentStatus: { $ne: 'left' } }
      ]
    });

    if (existing) {
      let message = 'You have already applied for this job';
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
        message,
        existingApplication: {
          status: existing.status,
          employmentStatus: existing.employmentStatus,
          appliedAt: existing.appliedAt
        }
      });
    }

    const employer = await User.findById(job.postedBy);

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

    const application = await JobApplication.create({
      jobId: job._id,
      employeeId: employeeId,
      employerId: job.postedBy,
      employmentStatus: 'active',
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

    // ✅ Employer ko notification bhejo
    try {
      const applicantName = `${user.firstName} ${user.lastName}`;
      
      await sendToUser({
        mongoUserId: job.postedBy.toString(),
        title: "New Application Received! 🎉",
        message: `${applicantName} applied for "${job.title}"`,
        data: {
          type: "new_application",
          screen: "applications",
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
        }
      });
      
      console.log(`✅ Notification sent to employer: ${job.postedBy}`);
    } catch (notifError) {
      console.log("⚠️ Notification failed (non-fatal):", notifError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Applied successfully',
      data: application
    });

  } catch (error) {
    console.error('Apply error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
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