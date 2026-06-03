const express = require('express');
const router = express.Router();
const jobPostController = require('../controllers/jobpost_controller');
const auth = require('../middleware/auth_middleware');


// Create job post
router.post('/job', auth, jobPostController.createJobPost);
router.post('/bulkjob', auth, jobPostController.createBulkJobPosts);
// Get all jobs (with employee filtering)
router.get('/jobs', auth, jobPostController.getAllJobPosts);
router.get('/my-jobs', auth, jobPostController.getMyJobPosts);
router.get('/job-categories', auth, jobPostController.getAllJobCategories);
router.get('/jobs/category/:category', auth, jobPostController.getJobsByCategory);
router.post('/jobs/categories', auth, jobPostController.getJobsByCategories);

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