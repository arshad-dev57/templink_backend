// routes/employee_project_routes.js - rename to employee.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const employeeProjectController = require('../controllers/employee_project_controller');

router.use(auth);

router.get('/projects', employeeProjectController.getMyActiveProjects);
router.get('/projects/:projectId', employeeProjectController.getProjectDetails);

module.exports = router;