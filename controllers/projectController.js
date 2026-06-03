  const Project = require('../models/project');
  const User = require('../models/user_model'); 
  const Contract = require('../models/Contract');  

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
  const debugLog = {
    step: '',
    timestamp: new Date().toISOString(),
    data: {}
  };

  try {
    console.log('🚀 [START] createProject function called');
    debugLog.step = 'function_start';
    
    // ✅ auth required
    console.log('🔐 Checking authentication...');
    debugLog.data.auth = { hasUser: !!req.user, hasUserId: !!req.user?.id };
    
    if (!req.user?.id) {
      console.log('❌ Authentication failed: No user ID found');
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized",
        debug: process.env.NODE_ENV === 'development' ? debugLog : undefined
      });
    }
    console.log('✅ User authenticated:', req.user.id);

    // ✅ load user
    console.log('👤 Loading user from database...');
    const user = await User.findById(req.user.id);
    
    if (!user) {
      console.log('❌ User not found in database');
      return res.status(404).json({ 
        success: false, 
        message: "User not found",
        debug: process.env.NODE_ENV === 'development' ? debugLog : undefined
      });
    }
    console.log('✅ User found:', { id: user._id, email: user.email, role: user.role });

    // ✅ employer only
    console.log('👔 Checking user role...');
    if (user.role !== "employer") {
      console.log(`❌ Access denied: User role is "${user.role}", expected "employer"`);
      return res.status(403).json({ 
        success: false, 
        message: "Only employers can create projects",
        debug: process.env.NODE_ENV === 'development' ? debugLog : undefined
      });
    }
    console.log('✅ User role verified: employer');

    // 📝 Parse request body
    console.log('📝 Parsing request body...');
    const {
      title, description, category, duration, experienceLevel,
      budgetType, minBudget, maxBudget, skills, deliverables,
      milestones  
    } = req.body;

    debugLog.data.requestBody = {
      title,
      description: description?.substring(0, 100) + '...', // Truncate for logs
      category,
      duration,
      experienceLevel,
      budgetType,
      minBudget,
      maxBudget,
      skills: skills?.substring(0, 100),
      deliverables: deliverables?.substring(0, 100),
      milestones: milestones?.substring(0, 100)
    };

    console.log('📋 Request data summary:', {
      title,
      category,
      duration,
      budgetType,
      minBudget,
      maxBudget
    });

    // 🖼️ Validate media files
    console.log('📎 Checking media files...');
    console.log(`Files received: ${req.files?.length || 0}`);
    
    if (!req.files || req.files.length === 0) {
      console.log('❌ No media files uploaded');
      return res.status(400).json({
        success: false,
        message: 'At least one media file is required.',
        debug: process.env.NODE_ENV === 'development' ? debugLog : undefined
      });
    }
    console.log(`✅ ${req.files.length} media files received`);

    // 🖼️ Process media files
    console.log('🖼️ Processing media files...');
    const mediaFiles = req.files.map((file, index) => ({
      fileName: file.originalname,
      fileUrl: file.path,
      fileType: file.mimetype,
      publicId: file.filename,
    }));
    console.log(`✅ Processed ${mediaFiles.length} media files`);

    // 👤 Build employer snapshot
    console.log('📸 Building employer snapshot...');
    const employerSnapshot = buildEmployerSnapshot(user);
    console.log('✅ Employer snapshot created');

    // 📅 Parse milestones if they exist
    let parsedMilestones = [];
    if (milestones) {
      console.log('📅 Processing milestones...');
      debugLog.data.rawMilestones = milestones;
      
      try {
        parsedMilestones = JSON.parse(milestones);
        console.log(`✅ Successfully parsed ${parsedMilestones.length} milestones`);
        
        // Validate milestone structure
        parsedMilestones.forEach((milestone, index) => {
          console.log(`  Milestone ${index + 1}:`, {
            title: milestone.title,
            amount: milestone.amount,
            dueDate: milestone.dueDate
          });
          
          if (!milestone.title || !milestone.amount) {
            console.log(`⚠️ Warning: Milestone ${index + 1} missing required fields`);
          }
        });
        
      } catch (e) {
        console.error('❌ Failed to parse milestones:', e.message);
        console.error('Raw milestones string:', milestones);
        debugLog.error = { milestoneParsing: e.message };
      }
    } else {
      console.log('ℹ️ No milestones provided');
    }

    // 🛠️ Parse skills and deliverables
    console.log('🛠️ Parsing skills and deliverables...');
    let parsedSkills = [];
    let parsedDeliverables = [];
    
    try {
      parsedSkills = skills ? JSON.parse(skills) : [];
      console.log(`✅ Parsed ${parsedSkills.length} skills:`, parsedSkills);
    } catch (e) {
      console.error('❌ Failed to parse skills:', e.message);
      parsedSkills = [];
    }
    
    try {
      parsedDeliverables = deliverables ? JSON.parse(deliverables) : [];
      console.log(`✅ Parsed ${parsedDeliverables.length} deliverables`);
    } catch (e) {
      console.error('❌ Failed to parse deliverables:', e.message);
      parsedDeliverables = [];
    }

    // 📊 Calculate milestone total
    let milestoneTotal = 0;
    if (parsedMilestones.length > 0) {
      milestoneTotal = parsedMilestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
      console.log(`💰 Total milestones amount: ${milestoneTotal}`);
      
      // ⚠️ Validate milestone total vs maxBudget
      const maxBudgetNum = Number(maxBudget);
      if (milestoneTotal > maxBudgetNum) {
        console.log(`⚠️ Warning: Milestone total (${milestoneTotal}) exceeds max budget (${maxBudgetNum})`);
      }
    }

    // 🏗️ Create project object
    console.log('🏗️ Creating new project object...');
    const projectData = {
      title,
      description,
      category,
      duration,
      experienceLevel,
      budgetType,
      minBudget: Number(minBudget),
      maxBudget: Number(maxBudget),
      skills: parsedSkills,
      deliverables: parsedDeliverables,
      media: mediaFiles,
      milestones: parsedMilestones,
      postedBy: user._id,
      employerSnapshot,
    };
    
    console.log('Project data summary:', {
      title: projectData.title,
      category: projectData.category,
      budgetRange: `${projectData.minBudget} - ${projectData.maxBudget}`,
      skillsCount: projectData.skills.length,
      deliverablesCount: projectData.deliverables.length,
      milestonesCount: projectData.milestones.length,
      mediaCount: projectData.media.length
    });

    const newProject = new Project(projectData);
    console.log('✅ Project instance created');

    // 💾 Save to database
    console.log('💾 Saving project to database...');
    debugLog.step = 'saving_project';
    
    const savedProject = await newProject.save();
    console.log('✅ Project saved successfully!');
    console.log(`📋 Project ID: ${savedProject._id}`);
    console.log(`📋 Created At: ${savedProject.createdAt}`);
    
    debugLog.data.savedProject = {
      id: savedProject._id,
      title: savedProject.title,
      status: savedProject.status,
      createdAt: savedProject.createdAt
    };

    // 📝 Log final response
    console.log('🎉 Project creation completed successfully');
    console.log('=' .repeat(60));
    
    return res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project: savedProject,
      debug: process.env.NODE_ENV === 'development' ? debugLog : undefined
    });
    
  } catch (error) {
    // 🚨 Error handling with detailed debugging
    console.error('=' .repeat(60));
    console.error('❌ [Project Create Error]');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    
    // Check for specific error types
    if (error.name === 'ValidationError') {
      console.error('📋 Validation Errors:');
      Object.keys(error.errors).forEach(key => {
        console.error(`  - ${key}: ${error.errors[key].message}`);
      });
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.errors,
        debug: process.env.NODE_ENV === 'development' ? debugLog : undefined
      });
    }
    
    if (error.code === 11000) {
      console.error('🔑 Duplicate key error:', error.keyPattern);
      return res.status(409).json({
        success: false,
        message: 'Duplicate entry detected',
        field: Object.keys(error.keyPattern)[0],
        debug: process.env.NODE_ENV === 'development' ? debugLog : undefined
      });
    }
    
    if (error.name === 'CastError') {
      console.error('🔄 Cast error:', error.path, error.value);
      return res.status(400).json({
        success: false,
        message: 'Invalid data format',
        field: error.path,
        debug: process.env.NODE_ENV === 'development' ? debugLog : undefined
      });
    }
    
    // Generic error response
    console.error('💥 Unexpected error occurred');
    debugLog.step = 'error';
    debugLog.error = {
      name: error.name,
      message: error.message,
      stack: error.stack?.substring(0, 500)
    };
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      debug: process.env.NODE_ENV === 'development' ? debugLog : undefined
    });
  }
};  exports.updateProject = async (req, res) => {
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
exports.getAllProjects = async (req, res) => {
  try {
    let query = {};
    const userId = req.user.id;
    
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6; // 6 items per page
    const skip = (page - 1) * limit;
    
    // Get user role
    const user = await User.findById(userId);
    
    if (user.role === 'employer') {
      // Employer: don't show own projects
      query = { postedBy: { $ne: userId } };
    }
    // Employee: show all projects
    
    // Get total count for pagination
    const totalProjects = await Project.countDocuments(query);
    
    // Get paginated projects
    const projects = await Project.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Calculate pagination info
    const totalPages = Math.ceil(totalProjects / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    return res.status(200).json({
      success: true,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalProjects,
        itemsPerPage: limit,
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null,
      },
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
    console.log("🚀 API HIT: getMyProjectsWithProposals");

    const employerId = req.user.id;
    console.log("👤 Employer ID:", employerId);

    const projects = await Project.aggregate([
      {
        $match: {
          postedBy: new mongoose.Types.ObjectId(employerId),
        },
      },

      {
        $lookup: {
          from: "proposals",
          localField: "_id",
          foreignField: "projectId",
          as: "proposals",
        },
      },

      {
        $lookup: {
          from: "users",
          localField: "proposals.employeeId",
          foreignField: "_id",
          as: "employees",
        },
      },

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
          employees: 0,
          contracts: 0,
        },
      },

      {
        $sort: { createdAt: -1 },
      },
    ]);

    // ✅ DEBUGGING STARTS HERE

    console.log("📊 Total Projects Found:", projects.length);

    projects.forEach((project, i) => {
      console.log(`\n📁 Project #${i + 1}`);
      console.log("🆔 ID:", project._id);
      console.log("📌 Title:", project.title);
      console.log("📊 Status:", project.status);
      console.log("📨 Total Proposals:", project.proposals?.length || 0);

      project.proposals?.forEach((proposal, j) => {
        console.log(`   ➡️ Proposal #${j + 1}`);
        console.log("      🆔 Proposal ID:", proposal._id);
        console.log("      💰 Price:", proposal.fixedPrice);
        console.log("      📊 Status:", proposal.status);

        if (proposal.employee) {
          console.log("      👤 Employee ID:", proposal.employee._id);
          console.log("      👤 Employee Name:", proposal.employee.name);
        } else {
          console.log("      ⚠️ No Employee Found");
        }

        if (proposal.contract) {
          console.log("      📄 Contract ID:", proposal.contract._id);
          console.log("      📄 Contract Status:", proposal.contract.status);
        } else {
          console.log("      ⚠️ No Contract Found");
        }
      });
    });

    console.log("✅ Sending response to frontend");

    res.status(200).json({
      total: projects.length,
      projects,
    });

  } catch (error) {
    console.error("🔥 ERROR in getMyProjectsWithProposals");
    console.error("❌ Message:", error.message);
    console.error("📍 Stack:", error.stack);

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