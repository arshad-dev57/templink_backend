const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const upload = require('../middleware/multer');
const auth = require('../middleware/auth_middleware');

// Create project (auth + upload)
router.post('/create', auth, upload.array('media', 10), projectController.createProject);

// Update project (auth + upload)
router.put('/update/:projectId', auth, upload.array('media', 10), projectController.updateProject);

// ✅ Get all projects (public)
router.get('/all', projectController.getAllProjects);

// ✅ Get single project (public)
router.get('/:projectId', projectController.getProjectById);

// ✅ Get my projects (auth required)
router.get('/my/list', auth, projectController.getMyProjects);

module.exports = router;