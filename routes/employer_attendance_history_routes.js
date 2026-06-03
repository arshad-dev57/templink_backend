// routes/employer_attendance_history_routes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const {
  getAttendanceHistory,
  getEmployeeAttendanceDetails,
  getTodayAttendanceStats
} = require('../controllers/employer_attendance_history_controller');

router.get('/history', auth, getAttendanceHistory);
router.get('/employee/:employeeId', auth, getEmployeeAttendanceDetails);
router.get('/today-stats', auth, getTodayAttendanceStats);

module.exports = router;