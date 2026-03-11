const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const upload = require('../middleware/multer');
const submissionController = require('../controllers/submissionController');

router.use(auth);

// ==================== EMPLOYEE ROUTES ====================

// Submit work with file attachments
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

router.post('/download-file', submissionController.downloadFile);
  
// ==================== EMPLOYER ROUTES ====================

// Get submission by project and milestone
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