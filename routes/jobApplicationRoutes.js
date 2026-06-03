const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const upload = require('../middleware/multer');
const { 
  applyForJob,
  getEmployerApplications,
  getEmployeeApplications,
  getHiredEmployees
  
} = require('../controllers/job_Application_Controller');
router.post('/apply/:jobId', auth, upload.single('resume'), applyForJob);
router.get('/employer', auth, getEmployerApplications);
router.get('/my', auth, getEmployeeApplications);
router.get('/employer/hired', auth, getHiredEmployees);


module.exports = router;