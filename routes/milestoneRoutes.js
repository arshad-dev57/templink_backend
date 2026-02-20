const express = require('express');
const router = express.Router();
const milestoneController = require('../controllers/milestoneController');

// Route to update milestone status
router.put('/update-status', milestoneController.updateMilestoneStatus);

// Route to process milestone payment (Simulate for now)
router.post('/process-payment', milestoneController.processMilestonePayment);

module.exports = router;