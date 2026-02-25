// controllers/job_Application_Controller.js
const JobPost = require('../models/jobpost');
const User = require('../models/user_model');
const JobApplication = require('../models/JobApplication');

exports.applyForJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const employeeId = req.user.id;
    const { coverLetter } = req.body;

    // Get user role from database
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
        message: 'Already applied' 
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

    // Create application
    const application = await JobApplication.create({
      jobId: job._id,
      employeeId: employeeId,
      employerId: job.postedBy,
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
      employerSnapshot: job.employerSnapshot || {
        companyName: employer?.employerProfile?.companyName || '',
        logoUrl: employer?.employerProfile?.logoUrl || '',
        industry: employer?.employerProfile?.industry || ''
      },
      coverLetter: coverLetter || '',
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

// ==================== 2. GET EMPLOYER APPLICATIONS (Employer) ====================
exports.getEmployerApplications = async (req, res) => {
  try {
    const employerId = req.user.id;

    // Check if employer
    const user = await User.findById(employerId);
    if (!user || user.role !== 'employer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only employers can access' 
      });
    }

    // Get all applications for this employer's jobs
    const applications = await JobApplication.find({ employerId: employerId })
      .populate('jobId', 'title location type workplace')
      .sort({ appliedAt: -1 });

    // Get counts by status
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
      data: applications
    });

  } catch (error) {
    console.error('Get employer apps error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ==================== 3. GET EMPLOYEE APPLICATIONS (Employee) ====================
exports.getEmployeeApplications = async (req, res) => {
  try {
    const employeeId = req.user.id;

    // Check if employee
    const user = await User.findById(employeeId);
    if (!user || user.role !== 'employee') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only employees can access' 
      });
    }

    // Get all applications by this employee
    const applications = await JobApplication.find({ employeeId: employeeId })
      .populate('jobId', 'title company location type workplace employerSnapshot')
      .sort({ appliedAt: -1 });

    // Get counts by status
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
      data: applications
    });

  } catch (error) {
    console.error('Get employee apps error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};