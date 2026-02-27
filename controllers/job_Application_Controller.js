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

    // Check if already applied
    const existing = await JobApplication.findOne({
      jobId: jobId,
      employeeId: employeeId
    });

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'You have already applied for this job' 
      });
    }

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

    // 👇 Create application with employmentStatus field
    const application = await JobApplication.create({
      jobId: job._id,
      employeeId: employeeId,
      employerId: job.postedBy,
      
      // 👇 Add employmentStatus (default 'active')
      employmentStatus: 'active',
      
      // Resume file info from multer/cloudinary
      resumeFileName: req.file.originalname,
      resumeFileUrl: req.file.path,           // Cloudinary URL
      resumeCloudinaryPublicId: req.file.filename, // Cloudinary public_id
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
        postedDate: job.postedDate
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
      .populate('jobId', 'title location type workplace')
      .sort({ appliedAt: -1 });

    // 👇 Add employmentStatus in response
    const formattedApps = applications.map(app => ({
      ...app.toObject(),
      employmentStatus: app.employmentStatus || 'active',
      leftAt: app.leftAt,
      leftReason: app.leftReason
    }));

    const summary = {
      total: applications.length,
      pending: applications.filter(a => a.status === 'pending').length,
      reviewed: applications.filter(a => a.status === 'reviewed').length,
      shortlisted: applications.filter(a => a.status === 'shortlisted').length,
      rejected: applications.filter(a => a.status === 'rejected').length,
      hired: applications.filter(a => a.status === 'hired').length
    };

    res.json({
      success: true,
      summary,
      data: formattedApps  // 👈 Send formatted apps
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

    // 👇 Get all applications (including left ones if needed)
    const applications = await JobApplication.find({ 
      employeeId: employeeId,
      // employmentStatus: { $ne: 'left' }  // Uncomment to hide left jobs
    })
    .populate('jobId', 'title company location type workplace')
    .sort({ appliedAt: -1 });

    // 👇 Format applications with employment status fields
    const formattedApps = applications.map(app => ({
      ...app.toObject(),
      employmentStatus: app.employmentStatus || 'active',
      leftAt: app.leftAt,
      leftReason: app.leftReason
    }));

    // Count summary
    const summary = {
      total: formattedApps.length,
      pending: formattedApps.filter(a => a.status === 'pending').length,
      reviewed: formattedApps.filter(a => a.status === 'reviewed').length,
      shortlisted: formattedApps.filter(a => a.status === 'shortlisted').length,
      rejected: formattedApps.filter(a => a.status === 'rejected').length,
      hired: formattedApps.filter(a => a.status === 'hired').length
    };

    res.json({
      success: true,
      summary,
      data: formattedApps  // 👈 Send with employmentStatus
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

    // Update application
    application.employmentStatus = 'left';
    application.leftAt = new Date();
    application.leftReason = reason || '';
    
    await application.save();

    res.json({
      success: true,
      message: 'Job marked as left successfully',
      data: {
        employmentStatus: application.employmentStatus,
        leftAt: application.leftAt,
        leftReason: application.leftReason
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