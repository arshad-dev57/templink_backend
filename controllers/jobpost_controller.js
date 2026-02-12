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