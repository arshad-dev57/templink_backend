const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth_middleware');
const upload = require('../middleware/multer'); // Reuse your existing multer config
const { 
  applyForJob,
  getEmployerApplications,
  getEmployeeApplications
} = require('../controllers/job_Application_Controller');

// ===== APPLY FOR JOB (with PDF upload) =====
router.post('/apply/:jobId', protect, upload.single('resume'), applyForJob);

// ===== GET APPLICATIONS FOR EMPLOYER =====
router.get('/employer', protect, getEmployerApplications);

// ===== GET MY APPLICATIONS (Employee) =====
router.get('/my', protect, getEmployeeApplications);

module.exports = router;