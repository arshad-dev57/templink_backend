const Submission = require('../models/Submission');
const Project = require('../models/project');
const Contract = require('../models/Contract');
const { Wallet, WalletTransaction } = require('../models/Wallet');
const mongoose = require('mongoose');
const cloudinary = require('../config/cloudinary');

// ==================== SUBMIT WORK ====================
exports.submitWork = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { projectId, milestoneId, description, notes } = req.body;

    console.log('📦 Submitting work:', { projectId, milestoneId, employeeId });

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

    if (milestone.status !== 'FUNDED') {
      return res.status(400).json({
        success: false,
        message: `Milestone is not ready for submission. Current status: ${milestone.status}`
      });
    }

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

    const attachments = (req.files || []).map(file => ({
      fileName: file.originalname,
      fileUrl: file.path,
      fileType: file.mimetype,
      fileSize: file.size,
      uploadedAt: new Date()
    }));

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

// ==================== APPROVE SUBMISSION ====================
exports.approveSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { feedback } = req.body;
    const employerId = req.user.id;

    console.log(`✅ Approving submission: ${submissionId}`);

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

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

    const milestone = project.milestones.id(submission.milestoneId);
    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: 'Milestone not found'
      });
    }

    submission.status = 'APPROVED';
    submission.employerFeedback = feedback;
    submission.reviewedAt = new Date();
    await submission.save();

    milestone.status = 'RELEASED';
    milestone.releasedAt = new Date();

    let employeeWallet = await Wallet.findOne({ userId: submission.employeeId });

    if (!employeeWallet) {
      employeeWallet = await Wallet.create({
        userId: submission.employeeId,
        balance: 0
      });
    }

    const newBalance = employeeWallet.balance + milestone.amount;
    employeeWallet.balance = newBalance;
    employeeWallet.lastTransactionAt = new Date();
    await employeeWallet.save();

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

    project.totalPaid = (project.totalPaid || 0) + milestone.amount;

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

    const allMilestonesReleased = project.milestones.every(
      m => m.status === 'RELEASED'
    );

    let projectCompleted = false;
    if (allMilestonesReleased) {
      console.log('🎯 All milestones released! Triggering auto-complete...');
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

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

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

    submission.status = 'REVISION_REQUESTED';
    submission.employerFeedback = feedback;
    submission.reviewedAt = new Date();
    await submission.save();

    const milestone = project.milestones.id(submission.milestoneId);
    if (milestone) {
      milestone.status = 'FUNDED';
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
};exports.downloadFile = async (req, res) => {
  try {
    const { fileUrl } = req.body;
    if (!fileUrl) return res.status(400).json({ message: 'fileUrl is required' });

    const urlParts = fileUrl.split('/upload/');
    const afterUpload = urlParts[1];
    const withoutVersion = afterUpload.replace(/^v\d+\//, '');
    const fileName = withoutVersion.split('/').pop();
    const extension = fileName.split('.').pop().toLowerCase();
    const publicId = withoutVersion.replace(/\.[^/.]+$/, '');

    console.log('📋 Downloading via Admin API, public_id:', publicId);

    // ✅ Cloudinary Admin API se binary data fetch karo
    const result = await cloudinary.api.resource(publicId, {
      resource_type: 'image',
    });

    // ✅ Signed delivery URL banao — expiry ke saath
    const timestamp = Math.round(Date.now() / 1000) + 3600;
    
    const signedUrl = cloudinary.url(publicId, {
      resource_type: 'image',
      type: 'upload',
      sign_url: true,
      secure: true,
      expires_at: timestamp,
    });

    console.log('🔗 Final URL:', signedUrl);

    // ✅ Node https module se download karo — axios nahi
    const https = require('https');
    
    const mimeTypes = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    res.setHeader('Content-Type', mimeTypes[extension] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    https.get(signedUrl, (fileResponse) => {
      console.log('📥 Cloudinary response status:', fileResponse.statusCode);
      
      if (fileResponse.statusCode === 401 || fileResponse.statusCode === 403) {
        console.log('❌ Still unauthorized — trying direct URL with API auth');
        
        // ✅ Last resort — API key/secret se Basic Auth
        const options = {
          hostname: 'api.cloudinary.com',
          path: `/v1_1/duzawmkrm/resources/image/upload/${encodeURIComponent(publicId)}`,
          auth: `726579868821175:rD3RmMwrB0f2OjcEp1v6cXR7syk`,
        };
        
        https.get(options, (r) => {
          r.pipe(res);
        }).on('error', (e) => {
          if (!res.headersSent) res.status(500).json({ message: e.message });
        });
        return;
      }
      
      if (fileResponse.statusCode !== 200) {
        if (!res.headersSent) res.status(fileResponse.statusCode).json({ 
          message: `Cloudinary returned ${fileResponse.statusCode}` 
        });
        return;
      }
      
      if (fileResponse.headers['content-length']) {
        res.setHeader('Content-Length', fileResponse.headers['content-length']);
      }
      
      fileResponse.pipe(res);
      fileResponse.on('end', () => console.log('✅ File sent successfully'));
    }).on('error', (err) => {
      console.error('❌ HTTPS error:', err);
      if (!res.headersSent) res.status(500).json({ message: err.message });
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (!res.headersSent) res.status(500).json({ message: error.message });
  }
};