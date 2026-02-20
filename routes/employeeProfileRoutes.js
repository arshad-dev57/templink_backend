const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const employeeProfileController = require('../controllers/employeeProfileController');
const upload = require('../middleware/image_Upload'); // Make sure you have this middleware

console.log("🟡 Loading employee profile routes...");


// All routes require authentication
router.use(auth);

// GET employee profile
router.get('/profile',auth, employeeProfileController.getEmployeeProfile);

// UPDATE employee profile
router.put('/profile', employeeProfileController.updateEmployeeProfile);

// UPLOAD profile picture
router.post('/profile/picture', upload.single('photo'), employeeProfileController.uploadProfilePicture);

// WORK EXPERIENCE routes
router.post('/work-experience', employeeProfileController.addWorkExperience);
router.put('/work-experience/:experienceId', employeeProfileController.updateWorkExperience);
router.delete('/work-experience/:experienceId', employeeProfileController.deleteWorkExperience);

console.log("✅ Employee profile routes loaded");

module.exports = router;