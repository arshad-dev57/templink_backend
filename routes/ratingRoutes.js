// routes/ratingRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const ratingController = require('../controllers/ratingController');

router.use(auth);

router.post('/submit', ratingController.submitRating);
router.get('/project/:projectId', ratingController.getProjectRating);

module.exports = router;