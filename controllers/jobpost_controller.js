const JobPost = require('../models/jobpost');
const User = require('../models/user_model'); // ⚠️ apni file path sahi kar lena

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

exports.getAllJobPosts = async (req, res) => {
  try {
    // ✅ you can return snapshot directly (no populate required)
    const jobPosts = await JobPost.find().sort({ postedDate: -1 });

    return res.status(200).json(jobPosts);
  } catch (error) {
    console.error('Error fetching job posts:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};


// ==================== GET MY JOB POSTS ====================
exports.getMyJobPosts = async (req, res) => {
  try {
    // ✅ auth required
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const employerId = req.user.id;

    const jobPosts = await JobPost.find({ postedBy: employerId })
      .sort({ postedDate: -1 });

    return res.status(200).json({
      success: true,
      count: jobPosts.length,
      jobs: jobPosts,
    });
  } catch (error) {
    console.error('Error fetching my job posts:', error);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
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

    const jobPost = await JobPost.findById(jobId).select('status pausedAt resumedAt');

    if (!jobPost) {
      return res.status(404).json({ 
        success: false, 
        message: 'Job post not found' 
      });
    }

    return res.status(200).json({
      success: true,
      status: jobPost.status,
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