// controllers/ratingController.js
const Rating = require('../models/Rating');
const User = require('../models/user_model');

// ==================== SUBMIT RATING ====================
exports.submitRating = async (req, res) => {
  try {
    const { projectId, employeeId, rating, review } = req.body;
    const employerId = req.user.id;

    // Check if already rated
    const existingRating = await Rating.findOne({
      projectId,
      employerId
    });

    if (existingRating) {
      return res.status(400).json({
        success: false,
        message: 'You have already rated this project'
      });
    }

    // Create rating
    const newRating = await Rating.create({
      projectId,
      employerId,
      employeeId,
      rating,
      review
    });

    // Update employee's average rating
    const employee = await User.findById(employeeId);
    const allRatings = await Rating.find({ employeeId });
    
    const avgRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;
    
    // Update employee profile with new rating
    if (employee.role === 'employee') {
      employee.employeeProfile.rating = avgRating;
      employee.employeeProfile.totalReviews = allRatings.length;
      await employee.save();
    }

    return res.status(201).json({
      success: true,
      message: 'Rating submitted successfully',
      rating: newRating
    });

  } catch (error) {
    console.error('Submit rating error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== GET PROJECT RATING ====================
exports.getProjectRating = async (req, res) => {
  try {
    const { projectId } = req.params;
    const employerId = req.user.id;

    const rating = await Rating.findOne({
      projectId,
      employerId
    });

    return res.status(200).json({
      success: true,
      rated: !!rating,
      rating
    });

  } catch (error) {
    console.error('Get rating error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};