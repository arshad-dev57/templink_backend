const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const {
  getAllLeaveRequests,
  getPendingLeaves,
  approveLeave,
  rejectLeave,
  getLeaveStatistics,
  getLeaveDetails
} = require('../controllers/employer_leave_controller');

router.get('/all', auth, getAllLeaveRequests);
router.get('/pending', auth, getPendingLeaves);
router.get('/stats', auth, getLeaveStatistics);
router.get('/:leaveId', auth, getLeaveDetails);
router.put('/:leaveId/approve', auth, approveLeave);
router.put('/:leaveId/reject', auth, rejectLeave);

module.exports = router;