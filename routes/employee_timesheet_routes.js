const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const {
  addTimeEntry,
  getWeeklyTimesheet,
  getTimesheetHistory,
  getProjectBreakdown,
  updateTimeEntry,
  deleteTimeEntry
} = require('../controllers/timesheet_controller');

router.post('/add', auth, addTimeEntry);
router.get('/weekly', auth, getWeeklyTimesheet);
router.get('/history', auth, getTimesheetHistory);
router.get('/projects', auth, getProjectBreakdown);
router.put('/:entryId', auth, updateTimeEntry);
router.delete('/:entryId', auth, deleteTimeEntry);

module.exports = router;