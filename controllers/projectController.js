  const Project = require('../models/project');
  const User = require('../models/user_model'); // ⚠️ apna exact path set karna
  const Contract = require('../models/Contract');  // 👈 YEH IMPORT MISSING THA

  const mongoose = require("mongoose");
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
  // 📁 backend/controllers/projectController.js

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
        budgetType, minBudget, maxBudget, skills, deliverables,
        milestones  
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

      // ✅ Parse milestones if they exist
      let parsedMilestones = [];
      if (milestones) {
        try {
          parsedMilestones = JSON.parse(milestones);
          console.log(`📅 Parsed ${parsedMilestones.length} milestones from request`);
        } catch (e) {
          console.error('❌ Failed to parse milestones:', e);
        }
      }

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
        milestones: parsedMilestones, // ✅ ADD MILESTONES HERE
        
        // ✅ who posted
        postedBy: user._id,
        employerSnapshot,
      });

      // ✅ Validation hook will automatically check milestone total vs maxBudget
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
// ✅ GET ALL PROJECTS (Protected)
exports.getAllProjects = async (req, res) => {
  try {
    let query = {};
    const userId = req.user.id;
    
    // Get user role
    const user = await User.findById(userId);
    
    if (user.role === 'employer') {
      // Employer: don't show own projects
      query = { postedBy: { $ne: userId } };
    }
    // Employee: show all projects
    
    const projects = await Project.find(query)
      .sort({ createdAt: -1 });

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


  exports.getMyProjects = async (req, res) => {
    try {
      const employerId = req.user.id;

      const projects = await Project.find({ postedBy: employerId })
        .sort({ createdAt: -1 })
        .select(
          "title category duration experienceLevel budgetType minBudget maxBudget skills proposalsCount status createdAt"
        );

      res.status(200).json({
        total: projects.length,
        projects,
      });

    } catch (error) {
      res.status(500).json({
        message: "Failed to fetch projects",
        error: error.message,
      });
    }
  };


  exports.getMyProjectsWithProposals = async (req, res) => {
    try {
      const employerId = req.user.id;

      const projects = await Project.aggregate([
        {
          $match: {
            postedBy: new mongoose.Types.ObjectId(employerId),
          },
        },

        // First lookup: Get proposals
        {
          $lookup: {
            from: "proposals",
            localField: "_id",
            foreignField: "projectId",
            as: "proposals",
          },
        },

        // Second lookup: Get employees (users)
        {
          $lookup: {
            from: "users",
            localField: "proposals.employeeId",
            foreignField: "_id",
            as: "employees",
          },
        },

        // ✅ NEW: Lookup contracts for each proposal
        {
          $lookup: {
            from: "contracts",
            localField: "proposals._id",
            foreignField: "proposalId",
            as: "contracts",
          },
        },

        {
          $addFields: {
            proposals: {
              $map: {
                input: "$proposals",
                as: "proposal",
                in: {
                  _id: "$$proposal._id",
                  coverLetter: "$$proposal.coverLetter",
                  fixedPrice: "$$proposal.fixedPrice",
                  projectDuration: "$$proposal.projectDuration",
                  status: "$$proposal.status",
                  createdAt: "$$proposal.createdAt",
                  attachedFiles: "$$proposal.attachedFiles",
                  selectedPortfolioProjects: "$$proposal.selectedPortfolioProjects",
                  
                  // Employee details
                  employee: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$employees",
                          as: "emp",
                          cond: {
                            $eq: ["$$emp._id", "$$proposal.employeeId"],
                          },
                        },
                      },
                      0,
                    ],
                  },
                  
                  // ✅ Add contract details
                  contract: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$contracts",
                          as: "contract",
                          cond: {
                            $eq: ["$$contract.proposalId", "$$proposal._id"],
                          },
                        },
                      },
                      0,
                    ],
                  },
                },
              },
            },
          },
        },

        {
          $project: {
            employees: 0, // remove extra
            contracts: 0, // remove extra
          },
        },

        {
          $sort: { createdAt: -1 },
        },
      ]);

      res.status(200).json({
        total: projects.length,
        projects,
      });

    } catch (error) {
      res.status(500).json({
        message: "Failed to fetch projects with proposals",
        error: error.message,
      });
    }
  };

  // ==================== DELETE PROJECT ====================
  exports.deleteProject = async (req, res) => {
    try {
      // ✅ auth required
      if (!req.user?.id) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const { projectId } = req.params;
      const employerId = req.user.id;

      console.log(`\n🟡 ===== DELETE PROJECT STARTED =====`);
      console.log(`📝 Project ID: ${projectId}`);
      console.log(`👤 Employer ID: ${employerId}`);

      // Find the project
      const project = await Project.findById(projectId);

      if (!project) {
        console.log(`❌ Project not found with ID: ${projectId}`);
        return res.status(404).json({ 
          success: false, 
          message: 'Project not found' 
        });
      }

      console.log(`✅ Project found: ${project.title}`);
      console.log(`📌 Posted by: ${project.postedBy}`);

      // Check if the logged-in user is the owner
      if (project.postedBy.toString() !== employerId) {
        console.log(`❌ Unauthorized: User ${employerId} is not the owner`);
        return res.status(403).json({ 
          success: false, 
          message: 'You can only delete your own projects' 
        });
      }

      // Check if project has active proposals or is in progress
      if (project.status === 'IN_PROGRESS' || project.status === 'COMPLETED') {
        console.log(`❌ Cannot delete project with status: ${project.status}`);
        return res.status(400).json({ 
          success: false, 
          message: `Cannot delete project that is ${project.status.toLowerCase()}` 
        });
      }

      console.log(`✅ Authorization successful - user is owner`);

      // Delete the project
      await Project.findByIdAndDelete(projectId);

      console.log(`✅ Project deleted successfully: ${projectId}`);
      console.log(`🟢 ===== DELETE PROJECT ENDED =====\n`);

      return res.status(200).json({
        success: true,
        message: 'Project deleted successfully',
      });

    } catch (error) {
      console.error('❌ Error deleting project:', error);
      console.error('❌ Stack:', error.stack);
      return res.status(500).json({ 
        success: false, 
        message: error.message || 'Server error. Please try again later.' 
      });
    }
  };

  exports.checkAndAutoCompleteProject = async (projectId) => {
  try {
    console.log(`🔍 Checking auto-complete for project: ${projectId}`);
    
    const project = await Project.findById(projectId);
    if (!project) {
      console.log(`❌ Project not found: ${projectId}`);
      return false;
    }

    // Already completed
    if (project.status === 'COMPLETED') {
      console.log(`📌 Project already completed: ${projectId}`);
      return false;
    }

    // Check if all milestones are RELEASED
    const allMilestonesReleased = project.milestones.every(
      m => m.status === 'RELEASED'
    );

    if (!allMilestonesReleased) {
      const pendingCount = project.milestones.filter(m => m.status !== 'RELEASED').length;
      console.log(`⏳ ${pendingCount} milestones pending, not auto-completing`);
      return false;
    }

    console.log(`🎯 All milestones RELEASED! Auto-completing project: ${project.title}`);

    // Update project status
    project.status = 'COMPLETED';
    project.completedAt = new Date();
    await project.save();

    // Update contract status
    await Contract.updateMany(
      { projectId: project._id },
      { 
        status: 'COMPLETED',
        completedAt: new Date()
      }
    );

    console.log(`✅ Project auto-completed: ${project._id}`);

    // Trigger invoice generation
    try {
      const { generateInvoice } = require('./invoiceController');
      await generateInvoice(project._id);
      console.log(`📄 Invoice generated for project: ${project._id}`);
    } catch (invoiceError) {
      console.error('❌ Invoice generation error:', invoiceError);
    }

    return true;

  } catch (error) {
    console.error('❌ Auto-complete error:', error);
    return false;
  }
};