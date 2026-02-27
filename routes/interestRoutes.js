// routes/interestRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const interestController = require('../controllers/interest_controller');

// All routes require authentication
router.use(auth);

// Send interest request
router.post('/send', interestController.sendInterest);

// Get employer's sent requests
router.get('/employer-list', interestController.getEmployerRequests);

// Get employee's received requests
router.get('/employee-list', interestController.getEmployeeRequests);

// Get count for badge
router.get('/count', interestController.getRequestCount);

// Employee responds to request
router.patch('/respond/:requestId', interestController.respondToRequest);

module.exports = router;