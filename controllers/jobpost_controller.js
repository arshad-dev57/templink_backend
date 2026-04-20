const JobPost = require('../models/jobpost');
const User = require('../models/user_model');
const JobApplication = require('../models/JobApplication');


exports.createJobPost = async (req, res) => {
  const { title, company, workplace, location, type, about, requirements, qualifications, images } = req.body;

  try {
    
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    
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



// ==================== GET ALL JOB POSTS (AUTH REQUIRED) ====================
exports.getAllJobPosts = async (req, res) => {
  try {
    // ✅ Auth required - user一定会存在
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Get all jobs
    const jobPosts = await JobPost.find().sort({ postedDate: -1 });

    // Agar employee hai to filter karo
    if (user.role === 'employee') {
      // ✅ Get all jobs where employee is currently hired (active)
      const hiredApplications = await JobApplication.find({
        employeeId: userId,
        status: 'hired',
        employmentStatus: 'active'
      });

      // ✅ Get hired job IDs
      const hiredJobIds = hiredApplications.map(app => app.jobId.toString());

      // ✅ Filter out hired jobs
      const filteredJobs = jobPosts.filter(job => 
        !hiredJobIds.includes(job._id.toString())
      );

      return res.status(200).json({
        success: true,
        count: filteredJobs.length,
        jobs: filteredJobs,
        role: 'employee'
      });
    }
    
    // Agar employer hai to saari jobs dikhao
    if (user.role === 'employer') {
      return res.status(200).json({
        success: true,
        count: jobPosts.length,
        jobs: jobPosts,
        role: 'employer'
      });
    }

    // Fallback
    return res.status(200).json({
      success: true,
      count: jobPosts.length,
      jobs: jobPosts
    });

  } catch (error) {
    console.error('Error fetching job posts:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again later.' 
    });
  }
};

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

// ==================== GET ALL JOB CATEGORIES (FROM EMPLOYEES) ====================
exports.getAllJobCategories = async (req, res) => {
  try {
    console.log('\n🟡 ===== FETCHING JOB CATEGORIES STARTED =====');

    // Saare employees ki categories fetch karo
    const employees = await User.find({ 
      role: 'employee',
      'employeeProfile.category': { $ne: '' }  // Empty category ko exclude karo
    }).select('employeeProfile.category');

    // Unique categories nikaalo
    const categoriesSet = new Set();
    
    employees.forEach(employee => {
      const category = employee.employeeProfile?.category;
      if (category && category.trim() !== '') {
        categoriesSet.add(category.trim());
      }
    });

    // Set ko array mein convert karo aur sort karo
    const categories = Array.from(categoriesSet).sort();

    console.log(`✅ Found ${categories.length} unique categories`);
    console.log('📊 Categories:', categories);
    console.log('🟢 ===== FETCHING JOB CATEGORIES ENDED =====\n');

    return res.status(200).json({
      success: true,
      count: categories.length,
      categories: categories
    });

  } catch (error) {
    console.error('❌ Error fetching job categories:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
};

// ==================== GET JOBS BY CATEGORY ====================
exports.getJobsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const userId = req.user?.id;

    console.log(`\n🟡 ===== FETCHING JOBS BY CATEGORY STARTED =====`);
    console.log(`📂 Category: ${category}`);

    if (!category || category.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Category parameter is required'
      });
    }

    // Decode URL encoded category
    const decodedCategory = decodeURIComponent(category);
    console.log(`📌 Decoded category: ${decodedCategory}`);

    // Pehle us category mein employees find karo
    const employeesInCategory = await User.find({
      role: 'employee',
      'employeeProfile.category': decodedCategory
    }).select('_id employeeProfile.category employeeProfile.skills employeeProfile.title');

    const employeeIds = employeesInCategory.map(emp => emp._id);
    console.log(`👥 Found ${employeeIds.length} employees in category: ${decodedCategory}`);

    // Ab saari active jobs fetch karo
    let jobs = await JobPost.find({ status: 'active' })
      .sort({ postedDate: -1 })
      .populate('postedBy', 'firstName lastName email employerProfile.companyName employerProfile.logoUrl');

    // Filter jobs based on category matching with employees
    const JobApplication = require('../models/JobApplication');
    
    // Har job ke liye check karo kitne employees is category se hain
    const jobsWithCategoryInfo = await Promise.all(jobs.map(async (job) => {
      const jobObj = job.toObject();
      
      // Find applications for this job
      const applications = await JobApplication.find({ 
        jobId: job._id,
        employeeId: { $in: employeeIds }
      });

      // Get unique employees from this category who applied/hired
      const uniqueEmployeeIds = [...new Set(applications.map(app => app.employeeId.toString()))];
      
      // Get employee details
      const employees = employeesInCategory.filter(emp => 
        uniqueEmployeeIds.includes(emp._id.toString())
      ).map(emp => ({
        id: emp._id,
        title: emp.employeeProfile?.title || '',
        skills: emp.employeeProfile?.skills || []
      }));

      jobObj.categoryEmployees = {
        count: uniqueEmployeeIds.length,
        employees: employees
      };

      // Agar koi employee is category ka nahi hai to job ko exclude karo (optional)
      // Agar aap sirf woh jobs dikhana chahte hain jahan category ke employees hain
      // to ye condition use karo
      if (uniqueEmployeeIds.length === 0) {
        return null; // Is job ko filter out karo
      }

      // Agar user logged in hai to check karo
      if (userId) {
        const user = await User.findById(userId);
        if (user && user.role === 'employee') {
          const application = await JobApplication.findOne({
            jobId: job._id,
            employeeId: userId
          });
          
          if (application) {
            jobObj.applicationStatus = application.status;
            jobObj.employmentStatus = application.employmentStatus;
            jobObj.canApply = application.status === 'rejected' || 
                          (application.status === 'hired' && application.employmentStatus === 'left');
          } else {
            jobObj.canApply = true;
          }
        }
      }

      return jobObj;
    }));

    // Remove null values (jobs with no employees from this category)
    const filteredJobs = jobsWithCategoryInfo.filter(job => job !== null);

    console.log(`✅ Found ${filteredJobs.length} jobs for category: ${decodedCategory}`);
    console.log('🟢 ===== FETCHING JOBS BY CATEGORY ENDED =====\n');

    return res.status(200).json({
      success: true,
      category: decodedCategory,
      totalEmployeesInCategory: employeesInCategory.length,
      count: filteredJobs.length,
      jobs: filteredJobs
    });

  } catch (error) {
    console.error('❌ Error fetching jobs by category:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
};

// ==================== GET JOBS BY MULTIPLE CATEGORIES ====================
exports.getJobsByCategories = async (req, res) => {
  try {
    const { categories } = req.body; // Expecting array of categories
    const userId = req.user?.id;

    console.log(`\n🟡 ===== FETCHING JOBS BY MULTIPLE CATEGORIES STARTED =====`);
    console.log(`📂 Categories:`, categories);

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of categories'
      });
    }

    // Decode categories
    const decodedCategories = categories.map(cat => decodeURIComponent(cat));

    // In categories mein employees find karo
    const employeesInCategories = await User.find({
      role: 'employee',
      'employeeProfile.category': { $in: decodedCategories }
    }).select('_id employeeProfile.category employeeProfile.skills employeeProfile.title');

    const employeeIds = employeesInCategories.map(emp => emp._id);
    console.log(`👥 Found ${employeeIds.length} employees in given categories`);

    if (employeeIds.length === 0) {
      return res.status(200).json({
        success: true,
        categories: decodedCategories,
        count: 0,
        jobs: [],
        message: 'No employees found in these categories'
      });
    }

    // Saari active jobs fetch karo
    let jobs = await JobPost.find({ status: 'active' })
      .sort({ postedDate: -1 })
      .populate('postedBy', 'firstName lastName email employerProfile.companyName employerProfile.logoUrl');

    const JobApplication = require('../models/JobApplication');
    
    // Har job ke liye check karo
    const jobsWithCategoryInfo = await Promise.all(jobs.map(async (job) => {
      const jobObj = job.toObject();
      
      // Find applications for this job
      const applications = await JobApplication.find({ 
        jobId: job._id,
        employeeId: { $in: employeeIds }
      });

      if (applications.length === 0) {
        return null; // Is job ko filter out karo
      }

      // Get unique employees
      const uniqueEmployeeIds = [...new Set(applications.map(app => app.employeeId.toString()))];
      
      // Group employees by category
      const employeesByCategory = {};
      
      employeesInCategories.forEach(emp => {
        if (uniqueEmployeeIds.includes(emp._id.toString())) {
          const category = emp.employeeProfile?.category || 'Uncategorized';
          if (!employeesByCategory[category]) {
            employeesByCategory[category] = [];
          }
          employeesByCategory[category].push({
            id: emp._id,
            title: emp.employeeProfile?.title || '',
            skills: emp.employeeProfile?.skills || []
          });
        }
      });

      jobObj.categoryEmployees = {
        total: uniqueEmployeeIds.length,
        byCategory: employeesByCategory
      };

      // Check user application status
      if (userId) {
        const user = await User.findById(userId);
        if (user && user.role === 'employee') {
          const application = await JobApplication.findOne({
            jobId: job._id,
            employeeId: userId
          });
          
          if (application) {
            jobObj.applicationStatus = application.status;
            jobObj.employmentStatus = application.employmentStatus;
            jobObj.canApply = application.status === 'rejected' || 
                          (application.status === 'hired' && application.employmentStatus === 'left');
          } else {
            jobObj.canApply = true;
          }
        }
      }

      return jobObj;
    }));

    const filteredJobs = jobsWithCategoryInfo.filter(job => job !== null);

    console.log(`✅ Found ${filteredJobs.length} jobs for given categories`);
    console.log('🟢 ===== FETCHING JOBS BY MULTIPLE CATEGORIES ENDED =====\n');

    return res.status(200).json({
      success: true,
      categories: decodedCategories,
      totalEmployeesInCategories: employeesInCategories.length,
      count: filteredJobs.length,
      jobs: filteredJobs
    });

  } catch (error) {
    console.error('❌ Error fetching jobs by categories:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
};  