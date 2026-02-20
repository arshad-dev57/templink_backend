// controllers/talent_controller.js

const User = require('../models/user_model');

exports.getAllTalents = async (req, res) => {
  try {
    // ✅ Sirf active employees
    const talents = await User.find({
      role: 'employee',
      status: 'active'
    })
    .select({
      firstName: 1,
      lastName: 1,
      email: 1,
      country: 1,
      employeeProfile: 1,
      createdAt: 1
    })
    .sort({ createdAt: -1 }) // Newest first
    .lean();

    // ✅ Simple response - direct array
    return res.status(200).json({
      success: true,
      count: talents.length,
      talents: talents
    });

  } catch (error) {
    console.error('[TALENT_ERROR]', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * ✅ GET SINGLE TALENT BY ID
 * GET /api/talent/:id
 */
exports.getTalentById = async (req, res) => {
  try {
    const { id } = req.params;

    const talent = await User.findOne({
      _id: id,
      role: 'employee',
      status: 'active'
    })
    .select({
      firstName: 1,
      lastName: 1,
      email: 1,
      country: 1,
      employeeProfile: 1,
      createdAt: 1,
      updatedAt: 1
    })
    .lean();

    if (!talent) {
      return res.status(404).json({
        success: false,
        message: "Talent not found"
      });
    }

    return res.status(200).json({
      success: true,
      talent: talent
    });

  } catch (error) {
    console.error('[TALENT_DETAIL_ERROR]', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};