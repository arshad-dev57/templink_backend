// controllers/resumeController.js
const Resume = require('../models/Resume');
const mongoose = require('mongoose');

// ==================== GET ALL RESUMES ====================
exports.getMyResumes = async (req, res) => {
  try {
    const userId = req.user.id;

    const resumes = await Resume.find({ userId })
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: resumes.length,
      resumes
    });

  } catch (error) {
    console.error('Get resumes error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== GET SINGLE RESUME ====================
exports.getResumeById = async (req, res) => {
  try {
    const { resumeId } = req.params;
    const userId = req.user.id;

    const resume = await Resume.findOne({ _id: resumeId, userId });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    return res.status(200).json({
      success: true,
      resume
    });

  } catch (error) {
    console.error('Get resume error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== CREATE RESUME ====================
exports.createResume = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title } = req.body;

    const resume = await Resume.create({
      userId,
      title: title || 'My Resume',
      status: 'draft'
    });

    return res.status(201).json({
      success: true,
      message: 'Resume created successfully',
      resume
    });

  } catch (error) {
    console.error('Create resume error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== UPDATE RESUME ====================
exports.updateResume = async (req, res) => {
  try {
    const { resumeId } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    const resume = await Resume.findOneAndUpdate(
      { _id: resumeId, userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Resume updated successfully',
      resume
    });

  } catch (error) {
    console.error('Update resume error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== DELETE RESUME ====================
exports.deleteResume = async (req, res) => {
  try {
    const { resumeId } = req.params;
    const userId = req.user.id;

    const resume = await Resume.findOneAndDelete({ _id: resumeId, userId });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Resume deleted successfully'
    });

  } catch (error) {
    console.error('Delete resume error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== DUPLICATE RESUME ====================
exports.duplicateResume = async (req, res) => {
  try {
    const { resumeId } = req.params;
    const userId = req.user.id;

    const original = await Resume.findOne({ _id: resumeId, userId });

    if (!original) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    // Create copy
    const duplicate = new Resume({
      ...original.toObject(),
      _id: new mongoose.Types.ObjectId(),
      title: `${original.title} (Copy)`,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await duplicate.save();

    return res.status(201).json({
      success: true,
      message: 'Resume duplicated successfully',
      resume: duplicate
    });

  } catch (error) {
    console.error('Duplicate resume error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== UPDATE SECTION ====================
exports.updateSection = async (req, res) => {
  try {
    const { resumeId, section } = req.params;
    const userId = req.user.id;
    const data = req.body;

    const updateQuery = {};
    updateQuery[section] = data;

    const resume = await Resume.findOneAndUpdate(
      { _id: resumeId, userId },
      { $set: updateQuery },
      { new: true, runValidators: true }
    );

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: `${section} updated successfully`,
      resume
    });

  } catch (error) {
    console.error('Update section error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};