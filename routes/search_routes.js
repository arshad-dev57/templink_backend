const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

// Public search routes
router.get('/all', searchController.searchAll);
router.get('/suggestions', searchController.getSuggestions);
router.get('/:type', searchController.searchByType);

module.exports = router;