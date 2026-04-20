// controllers/interest_controller.js
const InterestRequest = require('../models/InterestRequest');
const User = require('../models/user_model');

// Send interest request
exports.sendInterest = async (req, res) => {
  try {
    const { employeeId, jobTitle, salaryAmount, salaryPeriod, message } = req.body;
    const employerId = req.user.id;

    // Validation
    if (!employeeId || !jobTitle || !salaryAmount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Calculate commission (20% of salary)
    const commissionAmount = salaryAmount * 0.2;

    // Create interest request
    const interestRequest = await InterestRequest.create({
      employerId,
      employeeId,
      jobTitle,
      salaryAmount,
      salaryPeriod,
      message,
      commissionAmount,
      status: 'pending'
    });

    // Populate user details for response
    await interestRequest.populate('employeeId', 'firstName lastName email employeeProfile.photoUrl');
    await interestRequest.populate('employerId', 'firstName lastName email employerProfile.companyName employerProfile.logoUrl');

    res.status(201).json({
      success: true,
      message: 'Interest request sent successfully',
      data: interestRequest
    });

  } catch (error) {
    console.error('Send interest error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Get employer's sent requests
exports.getEmployerRequests = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { status } = req.query;

    let query = { employerId };
    if (status && status !== 'all') {
      query.status = status;
    }

    const requests = await InterestRequest.find(query)
      .populate('employeeId', 'firstName lastName email employeeProfile.photoUrl employeeProfile.title')
      .sort({ createdAt: -1 });

    // Get counts for badge
    const counts = {
      pending: await InterestRequest.countDocuments({ employerId, status: 'pending' }),
      interested: await InterestRequest.countDocuments({ employerId, status: 'interested' }),
      total: await InterestRequest.countDocuments({ employerId })
    };

    res.json({
      success: true,
      data: requests,
      counts
    });

  } catch (error) {
    console.error('Get employer requests error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Get employee's received requests
exports.getEmployeeRequests = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { status } = req.query;

    let query = { employeeId };
    if (status && status !== 'all') {
      query.status = status;
    }

    const requests = await InterestRequest.find(query)
      .populate('employerId', 'firstName lastName email employerProfile.companyName employerProfile.logoUrl')
      .sort({ createdAt: -1 });

    // Get counts for badge
    const counts = {
      pending: await InterestRequest.countDocuments({ employeeId, status: 'pending' }),
      interested: await InterestRequest.countDocuments({ employeeId, status: 'interested' }),
      total: await InterestRequest.countDocuments({ employeeId })
    };

    res.json({
      success: true,
      data: requests,
      counts
    });

  } catch (error) {
    console.error('Get employee requests error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Employee responds to request
exports.respondToRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body; // 'interested' or 'declined'
    const employeeId = req.user.id;

    if (!['interested', 'declined'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const request = await InterestRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    if (request.employeeId.toString() !== employeeId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Request already processed'
      });
    }

    request.status = status;
    request.respondedAt = new Date();
    await request.save();

    res.json({
      success: true,
      message: `Request ${status}`,
      data: request
    });

  } catch (error) {
    console.error('Respond to request error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Get request count for badge
exports.getRequestCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    let count = 0;
    if (user.role === 'employer') {
      count = await InterestRequest.countDocuments({ 
        employerId: userId, 
        status: 'interested' 
      });
    } else {
      count = await InterestRequest.countDocuments({ 
        employeeId: userId, 
        status: 'pending' 
      });
    }

    res.json({
      success: true,
      count
    });

  } catch (error) {
    console.error('Get request count error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};