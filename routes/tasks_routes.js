const express = require('express');
const router = express.Router();
const {
  createTask,
  getEmployerTasks,
  getEmployeeTasks,
  getTaskById,
  updateTaskStatus,
  updateTask,
  addComment,
  addFeedback,
  archiveTask,
  getTaskStatistics
} = require('../controllers/taskController');
const auth = require('../middleware/auth_middleware');

// All routes require authentication
router.use(auth);

// Task CRUD
router.post('/', createTask);
router.get('/employer', getEmployerTasks);
router.get('/employee', getEmployeeTasks);
router.get('/statistics', getTaskStatistics);
router.get('/:taskId', getTaskById);
router.put('/:taskId', updateTask);
router.patch('/:taskId/status', updateTaskStatus);
router.patch('/:taskId/archive', archiveTask);
router.post('/:taskId/comments', addComment);
router.post('/:taskId/feedback', addFeedback);

module.exports = router;