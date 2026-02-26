const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth_middleware');
const upload = require('../middleware/multer');
const { 
  applyForJob,
  getEmployerApplications,
  getEmployeeApplications
} = require('../controllers/job_Application_Controller');
router.post('/apply/:jobId', protect, upload.single('resume'), applyForJob);
router.get('/employer', protect, getEmployerApplications);
router.get('/my', protect, getEmployeeApplications);

module.exports = router;