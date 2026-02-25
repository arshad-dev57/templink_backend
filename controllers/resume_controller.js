const Resume = require('../models/Resume');
const cloudinary = require('../config/cloudinary'); // v2 export

// @desc    Upload a new resume (PDF)
// @route   POST /api/resumes
// @access  Private (employee only)
exports.uploadResume = async (req, res) => {
  try {
    // ✅ AUTH MIDDLEWARE KE HISAB SE - req.user.id use karo
    const userId = req.user.id;  // 👈 YAHI SAHI HAI

    console.log('✅ User ID from token:', userId);

    if (!req.file) {
      return res.status(400).json({ message: 'No PDF file uploaded' });
    }

    // Check if this is the first resume – make it default automatically
    const existingCount = await Resume.countDocuments({ userId });
    const isDefault = existingCount === 0;

    // Create resume record using Cloudinary file data
    const resume = await Resume.create({
      userId,                      // 👈 YEH userId ab sahi value lega
      fileName: req.file.originalname,
      fileUrl: req.file.path,           // Cloudinary URL
      cloudinaryPublicId: req.file.filename, // Cloudinary public_id
      fileSize: req.file.size,
      isDefault,
    });

    res.status(201).json({
      message: 'Resume uploaded successfully',
      resume,
    });
  } catch (error) {
    console.error('Upload resume error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all resumes of the logged-in user
// @route   GET /api/resumes
// @access  Private
exports.getUserResumes = async (req, res) => {
  try {
    // ✅ AUTH MIDDLEWARE KE HISAB SE
    const userId = req.user.id;  // 👈 YAHI SAHI HAI
    
    const resumes = await Resume.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
    res.json(resumes);
  } catch (error) {
    console.error('Get resumes error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete a resume (and remove from Cloudinary)
// @route   DELETE /api/resumes/:id
// @access  Private (owner)
exports.deleteResume = async (req, res) => {
  try {
    // ✅ AUTH MIDDLEWARE KE HISAB SE
    const userId = req.user.id;  // 👈 YAHI SAHI HAI
    const resumeId = req.params.id;

    const resume = await Resume.findOne({ _id: resumeId, userId });
    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    // Delete from Cloudinary if public_id exists
    if (resume.cloudinaryPublicId) {
      await cloudinary.uploader.destroy(resume.cloudinaryPublicId, { resource_type: 'raw' });
    }

    await resume.deleteOne();

    // If the deleted resume was default, set another resume as default
    if (resume.isDefault) {
      const nextResume = await Resume.findOne({ userId });
      if (nextResume) {
        nextResume.isDefault = true;
        await nextResume.save();
      }
    }

    res.json({ message: 'Resume deleted successfully' });
  } catch (error) {
    console.error('Delete resume error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Set a resume as default
// @route   PATCH /api/resumes/:id/default
// @access  Private
exports.setDefaultResume = async (req, res) => {
  try {
    // ✅ AUTH MIDDLEWARE KE HISAB SE
    const userId = req.user.id;  // 👈 YAHI SAHI HAI
    const resumeId = req.params.id;

    const resume = await Resume.findOne({ _id: resumeId, userId });
    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    await Resume.updateMany({ userId, isDefault: true }, { isDefault: false });

    // Set new default
    resume.isDefault = true;
    await resume.save();

    res.json({ message: 'Default resume updated', resume });
  } catch (error) {
    console.error('Set default resume error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};