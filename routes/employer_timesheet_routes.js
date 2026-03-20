const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const {
  getAllTimesheets,
  getPendingTimesheets,
  getTimesheetDetails,
  approveTimesheet,
  rejectTimesheet,
  getTimesheetStats,
  getEmployeeTimesheets
} = require('../controllers/employer_timesheet_controller');

// Get all timesheets
router.get('/all', auth, getAllTimesheets);

// Get pending timesheets
router.get('/pending', auth, getPendingTimesheets);

// Get timesheet statistics
router.get('/stats', auth, getTimesheetStats);

// Get timesheet details
router.get('/:timesheetId', auth, getTimesheetDetails);

// Get employee's timesheets
router.get('/employee/:employeeId', auth, getEmployeeTimesheets);

// Approve timesheet
router.put('/:timesheetId/approve', auth, approveTimesheet);

// Reject timesheet
router.put('/:timesheetId/reject', auth, rejectTimesheet);

module.exports = router;