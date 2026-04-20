const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const {
  employeeLeft,
  checkEmployerProtection,  // ✅ YEH IMPORT KARO
  checkJobProtection
} = require('../controllers/employeeLeaveController');

// Employee left route
router.patch('/application/:applicationId/left', auth, employeeLeft);

// Check employer level protection (for ALL jobs)
router.get('/employer/protection', auth, checkEmployerProtection);

// Check job specific protection (backward compatibility)
router.get('/job/:jobId/protection', auth, checkJobProtection);

module.exports = router;