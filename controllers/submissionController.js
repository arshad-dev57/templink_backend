// controllers/submissionController.js - WITH AUTO RELEASE AND AUTO COMPLETE

const Submission = require('../models/Submission');
const Project = require('../models/project');
const Contract = require('../models/Contract');
const { Wallet, WalletTransaction } = require('../models/Wallet');
const mongoose = require('mongoose');

// ==================== SUBMIT WORK ====================
exports.submitWork = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { projectId, milestoneId, description, notes } = req.body;

    console.log('📦 Submitting work:', { projectId, milestoneId, employeeId });

    // 1. Verify contract exists
    const contract = await Contract.findOne({
      projectId,
      employeeId,
      status: 'ACTIVE'
    });

    if (!contract) {
      return res.status(403).json({
        success: false,
        message: 'No active contract found for this project'
      });
    }

    // 2. Get project and milestone
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const milestone = project.milestones.id(milestoneId);
    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: 'Milestone not found'
      });
    }

    // 3. Verify milestone is FUNDED
    if (milestone.status !== 'FUNDED') {
      return res.status(400).json({
        success: false,
        message: `Milestone is not ready for submission. Current status: ${milestone.status}`
      });
    }

    // 4. Check if already submitted
    const existingSubmission = await Submission.findOne({
      projectId,
      milestoneId,
      employeeId,
      status: { $in: ['PENDING', 'APPROVED'] }
    });

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted work for this milestone'
      });
    }

    // 5. Process attachments
    const attachments = (req.files || []).map(file => ({
      fileName: file.originalname,
      fileUrl: file.path,
      fileType: file.mimetype,
      fileSize: file.size,
      uploadedAt: new Date()
    }));

    // 6. Create submission record
    const submission = await Submission.create({
      projectId,
      milestoneId,
      employeeId,
      employerId: project.postedBy,
      milestoneTitle: milestone.title,
      description,
      notes: notes || '',
      attachments,
      status: 'PENDING',
      submittedAt: new Date()
    });

    // 7. Update milestone status
    milestone.status = 'SUBMITTED';
    milestone.submittedAt = new Date();
    await project.save();

    console.log('✅ Work submitted successfully:', submission._id);

    return res.status(201).json({
      success: true,
      message: 'Work submitted successfully',
      submission
    });

  } catch (error) {
    console.error('❌ Submit work error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== GET SUBMISSION BY PROJECT AND MILESTONE ====================
exports.getSubmissionByMilestone = async (req, res) => {
  try {
    const { projectId, milestoneId } = req.params;
    const employerId = req.user.id;

    console.log(`🔍 Fetching submission for project: ${projectId}, milestone: ${milestoneId}`);

    // Verify project ownership
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (project.postedBy.toString() !== employerId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You do not own this project'
      });
    }

    // Find submission
    const submission = await Submission.findOne({
      projectId,
      milestoneId,
      status: { $in: ['PENDING', 'SUBMITTED'] }
    }).sort({ createdAt: -1 });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'No submission found for this milestone'
      });
    }

    return res.status(200).json({
      success: true,
      submission
    });

  } catch (error) {
    console.error('❌ Get submission error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== GET SUBMISSION STATUS ====================
exports.getSubmissionStatus = async (req, res) => {
  try {
    const { projectId, milestoneId } = req.params;
    const employeeId = req.user.id;

    const submission = await Submission.findOne({
      projectId,
      milestoneId,
      employeeId
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      submission: submission || null
    });

  } catch (error) {
    console.error('Get submission status error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== APPROVE SUBMISSION WITH AUTO RELEASE AND AUTO COMPLETE ====================
exports.approveSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { feedback } = req.body;
    const employerId = req.user.id;

    console.log(`✅ Approving submission: ${submissionId}`);

    // 1. Find submission
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // 2. Verify project ownership
    const project = await Project.findById(submission.projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (project.postedBy.toString() !== employerId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You do not own this project'
      });
    }

    // 3. Get milestone
    const milestone = project.milestones.id(submission.milestoneId);
    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: 'Milestone not found'
      });
    }

    // 4. Update submission to APPROVED
    submission.status = 'APPROVED';
    submission.employerFeedback = feedback;
    submission.reviewedAt = new Date();
    await submission.save();

    // 5. AUTO-RELEASE PAYMENT - Update milestone to RELEASED
    milestone.status = 'RELEASED';
    milestone.releasedAt = new Date();
    
    // 6. Add money to employee's wallet
    let employeeWallet = await Wallet.findOne({ userId: submission.employeeId });
    
    if (!employeeWallet) {
      // Create wallet if doesn't exist
      employeeWallet = await Wallet.create({
        userId: submission.employeeId,
        balance: 0
      });
    }

    // Update wallet balance
    const newBalance = employeeWallet.balance + milestone.amount;
    employeeWallet.balance = newBalance;
    employeeWallet.lastTransactionAt = new Date();
    await employeeWallet.save();

    // 7. Create wallet transaction record
    await WalletTransaction.create({
      userId: submission.employeeId,
      type: 'CREDIT',
      amount: milestone.amount,
      balance: newBalance,
      description: `Payment received for milestone: ${milestone.title}`,
      reference: submission._id,
      metadata: {
        projectId: project._id,
        projectTitle: project.title,
        milestoneId: milestone._id,
        milestoneTitle: milestone.title,
        submissionId: submission._id
      }
    });

    // 8. Update project total paid
    project.totalPaid = (project.totalPaid || 0) + milestone.amount;
    
    // Update payment summary
    if (!project.paymentSummary) {
      project.paymentSummary = {};
    }
    project.paymentSummary = {
      totalBudget: project.maxBudget,
      paidAmount: project.totalPaid,
      pendingAmount: Math.max(0, project.maxBudget - project.totalPaid),
      lastPaymentAt: new Date()
    };
    
    await project.save();

    console.log('✅ Work approved and payment released automatically');
    console.log(`💰 Amount ${milestone.amount} credited to employee wallet`);
    console.log(`💳 Employee new balance: ${newBalance}`);

    // 🔥 CHECK AND AUTO-COMPLETE PROJECT IF ALL MILESTONES ARE RELEASED
    const allMilestonesReleased = project.milestones.every(
      m => m.status === 'RELEASED'
    );

    let projectCompleted = false;
    if (allMilestonesReleased) {
      console.log('🎯 All milestones released! Triggering auto-complete...');
      
      // Call the auto-complete function from projectController
      const projectController = require('./projectController');
      await projectController.checkAndAutoCompleteProject(project._id);
      projectCompleted = true;
    }

    return res.status(200).json({
      success: true,
      message: projectCompleted 
        ? 'Work approved, payment released, and project completed automatically!'
        : 'Work approved and payment released successfully',
      submission,
      payment: {
        amount: milestone.amount,
        newBalance,
        releasedAt: new Date()
      },
      projectCompleted
    });

  } catch (error) {
    console.error('❌ Approve submission error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== REQUEST REVISION ====================
exports.requestRevision = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { feedback } = req.body;
    const employerId = req.user.id;

    console.log(`🔄 Requesting revision for submission: ${submissionId}`);

    // 1. Find submission
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // 2. Verify project ownership
    const project = await Project.findById(submission.projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (project.postedBy.toString() !== employerId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You do not own this project'
      });
    }

    // 3. Update submission
    submission.status = 'REVISION_REQUESTED';
    submission.employerFeedback = feedback;
    submission.reviewedAt = new Date();
    await submission.save();

    // 4. Update milestone back to FUNDED for resubmission
    const milestone = project.milestones.id(submission.milestoneId);
    if (milestone) {
      milestone.status = 'FUNDED'; // Go back to FUNDED
      await project.save();
    }

    console.log('🔄 Revision requested successfully');

    return res.status(200).json({
      success: true,
      message: 'Revision requested successfully',
      submission
    });

  } catch (error) {
    console.error('❌ Revision request error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== GET ALL SUBMISSIONS FOR PROJECT ====================
exports.getProjectSubmissions = async (req, res) => {
  try {
    const { projectId } = req.params;
    const employerId = req.user.id;

    // Verify project ownership
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (project.postedBy.toString() !== employerId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const submissions = await Submission.find({ projectId })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: submissions.length,
      submissions
    });

  } catch (error) {
    console.error('Get project submissions error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};