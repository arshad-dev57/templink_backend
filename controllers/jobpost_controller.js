const JobPost = require('../models/jobpost');
const User = require('../models/user_model');
const JobApplication = require('../models/JobApplication');

// ==================== CREATE JOB POST ====================
exports.createJobPost = async (req, res) => {
  const { title, company, workplace, location, type, about, requirements, qualifications, images } = req.body;

  try {
    // ✅ token required
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // ✅ get user from DB
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // ✅ must be employer
    if (user.role !== "employer") {
      return res.status(403).json({ message: "Only employers can create job posts" });
    }

    const ep = user.employerProfile || {};

    // ✅ snapshot build (safe fields only)
    const employerSnapshot = {
      userId: user._id,

      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      country: user.country,

      companyName: ep.companyName || "",
      logoUrl: ep.logoUrl || "",
      industry: ep.industry || "",
      city: ep.city || "",
      employerCountry: ep.country || "",
      companySize: ep.companySize || "",
      workModel: ep.workModel || "",

      phone: ep.phone || "",
      companyEmail: ep.companyEmail || "",
      website: ep.website || "",
      linkedin: ep.linkedin || "",

      about: ep.about || "",
      mission: ep.mission || "",

      cultureTags: Array.isArray(ep.cultureTags) ? ep.cultureTags : [],
      teamMembers: Array.isArray(ep.teamMembers) ? ep.teamMembers : [],

      isVerifiedEmployer: !!ep.isVerifiedEmployer,
      rating: ep.rating ?? 0,
      sizeLabel: ep.sizeLabel || "",
    };

    const newJobPost = new JobPost({
      title,
      company,
      workplace,
      location,
      type,
      about,
      requirements,
      qualifications,
      images,
      status: 'active', // Default status
      postedBy: user._id,         
      employerSnapshot,           
    });

    await newJobPost.save();

    return res.status(201).json({
      message: 'Job post created successfully',
      jobPost: newJobPost,
    });
  } catch (error) {
    console.error('Error creating job post:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// ==================== GET ALL JOB POSTS (FOR EMPLOYEES) ====================
exports.getAllJobPosts = async (req, res) => {
  try {
    // Get all active jobs (not filled/closed)
    const jobPosts = await JobPost.find({ 
      status: { $in: ['active', 'paused'] } // Show active and paused jobs
    }).sort({ postedDate: -1 });

    // If user is logged in (employee), check their application status for each job
    let jobsWithStatus = jobPosts;
    
    if (req.user?.id) {
      const employeeId = req.user.id;
      const user = await User.findById(employeeId);
      
      if (user && user.role === 'employee') {
        // Get all applications by this employee
        const applications = await JobApplication.find({ 
          employeeId: employeeId 
        });
        
        // Create a map of jobId -> application status
        const applicationMap = {};
        applications.forEach(app => {
          applicationMap[app.jobId.toString()] = {
            status: app.status,
            employmentStatus: app.employmentStatus,
            appliedAt: app.appliedAt
          };
        });
        
        // Add application status to each job
        jobsWithStatus = jobPosts.map(job => {
          const jobObj = job.toObject();
          const appStatus = applicationMap[job._id.toString()];
          
          if (appStatus) {
            jobObj.applicationStatus = appStatus.status;
            jobObj.employmentStatus = appStatus.employmentStatus;
            jobObj.appliedAt = appStatus.appliedAt;
            
            // Determine if job is available for this employee
            jobObj.canApply = 
              appStatus.status === 'rejected' || 
              (appStatus.status === 'hired' && appStatus.employmentStatus === 'left');
            
            // Reason why can't apply
            if (!jobObj.canApply) {
              if (appStatus.status === 'hired' && appStatus.employmentStatus === 'active') {
                jobObj.cantApplyReason = 'You are currently hired for this job';
              } else if (appStatus.status === 'pending') {
                jobObj.cantApplyReason = 'Application pending';
              } else if (appStatus.status === 'reviewed') {
                jobObj.cantApplyReason = 'Application under review';
              } else if (appStatus.status === 'shortlisted') {
                jobObj.cantApplyReason = 'You are shortlisted';
              }
            }
          } else {
            jobObj.canApply = true;
            jobObj.applicationStatus = null;
          }
          
          return jobObj;
        });
      }
    }

    return res.status(200).json({
      success: true,
      count: jobsWithStatus.length,
      jobs: jobsWithStatus
    });
  } catch (error) {
    console.error('Error fetching job posts:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// ==================== GET MY JOB POSTS (FOR EMPLOYER) ====================
exports.getMyJobPosts = async (req, res) => {
  try {
    // ✅ auth required
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const employerId = req.user.id;

    // Get all jobs by this employer with application counts
    const jobPosts = await JobPost.find({ postedBy: employerId })
      .sort({ postedDate: -1 });

    // Get application counts for each job
    const jobsWithStats = await Promise.all(jobPosts.map(async (job) => {
      const jobObj = job.toObject();
      
      // Get application counts by status
      const applications = await JobApplication.find({ jobId: job._id });
      
      jobObj.stats = {
        totalApplications: applications.length,
        pending: applications.filter(a => a.status === 'pending').length,
        reviewed: applications.filter(a => a.status === 'reviewed').length,
        shortlisted: applications.filter(a => a.status === 'shortlisted').length,
        rejected: applications.filter(a => a.status === 'rejected').length,
        hired: applications.filter(a => a.status === 'hired').length,
        activeHired: applications.filter(a => a.status === 'hired' && a.employmentStatus === 'active').length,
      };
      
      // Check if job has active hires
      jobObj.hasActiveHires = applications.some(a => 
        a.status === 'hired' && a.employmentStatus === 'active'
      );
      
      return jobObj;
    }));

    return res.status(200).json({
      success: true,
      count: jobsWithStats.length,
      jobs: jobsWithStats,
    });
  } catch (error) {
    console.error('Error fetching my job posts:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// ==================== GET JOB BY ID ====================
exports.getJobById = async (req, res) => {
  try {
    const { jobId } = req.params;

    const jobPost = await JobPost.findById(jobId);

    if (!jobPost) {
      return res.status(404).json({ 
        success: false, 
        message: 'Job post not found' 
      });
    }

    // If user is logged in (employee), check their application status
    let jobWithStatus = jobPost.toObject();
    
    if (req.user?.id) {
      const employeeId = req.user.id;
      const user = await User.findById(employeeId);
      
      if (user && user.role === 'employee') {
        const application = await JobApplication.findOne({ 
          jobId: jobId,
          employeeId: employeeId 
        });
        
        if (application) {
          jobWithStatus.applicationStatus = application.status;
          jobWithStatus.employmentStatus = application.employmentStatus;
          jobWithStatus.appliedAt = application.appliedAt;
          
          // Determine if employee can apply
          jobWithStatus.canApply = 
            application.status === 'rejected' || 
            (application.status === 'hired' && application.employmentStatus === 'left');
        } else {
          jobWithStatus.canApply = true;
        }
      }
    }

    return res.status(200).json({
      success: true,
      job: jobWithStatus
    });
  } catch (error) {
    console.error('Error fetching job by ID:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ==================== UPDATE JOB STATUS (CLOSE/FILL) WHEN HIRED ====================
exports.updateJobStatusOnHire = async (jobId) => {
  try {
    const job = await JobPost.findById(jobId);
    
    if (!job) return;
    
    // Check if there's any active hire for this job
    const activeHire = await JobApplication.findOne({
      jobId: jobId,
      status: 'hired',
      employmentStatus: 'active'
    });
    
    if (activeHire) {
      // Job is filled - can be closed or keep active based on your logic
      // Option 1: Close the job
      // job.status = 'closed';
      
      // Option 2: Keep active but mark as filled
      job.isFilled = true;
      job.filledAt = new Date();
      job.filledBy = activeHire.employeeId;
      
      await job.save();
      console.log(`✅ Job ${jobId} marked as filled`);
    }
  } catch (error) {
    console.error('Error updating job status on hire:', error);
  }
};

// ==================== CHECK IF JOB IS AVAILABLE FOR EMPLOYEE ====================
exports.checkJobAvailability = async (req, res) => {
  try {
    const { jobId } = req.params;
    const employeeId = req.user.id;

    const job = await JobPost.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if job is active
    if (job.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'This job is not currently accepting applications',
        canApply: false
      });
    }

    // Check if employee already applied
    const existingApplication = await JobApplication.findOne({
      jobId: jobId,
      employeeId: employeeId
    });

    if (!existingApplication) {
      return res.json({
        success: true,
        canApply: true,
        message: 'You can apply for this job'
      });
    }

    // Determine if can reapply
    const canReapply = 
      existingApplication.status === 'rejected' || 
      (existingApplication.status === 'hired' && existingApplication.employmentStatus === 'left');

    let message = '';
    if (!canReapply) {
      if (existingApplication.status === 'hired' && existingApplication.employmentStatus === 'active') {
        message = 'You are currently hired for this job';
      } else if (existingApplication.status === 'pending') {
        message = 'Your application is pending';
      } else if (existingApplication.status === 'reviewed') {
        message = 'Your application is under review';
      } else if (existingApplication.status === 'shortlisted') {
        message = 'You have been shortlisted';
      }
    } else {
      message = 'You can reapply for this job';
    }

    res.json({
      success: true,
      canApply: canReapply,
      message: message,
      applicationStatus: existingApplication.status,
      employmentStatus: existingApplication.employmentStatus
    });

  } catch (error) {
    console.error('Error checking job availability:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== DELETE JOB POST ====================
exports.deleteJobPost = async (req, res) => {
  try {
    // ✅ auth required
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { jobId } = req.params;
    const employerId = req.user.id;

    console.log(`\n🟡 ===== DELETE JOB POST STARTED =====`);
    console.log(`📝 Job ID: ${jobId}`);
    console.log(`👤 Employer ID: ${employerId}`);

    // Find the job post
    const jobPost = await JobPost.findById(jobId);

    if (!jobPost) {
      console.log(`❌ Job post not found with ID: ${jobId}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Job post not found' 
      });
    }

    console.log(`✅ Job post found: ${jobPost.title}`);
    console.log(`📌 Posted by: ${jobPost.postedBy}`);

    // Check if the logged-in user is the owner
    if (jobPost.postedBy.toString() !== employerId) {
      console.log(`❌ Unauthorized: User ${employerId} is not the owner`);
      return res.status(403).json({ 
        success: false, 
        message: 'You can only delete your own job posts' 
      });
    }

    console.log(`✅ Authorization successful - user is owner`);

    // Check if there are any active hires for this job
    const activeHires = await JobApplication.find({
      jobId: jobId,
      status: 'hired',
      employmentStatus: 'active'
    });

    if (activeHires.length > 0) {
      console.log(`⚠️ Job has ${activeHires.length} active hire(s). Cannot delete.`);
      return res.status(400).json({
        success: false,
        message: 'Cannot delete job with active employees. Please ensure all employees have left first.'
      });
    }

    // Delete the job post
    await JobPost.findByIdAndDelete(jobId);

    console.log(`✅ Job post deleted successfully: ${jobId}`);
    console.log(`🟢 ===== DELETE JOB POST ENDED =====\n`);

    return res.status(200).json({
      success: true,
      message: 'Job post deleted successfully',
    });

  } catch (error) {
    console.error('❌ Error deleting job post:', error);
    console.error('❌ Stack:', error.stack);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again later.' 
    });
  }
};

// ==================== PAUSE JOB POST ====================
exports.pauseJobPost = async (req, res) => {
  try {
    // ✅ auth required
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { jobId } = req.params;
    const employerId = req.user.id;

    console.log(`\n🟡 ===== PAUSE JOB POST STARTED =====`);
    console.log(`📝 Job ID: ${jobId}`);
    console.log(`👤 Employer ID: ${employerId}`);

    // Find the job post
    const jobPost = await JobPost.findById(jobId);

    if (!jobPost) {
      console.log(`❌ Job post not found with ID: ${jobId}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Job post not found' 
      });
    }

    // Check if the logged-in user is the owner
    if (jobPost.postedBy.toString() !== employerId) {
      console.log(`❌ Unauthorized: User ${employerId} is not the owner`);
      return res.status(403).json({ 
        success: false, 
        message: 'You can only pause your own job posts' 
      });
    }

    // Check current status
    if (jobPost.status === 'paused') {
      console.log(`❌ Job is already paused`);
      return res.status(400).json({ 
        success: false, 
        message: 'Job post is already paused' 
      });
    }

    // Update status to paused
    jobPost.status = 'paused';
    jobPost.pausedAt = new Date();
    await jobPost.save();

    console.log(`✅ Job post paused successfully: ${jobId}`);
    console.log(`🟢 ===== PAUSE JOB POST ENDED =====\n`);

    return res.status(200).json({
      success: true,
      message: 'Job post paused successfully',
      job: jobPost,
    });

  } catch (error) {
    console.error('❌ Error pausing job post:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again later.' 
    });
  }
};

// ==================== RESUME JOB POST ====================
exports.resumeJobPost = async (req, res) => {
  try {
    // ✅ auth required
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { jobId } = req.params;
    const employerId = req.user.id;

    console.log(`\n🟡 ===== RESUME JOB POST STARTED =====`);
    console.log(`📝 Job ID: ${jobId}`);
    console.log(`👤 Employer ID: ${employerId}`);

    // Find the job post
    const jobPost = await JobPost.findById(jobId);

    if (!jobPost) {
      console.log(`❌ Job post not found with ID: ${jobId}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Job post not found' 
      });
    }

    // Check if the logged-in user is the owner
    if (jobPost.postedBy.toString() !== employerId) {
      console.log(`❌ Unauthorized: User ${employerId} is not the owner`);
      return res.status(403).json({ 
        success: false, 
        message: 'You can only resume your own job posts' 
      });
    }

    // Check current status
    if (jobPost.status !== 'paused') {
      console.log(`❌ Job is not paused (current status: ${jobPost.status})`);
      return res.status(400).json({ 
        success: false, 
        message: 'Job post is not paused' 
      });
    }

    // Update status to active
    jobPost.status = 'active';
    jobPost.resumedAt = new Date();
    await jobPost.save();

    console.log(`✅ Job post resumed successfully: ${jobId}`);
    console.log(`🟢 ===== RESUME JOB POST ENDED =====\n`);

    return res.status(200).json({
      success: true,
      message: 'Job post resumed successfully',
      job: jobPost,
    });

  } catch (error) {
    console.error('❌ Error resuming job post:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again later.' 
    });
  }
};

// ==================== GET JOB STATUS ====================
exports.getJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;

    const jobPost = await JobPost.findById(jobId).select('status pausedAt resumedAt isFilled filledAt');

    if (!jobPost) {
      return res.status(404).json({ 
        success: false, 
        message: 'Job post not found' 
      });
    }

    return res.status(200).json({
      success: true,
      status: jobPost.status,
      isFilled: jobPost.isFilled || false,
      filledAt: jobPost.filledAt,
      pausedAt: jobPost.pausedAt,
      resumedAt: jobPost.resumedAt,
    });

  } catch (error) {
    console.error('❌ Error getting job status:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};