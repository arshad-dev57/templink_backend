const express = require('express');
const router = express.Router();
const jobPostController = require('../controllers/jobpost_controller');
const auth = require('../middleware/auth_middleware'); // ✅ import your auth middleware

// ✅ Protected route (Bearer token required)
router.post('/job', auth, jobPostController.createJobPost);

// Public route
router.get('/jobs', jobPostController.getAllJobPosts);

module.exports = router;