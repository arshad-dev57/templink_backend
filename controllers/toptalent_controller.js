// controllers/talent_controller.js

const User = require('../models/user_model');
// In your talent controller file
exports.getAllTalents = async (req, res) => {
  try {
    // ✅ Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const skip = (page - 1) * limit;

    // ✅ Get total count for pagination
    const totalTalents = await User.countDocuments({
      role: 'employee',
      status: 'active'
    });

    // ✅ Get talents with pagination
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
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

    // ✅ Calculate pagination metadata
    const totalPages = Math.ceil(totalTalents / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return res.status(200).json({
      success: true,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalTalents,
        itemsPerPage: limit,
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage
      },
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