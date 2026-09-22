const Leave = require('../models/leave_model');
const User = require('../models/user_model');
const { sendNotification } = require('./notificationController');

// ==================== LEAVE BALANCE CONFIG ====================
const LEAVE_CONFIG = {
  'Annual Leave': 12,  // days per year
  'Sick Leave': 10,
  'Casual Leave': 6,
  'Unpaid Leave': 0
};

// ==================== GET LEAVE BALANCE ====================
exports.getLeaveBalance = async (req, res) => {
  try {
    const employeeId = req.user.id;

    console.log('\n🟡 ===== GET LEAVE BALANCE STARTED =====');
    console.log('📝 Employee ID:', employeeId);

    // Get current year
    const year = new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    // Get all leave requests for this year
    const leaves = await Leave.find({
      employeeId: employeeId,
      appliedOn: {
        $gte: startOfYear,
        $lte: endOfYear
      }
    });

    // Calculate used leaves by type
    const usedLeaves = {
      'Annual Leave': 0,
      'Sick Leave': 0,
      'Casual Leave': 0,
      'Unpaid Leave': 0
    };

    leaves.forEach(leave => {
      if (leave.status === 'approved') {
        usedLeaves[leave.type] += leave.days;
      }
    });

    // Calculate remaining leaves
    const balance = {
      annual: {
        total: LEAVE_CONFIG['Annual Leave'],
        used: usedLeaves['Annual Leave'],
        remaining: LEAVE_CONFIG['Annual Leave'] - usedLeaves['Annual Leave']
      },
      sick: {
        total: LEAVE_CONFIG['Sick Leave'],
        used: usedLeaves['Sick Leave'],
        remaining: LEAVE_CONFIG['Sick Leave'] - usedLeaves['Sick Leave']
      },
      casual: {
        total: LEAVE_CONFIG['Casual Leave'],
        used: usedLeaves['Casual Leave'],
        remaining: LEAVE_CONFIG['Casual Leave'] - usedLeaves['Casual Leave']
      },
      unpaid: {
        total: 0,
        used: usedLeaves['Unpaid Leave'],
        remaining: 0
      }
    };

    console.log('✅ Leave balance calculated');
    console.log('📊 Annual:', balance.annual);

    res.json({
      success: true,
      balance
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== APPLY FOR LEAVE ====================
exports.applyLeave = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { type, fromDate, toDate, reason } = req.body;

    console.log('\n🟡 ===== APPLY LEAVE STARTED =====');
    console.log('📝 Type:', type, 'From:', fromDate, 'To:', toDate);

    // Validation
    if (!type || !fromDate || !toDate || !reason) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Find employee and active employer
    const employee = await User.findById(employeeId)
      .populate('myEmployers.employerId');

    const activeEmployer = employee.myEmployers?.find(e => e.status === 'active');
    
    if (!activeEmployer) {
      return res.status(400).json({
        success: false,
        message: 'No active employer found'
      });
    }

    // Get employer details for notification
    const employer = await User.findById(activeEmployer.employerId);
    const employerName = employer?.employerProfile?.companyName || employer?.firstName || 'Your employer';

    // Parse dates
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    
    // Calculate days
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    // Check leave balance (for paid leaves)
    if (type !== 'Unpaid Leave') {
      const year = new Date().getFullYear();
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31, 23, 59, 59);

      const approvedLeaves = await Leave.find({
        employeeId: employeeId,
        type: type,
        status: 'approved',
        appliedOn: {
          $gte: startOfYear,
          $lte: endOfYear
        }
      });

      const usedDays = approvedLeaves.reduce((sum, leave) => sum + leave.days, 0);
      const totalAllowed = LEAVE_CONFIG[type] || 0;
      
      if (usedDays + days > totalAllowed) {
        return res.status(400).json({
          success: false,
          message: `Insufficient ${type} balance. Available: ${totalAllowed - usedDays} days`
        });
      }
    }

    // Create leave request
    const leave = await Leave.create({
      employeeId: employeeId,
      employerId: activeEmployer.employerId,
      type,
      fromDate: startDate,
      toDate: endDate,
      days,
      reason,
      status: 'pending',
      appliedOn: new Date()
    });

    console.log('✅ Leave request created:', leave._id);

    // 🔔 NOTIFICATION TO EMPLOYER - New leave request
    await sendNotification(
      activeEmployer.employerId,
      "📋 New Leave Request",
      `${employee.firstName} ${employee.lastName} applied for ${type} (${days} days) from ${fromDate} to ${toDate}`,
      {
        type: "leave_request_pending",
        leaveId: leave._id.toString(),
        employeeId: employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        leaveType: type,
        days: days,
        fromDate: fromDate,
        toDate: toDate,
        reason: reason,
        status: "pending"
      }
    );

    // 🔔 NOTIFICATION TO EMPLOYEE - Leave request submitted
    await sendNotification(
      employeeId,
      "📝 Leave Request Submitted",
      `Your ${type} leave request for ${days} days has been submitted. Waiting for ${employerName}'s approval.`,
      {
        type: "leave_submitted",
        leaveId: leave._id.toString(),
        leaveType: type,
        days: days,
        fromDate: fromDate,
        toDate: toDate,
        status: "pending"
      }
    );

    res.json({
      success: true,
      message: 'Leave request submitted successfully',
      leave
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== GET MY LEAVE REQUESTS ====================
exports.getMyLeaves = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { status } = req.query;

    console.log('\n🟡 ===== GET MY LEAVES STARTED =====');

    let query = { employeeId: employeeId };
    
    if (status) {
      query.status = status;
    }

    const leaves = await Leave.find(query)
      .populate('approvedBy', 'firstName lastName')
      .sort({ appliedOn: -1 });

    console.log(`📊 Found ${leaves.length} leave requests`);

    res.json({
      success: true,
      leaves
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== GET LEAVE DETAILS ====================
exports.getLeaveDetails = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { leaveId } = req.params;

    const leave = await Leave.findOne({
      _id: leaveId,
      employeeId: employeeId
    }).populate('approvedBy', 'firstName lastName employerProfile');

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    res.json({
      success: true,
      leave
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== CANCEL LEAVE REQUEST ====================
exports.cancelLeaveRequest = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { leaveId } = req.params;

    const leave = await Leave.findOne({
      _id: leaveId,
      employeeId: employeeId
    }).populate('employerId', 'firstName lastName employerProfile');

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending requests can be cancelled'
      });
    }

    leave.status = 'cancelled';
    await leave.save();

    // 🔔 NOTIFICATION TO EMPLOYER - Leave request cancelled
    await sendNotification(
      leave.employerId,
      "❌ Leave Request Cancelled",
      `Leave request for ${leave.type} (${leave.days} days) has been cancelled by the employee`,
      {
        type: "leave_cancelled",
        leaveId: leave._id.toString(),
        leaveType: leave.type,
        days: leave.days,
        fromDate: leave.fromDate,
        toDate: leave.toDate,
        status: "cancelled"
      }
    );

    // 🔔 NOTIFICATION TO EMPLOYEE - Leave request cancelled
    const employee = await User.findById(employeeId);
    await sendNotification(
      employeeId,
      "✓ Leave Request Cancelled",
      `Your ${leave.type} leave request for ${leave.days} days has been cancelled.`,
      {
        type: "leave_cancelled_employee",
        leaveId: leave._id.toString(),
        leaveType: leave.type,
        days: leave.days
      }
    );

    res.json({
      success: true,
      message: 'Leave request cancelled successfully'
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== GET LEAVE STATS ====================
exports.getLeaveStats = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const year = new Date().getFullYear();

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    const leaves = await Leave.find({
      employeeId: employeeId,
      appliedOn: {
        $gte: startOfYear,
        $lte: endOfYear
      }
    });

    const stats = {
      total: leaves.length,
      pending: leaves.filter(l => l.status === 'pending').length,
      approved: leaves.filter(l => l.status === 'approved').length,
      rejected: leaves.filter(l => l.status === 'rejected').length,
      cancelled: leaves.filter(l => l.status === 'cancelled').length,
      totalDays: leaves
        .filter(l => l.status === 'approved')
        .reduce((sum, l) => sum + l.days, 0)
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== EMPLOYER: GET ALL LEAVE REQUESTS ====================
exports.getEmployerLeaveRequests = async (req, res) => {
  try {
    const employerId = req.user.id;

    const leaves = await Leave.find({ employerId: employerId })
      .populate('employeeId', 'firstName lastName email employeeProfile')
      .sort({ appliedOn: -1 });

    res.json({
      success: true,
      leaves
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== EMPLOYER: APPROVE/REJECT LEAVE ====================
exports.updateLeaveStatus = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { leaveId } = req.params;
    const { status, remarks } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be approved or rejected'
      });
    }

    const leave = await Leave.findOne({
      _id: leaveId,
      employerId: employerId,
      status: 'pending'
    }).populate('employeeId', 'firstName lastName email');

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found or already processed'
      });
    }

    leave.status = status;
    leave.remarks = remarks || '';
    leave.approvedBy = employerId;
    leave.approvedAt = new Date();
    await leave.save();

    const statusText = status === 'approved' ? 'Approved' : 'Rejected';
    const statusEmoji = status === 'approved' ? '✅' : '❌';

    // 🔔 NOTIFICATION TO EMPLOYEE - Leave status update
    await sendNotification(
      leave.employeeId._id,
      `${statusEmoji} Leave Request ${statusText}`,
      `Your ${leave.type} leave request for ${leave.days} days has been ${statusText}. ${remarks ? `Remarks: ${remarks}` : ''}`,
      {
        type: `leave_${status}`,
        leaveId: leave._id.toString(),
        leaveType: leave.type,
        days: leave.days,
        fromDate: leave.fromDate,
        toDate: leave.toDate,
        status: status,
        remarks: remarks,
        approvedAt: leave.approvedAt
      }
    );

    res.json({
      success: true,
      message: `Leave request ${statusText} successfully`,
      leave
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};