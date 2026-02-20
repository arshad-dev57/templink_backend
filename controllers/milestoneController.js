const Project = require('../models/project');
const mongoose = require("mongoose");

// Update Milestone Status: For when payment is processed or employer approves work
exports.updateMilestoneStatus = async (req, res) => {
  try {
    const { projectId, milestoneId, status } = req.body;

    // Ensure we have valid input
    if (!projectId || !milestoneId || !status) {
      return res.status(400).json({ success: false, message: "Missing parameters" });
    }

    // Find project by ID
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    // Find milestone by ID
    const milestone = project.milestones.id(milestoneId);
    if (!milestone) {
      return res.status(404).json({ success: false, message: "Milestone not found" });
    }

    // Update milestone status
    milestone.status = status;

    // Track dates for milestone status changes
    if (status === 'FUNDED') {
      milestone.fundedAt = new Date();
    } else if (status === 'SUBMITTED') {
      milestone.submittedAt = new Date();
    } else if (status === 'APPROVED') {
      milestone.approvedAt = new Date();
    } else if (status === 'RELEASED') {
      milestone.releasedAt = new Date();
    }

    // Save the project with updated milestone status
    await project.save();

    return res.status(200).json({
      success: true,
      message: `Milestone status updated to ${status}`,
      milestone,
    });
  } catch (error) {
    console.error('[Update Milestone Status Error]', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};


// Create Payment API (For future Stripe integration)
exports.processMilestonePayment = async (req, res) => {
  try {
    const { projectId, milestoneId, paymentMethod } = req.body;
    const project = await Project.findById(projectId);
    const milestone = project.milestones.id(milestoneId);

    if (!milestone || milestone.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: "Milestone is not in pending status" });
    }

    // Here, we'll simulate payment processing (For now without Stripe)
    milestone.paymentStatus = 'PAID';
    milestone.paymentMethod = paymentMethod; // This can be 'WALLET' or 'CARD'
    milestone.fundedAt = new Date(); // Date when payment was made
    milestone.status = 'FUNDED'; // Change milestone status to FUNDED

    // Save the updated project with paid milestone
    await project.save();

    return res.status(200).json({
      success: true,
      message: 'Milestone payment processed successfully',
      milestone,
    });
  } catch (error) {
    console.error('[Process Milestone Payment Error]', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};