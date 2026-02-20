// controllers/employee_project_controller.js
const Project = require('../models/project');
const Contract = require('../models/Contract');
// controllers/employee_project_controller.js

exports.getMyActiveProjects = async (req, res) => {
  try {
    const employeeId = req.user.id;

    const contracts = await Contract.find({
      employeeId: employeeId,
      status: { $in: ['ACTIVE', 'PENDING_EMPLOYEE_SIGN'] }
    }).populate('projectId');

    const projects = await Promise.all(contracts.map(async (contract) => {
      const project = await Project.findById(contract.projectId._id)
        .select('title description milestones status maxBudget employerSnapshot');
      
      if (!project) return null;

      const totalMilestones = project.milestones?.length || 0;
      const completedMilestones = project.milestones?.filter(m => 
        ['APPROVED', 'RELEASED'].includes(m.status)
      ).length || 0;

      const nextMilestone = project.milestones?.find(m => m.status === 'FUNDED');
      
      return {
        _id: project._id,
        title: project.title,
        description: project.description,
        status: project.status,
        budget: project.maxBudget,
        employerName: project.employerSnapshot?.companyName || 
                      `${project.employerSnapshot?.firstName || ''} ${project.employerSnapshot?.lastName || ''}`.trim() ||
                      'Client',
        employerLogo: project.employerSnapshot?.logoUrl || null,
        
        // ✅ ADD THIS - Send milestones array
        milestones: project.milestones || [],  // 👈 IMPORTANT
        
        totalMilestones,
        completedMilestones,
        nextMilestone: nextMilestone ? {
          _id: nextMilestone._id,
          title: nextMilestone.title,
          amount: nextMilestone.amount,
          status: nextMilestone.status
        } : null,
        contractId: contract._id,
        contractStatus: contract.status
      };
    }));

    const validProjects = projects.filter(p => p !== null);

    return res.status(200).json({
      success: true,
      projects: validProjects
    });

  } catch (error) {
    console.error('Get my active projects error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};
// ==================== ✅ NEW: GET SINGLE PROJECT DETAILS ====================
exports.getProjectDetails = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { projectId } = req.params;

    console.log(`🔍 Fetching project details for employee: ${employeeId}, project: ${projectId}`);

    // 1. Check if employee has contract for this project
    const contract = await Contract.findOne({
      projectId: projectId,
      employeeId: employeeId,
      status: { $in: ['ACTIVE', 'PENDING_EMPLOYEE_SIGN'] }
    });

    if (!contract) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this project'
      });
    }

    // 2. Get project details with all fields
    const project = await Project.findById(projectId)
      .select('title description category duration experienceLevel skills deliverables milestones status maxBudget employerSnapshot minBudget budgetType');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    console.log(`✅ Project found: ${project.title}`);
    console.log(`📊 Milestones count: ${project.milestones?.length || 0}`);

    // 3. Calculate milestone stats
    const totalMilestones = project.milestones?.length || 0;
    const completedMilestones = project.milestones?.filter(m => 
      ['APPROVED', 'RELEASED'].includes(m.status)
    ).length || 0;

    // 4. Calculate payment summary
    const totalPaid = project.milestones?.filter(m => m.paymentStatus === 'PAID')
      .reduce((sum, m) => sum + m.amount, 0) || 0;
    
    const remainingAmount = (project.maxBudget || 0) - totalPaid;

    // 5. Format response
    const projectData = {
      _id: project._id,
      title: project.title,
      description: project.description,
      category: project.category,
      duration: project.duration,
      experienceLevel: project.experienceLevel,
      budgetType: project.budgetType,
      minBudget: project.minBudget,
      maxBudget: project.maxBudget,
      skills: project.skills || [],
      deliverables: project.deliverables || [],
      status: project.status,
      
      // Employer Info
      employerId: project.postedBy,
      employerName: project.employerSnapshot?.companyName || 
                    `${project.employerSnapshot?.firstName || ''} ${project.employerSnapshot?.lastName || ''}`.trim() ||
                    'Client',
      employerLogo: project.employerSnapshot?.logoUrl || null,
      employerSnapshot: {
        rating: project.employerSnapshot?.rating || 0,
        companyName: project.employerSnapshot?.companyName,
        about: project.employerSnapshot?.about
      },

      // Contract Info
      contractId: contract._id,
      contractNumber: contract.contractNumber,
      contractStatus: contract.status,
      signedAt: contract.signedAt,

      // Milestones
      milestones: project.milestones || [],

      // Payment Summary
      totalBudget: project.maxBudget || 0,
      totalPaid: totalPaid,
      remainingAmount: remainingAmount,
      lastPaymentAt: project.milestones?.filter(m => m.fundedAt)
        .sort((a, b) => b.fundedAt - a.fundedAt)[0]?.fundedAt || null,

      // Progress
      totalMilestones: totalMilestones,
      completedMilestones: completedMilestones,
      progressPercentage: totalMilestones > 0 ? completedMilestones / totalMilestones : 0,

      // Next milestone
      nextMilestone: project.milestones?.find(m => m.status === 'FUNDED') || null,

      // Timestamps
      hiredAt: contract.createdAt,
      expectedEndDate: contract.terms?.endDate
    };

    return res.status(200).json({
      success: true,
      project: projectData
    });

  } catch (error) {
    console.error('❌ Get project details error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};