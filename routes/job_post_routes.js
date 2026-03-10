const express = require('express');
const router = express.Router();
const jobPostController = require('../controllers/jobpost_controller');
const auth = require('../middleware/auth_middleware');

// ==================== JOB POST ROUTES ====================

// Create job post
router.post('/job', auth, jobPostController.createJobPost);

// Get all jobs (with employee filtering)
router.get('/jobs', auth, jobPostController.getAllJobPosts);

// Get my jobs (employer's own jobs)
router.get('/my-jobs', auth, jobPostController.getMyJobPosts);

// ==================== CATEGORY BASED ROUTES ====================

// GET ALL CATEGORIES - Ye API saari categories fetch karegi
router.get('/job-categories', auth, jobPostController.getAllJobCategories);

// GET JOBS BY CATEGORY - Ye API category ke hisaab se jobs fetch karegi
router.get('/jobs/category/:category', auth, jobPostController.getJobsByCategory);

// POST JOBS BY MULTIPLE CATEGORIES - Agar multiple categories chahiyein to
router.post('/jobs/categories', auth, jobPostController.getJobsByCategories);

// ==================== JOB MANAGEMENT ROUTES ====================

// Delete job post
router.delete('/job/:jobId', auth, jobPostController.deleteJobPost);

// Pause job post
router.patch('/job/:jobId/pause', auth, jobPostController.pauseJobPost);

// Resume job post
router.patch('/job/:jobId/resume', auth, jobPostController.resumeJobPost);

// Get job status
router.get('/job/:jobId/status', auth, jobPostController.getJobStatus);

// Check job availability for employee
router.get('/job/:jobId/check-availability', auth, jobPostController.checkJobAvailability);

module.exports = router;