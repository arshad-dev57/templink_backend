const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const employeeStatsController = require('../controllers/employeeStatsController');


// All routes require authentication
router.use(auth);

// Get employee stats
router.get('/', employeeStatsController.getEmployeeStats);

// Get earnings history
router.get('/earnings', employeeStatsController.getEarningsHistory);
// Get recent activity
router.get('/activity', employeeStatsController.getRecentActivity);
module.exports = router;