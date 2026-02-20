// routes/submissionRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const upload = require('../middleware/multer');
const submissionController = require('../controllers/submissionController');

// All routes require authentication
router.use(auth);

// ==================== EMPLOYEE ROUTES ====================

// Submit work with file attachments (max 5 files)
router.post(
  '/submit',
  upload.array('attachments', 5),
  submissionController.submitWork
);

// Get submission status for employee
router.get(
  '/status/:projectId/:milestoneId',
  submissionController.getSubmissionStatus
);

// ==================== EMPLOYER ROUTES ====================

// Get submission by project and milestone (for employer review)
router.get(
  '/project/:projectId/milestone/:milestoneId',
  submissionController.getSubmissionByMilestone
);

// Get all submissions for a project
router.get(
  '/project/:projectId',
  submissionController.getProjectSubmissions
);

// Approve submission
router.post(
  '/approve/:submissionId',
  submissionController.approveSubmission
);

// Request revision
router.post(
  '/revision/:submissionId',
  submissionController.requestRevision
);

module.exports = router;