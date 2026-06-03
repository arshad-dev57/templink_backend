// routes/employer_dashboard_routes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const {
  getDashboardStats,
  getTeamStats,
  getJobsStats,
  getOfficeHours,
  updateOfficeHours,
  getAttendanceSettings,
   getTodayAttendanceStats,
  getEmployeeAttendanceHistory
} = require('../controllers/employer_attendance_dashbaord_controller');

// Dashboard stats routes
router.get('/dashboard-stats', auth, getDashboardStats);
router.get('/team-stats', auth, getTeamStats);
router.get('/jobs-stats', auth, getJobsStats);

// Office Hours routes
router.get('/office-hours', auth, getOfficeHours);
router.put('/office-hours', auth, updateOfficeHours);
router.get('/attendance-settings', auth, getAttendanceSettings);
router.get('/today-stats', auth, getTodayAttendanceStats);
router.get('/employee-history', auth, getEmployeeAttendanceHistory);
module.exports = router;



