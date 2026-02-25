const router = require('express').Router();
const auth = require('../middleware/auth_middleware');
const upload = require('../middleware/multer');
const {
  uploadResume,
  getUserResumes,
  deleteResume,
  setDefaultResume,
} = require('../controllers/resume_controller');

// Add a console.log to debug
console.log('authenticate middleware:', auth); 

// All routes require authentication
if (auth) {
  router.use(auth);
} else {
  console.error('❌ authenticate middleware is undefined!');
}

router.post('/', upload.single('resume'), uploadResume);

router.get('/', getUserResumes);

router.delete('/:id', deleteResume);

// PATCH /api/resumes/:id/default – set as default
router.patch('/:id/default', setDefaultResume);

module.exports = router;