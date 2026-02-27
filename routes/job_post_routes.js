const express = require('express');
const router = express.Router();
const jobPostController = require('../controllers/jobpost_controller');
const auth = require('../middleware/auth_middleware');

router.post('/job', auth, jobPostController.createJobPost);

// Public route
router.get('/jobs',auth, jobPostController.getAllJobPosts);
router.get('/my-jobs', auth, jobPostController.getMyJobPosts);
router.delete('/job/:jobId',auth, jobPostController.deleteJobPost);
router.patch('/job/:jobId/pause',auth, jobPostController.pauseJobPost);
router.patch('/job/:jobId/resume',auth, jobPostController.resumeJobPost);

// Get job status
router.get('/job/:jobId/status',auth, jobPostController.getJobStatus);
module.exports = router;