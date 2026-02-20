const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const upload = require('../middleware/multer');
const auth = require('../middleware/auth_middleware');

// Create project (auth + upload)
router.post('/create', auth, upload.array('media', 10), projectController.createProject);
router.get("/employerprojects", auth, projectController.getMyProjects);

// Update project (auth + upload)
router.put('/update/:projectId', auth, upload.array('media', 10), projectController.updateProject);

// ✅ Get all projects (public)
router.get('/all',auth, projectController.getAllProjects);

// ✅ Get my projects (auth required)
router.get('/my-projects', auth, projectController.getMyProjects);
router.get(
  "/my-with-proposals",
  auth,
  projectController.getMyProjectsWithProposals
);
router.delete('/:projectId',auth,  projectController.deleteProject);


module.exports = router;