// routes/talent_routes.js

const express = require('express');
const router = express.Router();
const talentController = require('../controllers/toptalent_controller');
const auth = require('../middleware/auth_middleware');

// ✅ Public APIs (but with auth for security)
router.get('/all', talentController.getAllTalents);
router.get('/:id', auth, talentController.getTalentById);

module.exports = router;