// routes/jobApplicationRoutes.js
const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth_middleware');
const { 
  applyForJob,
  getEmployerApplications,
  getEmployeeApplications
} = require('../controllers/job_Application_Controller');

// ===== ROUTE 1: Apply for job (Employee) =====
router.post('/apply/:jobId', protect, applyForJob);

// ===== ROUTE 2: Get applications for employer (Employer) =====
router.get('/employer', protect, getEmployerApplications);

// ===== ROUTE 3: Get my applications (Employee) =====
router.get('/my', protect, getEmployeeApplications);

module.exports = router;