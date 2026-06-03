 // routes/employee_dashboard_routes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const {
  getEmployeeDashboard,
  getEmployeeProfile,
  getEmployeeCompanies,
    checkIn,
  checkOut,
  getTodayAttendance,
  getAttendanceHistory
} = require('../controllers/employee_attendance_dashboard_controller');

// Main dashboard endpoint - gets everything
router.get('/dashboard', auth, getEmployeeDashboard);

// Get employee profile only
router.get('/profile', auth, getEmployeeProfile);

// Get companies only (where employee is/was hired)
router.get('/companies', auth, getEmployeeCompanies);

router.post('/check-in', auth, checkIn);
router.post('/check-out', auth, checkOut);
router.get('/today', auth, getTodayAttendance);
router.get('/history', auth, getAttendanceHistory);
module.exports = router;


