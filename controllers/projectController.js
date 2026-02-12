const Project = require('../models/project');
const User = require('../models/user_model'); // ⚠️ apna exact path set karna

// helper to build employer snapshot
function buildEmployerSnapshot(user) {
  const ep = user.employerProfile || {};
  return {
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
}

exports.createProject = async (req, res) => {
  try {
    // ✅ auth required
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // ✅ load user
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // ✅ employer only
    if (user.role !== "employer") {
      return res.status(403).json({ success: false, message: "Only employers can create projects" });
    }

    const {
      title, description, category, duration, experienceLevel,
      budgetType, minBudget, maxBudget, skills, deliverables
    } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one media file is required.'
      });
    }

    const mediaFiles = req.files.map((file) => ({
      fileName: file.originalname,
      fileUrl: file.path,
      fileType: file.mimetype,
      publicId: file.filename,
    }));

    const employerSnapshot = buildEmployerSnapshot(user);

    const newProject = new Project({
      title,
      description,
      category,
      duration,
      experienceLevel,
      budgetType,
      minBudget: Number(minBudget),
      maxBudget: Number(maxBudget),
      skills: JSON.parse(skills || '[]'),
      deliverables: JSON.parse(deliverables || '[]'),
      media: mediaFiles,

      // ✅ who posted
      postedBy: user._id,
      employerSnapshot,
    });

    await newProject.save();

    return res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project: newProject,
    });
  } catch (error) {
    console.error('[Project Create Error]', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

exports.updateProject = async (req, res) => {
  try {
    // ✅ auth required
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // ✅ employer only
    if (user.role !== "employer") {
      return res.status(403).json({ success: false, message: "Only employers can update projects" });
    }

    const { projectId } = req.params;

    // ✅ only owner can update (important!)
    const existing = await Project.findById(projectId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    if (String(existing.postedBy) !== String(user._id)) {
      return res.status(403).json({ success: false, message: "You can update only your own project" });
    }

    const updateData = { ...req.body };

    if (updateData.skills) updateData.skills = JSON.parse(updateData.skills);
    if (updateData.deliverables) updateData.deliverables = JSON.parse(updateData.deliverables);

    // new media
    if (req.files && req.files.length > 0) {
      updateData.media = req.files.map((file) => ({
        fileName: file.originalname,
        fileUrl: file.path,
        fileType: file.mimetype,
        publicId: file.filename,
      }));
    }

    // ✅ optionally refresh snapshot on update
    updateData.employerSnapshot = buildEmployerSnapshot(user);

    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      updateData,
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      project: updatedProject,
    });
  } catch (error) {
    console.error('[Project Update Error]', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};


// ✅ GET ALL PROJECTS (Public)
exports.getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find()
      .sort({ createdAt: -1 }); // latest first

    return res.status(200).json({
      success: true,
      count: projects.length,
      projects,
    });
  } catch (error) {
    console.error('[Project GetAll Error]', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// ✅ GET SINGLE PROJECT BY ID (Public)
exports.getProjectById = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    return res.status(200).json({
      success: true,
      project,
    });
  } catch (error) {
    console.error('[Project GetById Error]', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// ✅ GET MY PROJECTS (Auth Required - employer only)
exports.getMyProjects = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (user.role !== "employer") {
      return res.status(403).json({ success: false, message: "Only employers can view their projects" });
    }

    const projects = await Project.find({ postedBy: user._id }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: projects.length,
      projects,
    });
  } catch (error) {
    console.error('[Project GetMyProjects Error]', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};