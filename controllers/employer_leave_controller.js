const Leave = require('../models/leave_model');
const User = require('../models/user_model');

exports.getAllLeaveRequests = async (req, res) => {
  try {
    const employerId = req.user.id;

    console.log('\n===== GET ALL LEAVE REQUESTS STARTED ');
    console.log('📝 Employer ID:', employerId);

    const leaves = await Leave.find({
      employerId: employerId
    })
    .populate('employeeId', 'firstName lastName employeeProfile')
    .populate('approvedBy', 'firstName lastName')
    .sort({ appliedOn: -1 });

    console.log(`📊 Found ${leaves.length} leave requests`);

    // Format the response
    const formattedLeaves = leaves.map(leave => ({
      id: leave._id,
      employeeId: leave.employeeId._id,
      employeeName: `${leave.employeeId.firstName} ${leave.employeeId.lastName}`,
      employeeInitials: (leave.employeeId.firstName?.[0] || '') + (leave.employeeId.lastName?.[0] || ''),
      employeePhoto: leave.employeeId.employeeProfile?.photoUrl,
      type: leave.type,
      fromDate: leave.fromDate,
      toDate: leave.toDate,
      days: leave.days,
      reason: leave.reason,
      status: leave.status,
      appliedOn: leave.appliedOn,
      approvedBy: leave.approvedBy ? {
        name: `${leave.approvedBy.firstName} ${leave.approvedBy.lastName}`,
        id: leave.approvedBy._id
      } : null,
      approvedOn: leave.approvedOn,
      rejectionReason: leave.rejectionReason
    }));

     const pending = formattedLeaves.filter(l => l.status === 'pending');
    const approved = formattedLeaves.filter(l => l.status === 'approved');
    const rejected = formattedLeaves.filter(l => l.status === 'rejected');

    res.json({
      success: true,
      data: {
        all: formattedLeaves,
        pending,
        approved,
        rejected,
        counts: {
          total: formattedLeaves.length,
          pending: pending.length,
          approved: approved.length,
          rejected: rejected.length
        }
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== GET PENDING LEAVE REQUESTS ====================
exports.getPendingLeaves = async (req, res) => {
  try {
    const employerId = req.user.id;

    const leaves = await Leave.find({
      employerId: employerId,
      status: 'pending'
    })
    .populate('employeeId', 'firstName lastName employeeProfile')
    .sort({ appliedOn: -1 });

    const formattedLeaves = leaves.map(leave => ({
      id: leave._id,
      employeeId: leave.employeeId._id,
      employeeName: `${leave.employeeId.firstName} ${leave.employeeId.lastName}`,
      employeeInitials: (leave.employeeId.firstName?.[0] || '') + (leave.employeeId.lastName?.[0] || ''),
      employeePhoto: leave.employeeId.employeeProfile?.photoUrl,
      type: leave.type,
      fromDate: leave.fromDate,
      toDate: leave.toDate,
      days: leave.days,
      reason: leave.reason,
      status: leave.status,
      appliedOn: leave.appliedOn
    }));

    res.json({
      success: true,
      leaves: formattedLeaves
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== APPROVE LEAVE ====================
exports.approveLeave = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { leaveId } = req.params;

    console.log('\n🟡 ===== APPROVE LEAVE STARTED =====');
    console.log('📝 Leave ID:', leaveId);

    const leave = await Leave.findById(leaveId);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This request is already ${leave.status}`
      });
    }

    leave.status = 'approved';
    leave.approvedBy = employerId;
    leave.approvedOn = new Date();
    await leave.save();

    console.log('✅ Leave approved successfully');

    res.json({
      success: true,
      message: 'Leave request approved successfully',
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

// ==================== REJECT LEAVE ====================
exports.rejectLeave = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { leaveId } = req.params;
    const { reason } = req.body;

    console.log('\n🟡 ===== REJECT LEAVE STARTED =====');
    console.log('📝 Leave ID:', leaveId);
    console.log('📝 Reason:', reason);

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const leave = await Leave.findById(leaveId);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This request is already ${leave.status}`
      });
    }

    leave.status = 'rejected';
    leave.rejectionReason = reason;
    leave.approvedBy = employerId;
    leave.approvedOn = new Date();
    await leave.save();

    console.log('✅ Leave rejected successfully');

    res.json({
      success: true,
      message: 'Leave request rejected successfully',
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

// ==================== GET LEAVE STATISTICS ====================
exports.getLeaveStatistics = async (req, res) => {
  try {
    const employerId = req.user.id;

    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

    const leaves = await Leave.find({
      employerId: employerId,
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
      totalDays: leaves
        .filter(l => l.status === 'approved')
        .reduce((sum, l) => sum + l.days, 0),
      byType: {
        'Annual Leave': leaves.filter(l => l.type === 'Annual Leave').length,
        'Sick Leave': leaves.filter(l => l.type === 'Sick Leave').length,
        'Casual Leave': leaves.filter(l => l.type === 'Casual Leave').length,
        'Unpaid Leave': leaves.filter(l => l.type === 'Unpaid Leave').length
      }
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

// ==================== GET LEAVE DETAILS ====================
exports.getLeaveDetails = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { leaveId } = req.params;

    const leave = await Leave.findOne({
      _id: leaveId,
      employerId: employerId
    })
    .populate('employeeId', 'firstName lastName employeeProfile email')
    .populate('approvedBy', 'firstName lastName');

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