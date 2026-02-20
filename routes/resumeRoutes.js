// routes/resumeRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const resumeController = require('../controllers/resumeController');

// All routes require authentication
router.use(auth);

// ==================== RESUME ROUTES ====================

// Get all resumes
router.get('/', resumeController.getMyResumes);

// Get single resume
router.get('/:resumeId', resumeController.getResumeById);

// Create new resume
router.post('/', resumeController.createResume);

// Update resume
router.put('/:resumeId', resumeController.updateResume);

// Delete resume
router.delete('/:resumeId', resumeController.deleteResume);

// Duplicate resume
router.post('/:resumeId/duplicate', resumeController.duplicateResume);

// Update specific section
router.patch('/:resumeId/section/:section', resumeController.updateSection);

module.exports = router;