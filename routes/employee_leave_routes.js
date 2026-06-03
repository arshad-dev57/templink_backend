const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const {
  getLeaveBalance,
  applyLeave,
  getMyLeaves,
  getLeaveDetails,
  cancelLeaveRequest,
  getLeaveStats
} = require('../controllers/employee_leave_controller');

router.get('/balance', auth, getLeaveBalance);
router.get('/my-leaves', auth, getMyLeaves);
router.get('/stats', auth, getLeaveStats);
router.get('/:leaveId', auth, getLeaveDetails);
router.post('/apply', auth, applyLeave);
router.delete('/:leaveId', auth, cancelLeaveRequest);

module.exports = router;