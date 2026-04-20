const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const employerProfileController = require('../controllers/employerProfileController');
const upload = require('../middleware/image_Upload');

console.log("🟡 Loading employer profile routes...");

// All routes require authentication
router.use(auth);

// GET employer profile
router.get('/profile', employerProfileController.getEmployerProfile);
router.get('/team-members', auth, employerProfileController.getTeamMembers);


// UPDATE employer profile
router.put('/profile', employerProfileController.updateEmployerProfile);

// UPLOAD company logo
router.post('/profile/logo', upload.single('logo'), employerProfileController.uploadCompanyLogo);

// TEAM MEMBER routes
router.post('/team-member', employerProfileController.addTeamMember);
router.delete('/team-member/:memberIndex', employerProfileController.removeTeamMember);

console.log("✅ Employer profile routes loaded");

module.exports = router;