const Timesheet = require('../models/timesheet_model');
const User = require('../models/user_model');

// ==================== GET ALL TIMESHEETS ====================
exports.getAllTimesheets = async (req, res) => {
  try {
    const employerId = req.user.id;

    console.log('\n🟡 ===== GET ALL TIMESHEETS STARTED =====');
    console.log('📝 Employer ID:', employerId);

    // Get all timesheets for this employer
    const timesheets = await Timesheet.find({
      employerId: employerId
    })
    .populate('employeeId', 'firstName lastName employeeProfile')
    .populate('approvedBy', 'firstName lastName')
    .sort({ createdAt: -1 });

    console.log(`📊 Found ${timesheets.length} timesheets`);

    // Group by status and calculate stats
    const pending = [];
    const approved = [];
    const rejected = [];
    let totalHoursPending = 0;

    timesheets.forEach(ts => {
      const employee = ts.employeeId;
      const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown';
      const employeeInitials = employee ? 
        (employee.firstName?.[0] || '') + (employee.lastName?.[0] || '') : '--';

      // Calculate week range
      const date = new Date(ts.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay() + 1); // Monday
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // Sunday

      const formatted = {
        id: ts._id,
        employeeId: ts.employeeId?._id,
        employeeName: employeeName,
        employeeInitials: employeeInitials,
        employeePhoto: employee?.employeeProfile?.photoUrl,
        project: ts.project,
        task: ts.task,
        date: ts.date,
        hours: ts.hours,
        weekStart: weekStart,
        weekEnd: weekEnd,
        status: ts.status,
        submittedAt: ts.createdAt,
        approvedBy: ts.approvedBy ? {
          name: `${ts.approvedBy.firstName} ${ts.approvedBy.lastName}`,
          id: ts.approvedBy._id
        } : null,
        approvedOn: ts.approvedOn,
        rejectionReason: ts.rejectionReason
      };

      if (ts.status === 'pending') {
        pending.push(formatted);
        totalHoursPending += ts.hours;
      } else if (ts.status === 'approved') {
        approved.push(formatted);
      } else if (ts.status === 'rejected') {
        rejected.push(formatted);
      }
    });

    // Group by week for pending timesheets
    const pendingByWeek = {};
    pending.forEach(ts => {
      const weekKey = ts.weekStart.toISOString().split('T')[0];
      if (!pendingByWeek[weekKey]) {
        pendingByWeek[weekKey] = {
          weekStart: ts.weekStart,
          weekEnd: ts.weekEnd,
          entries: [],
          totalHours: 0
        };
      }
      pendingByWeek[weekKey].entries.push(ts);
      pendingByWeek[weekKey].totalHours += ts.hours;
    });

    // Convert to array and sort by week
    const pendingGrouped = Object.values(pendingByWeek).sort((a, b) => 
      b.weekStart - a.weekStart
    );

    res.json({
      success: true,
      data: {
        all: timesheets,
        pending: pending,
        approved: approved,
        rejected: rejected,
        pendingByWeek: pendingGrouped,
        counts: {
          total: timesheets.length,
          pending: pending.length,
          approved: approved.length,
          rejected: rejected.length,
          totalHoursPending: totalHoursPending
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

// ==================== GET PENDING TIMESHEETS ====================
exports.getPendingTimesheets = async (req, res) => {
  try {
    const employerId = req.user.id;

    const timesheets = await Timesheet.find({
      employerId: employerId,
      status: 'pending'
    })
    .populate('employeeId', 'firstName lastName employeeProfile')
    .sort({ date: -1 });

    const formatted = timesheets.map(ts => ({
      id: ts._id,
      employeeId: ts.employeeId?._id,
      employeeName: ts.employeeId ? 
        `${ts.employeeId.firstName} ${ts.employeeId.lastName}` : 'Unknown',
      employeeInitials: ts.employeeId ? 
        (ts.employeeId.firstName?.[0] || '') + (ts.employeeId.lastName?.[0] || '') : '--',
      project: ts.project,
      task: ts.task,
      date: ts.date,
      hours: ts.hours,
      status: ts.status,
      submittedAt: ts.createdAt
    }));

    res.json({
      success: true,
      timesheets: formatted
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== GET TIMESHEET DETAILS ====================
exports.getTimesheetDetails = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { timesheetId } = req.params;

    const timesheet = await Timesheet.findOne({
      _id: timesheetId,
      employerId: employerId
    })
    .populate('employeeId', 'firstName lastName employeeProfile email')
    .populate('approvedBy', 'firstName lastName');

    if (!timesheet) {
      return res.status(404).json({
        success: false,
        message: 'Timesheet not found'
      });
    }

    // Get all entries for the same week
    const date = new Date(timesheet.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const weekEntries = await Timesheet.find({
      employeeId: timesheet.employeeId._id,
      employerId: employerId,
      date: {
        $gte: weekStart,
        $lte: weekEnd
      }
    }).sort({ date: 1 });

    // Group by day
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dailyEntries = [];
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(weekStart);
      currentDate.setDate(weekStart.getDate() + i);
      
      const dayEntries = weekEntries.filter(e => {
        const entryDate = new Date(e.date);
        return entryDate.toDateString() === currentDate.toDateString();
      });

      if (dayEntries.length > 0) {
        dayEntries.forEach(entry => {
          dailyEntries.push({
            day: days[i].substring(0, 3),
            date: currentDate,
            project: entry.project,
            task: entry.task,
            hours: entry.hours,
            status: entry.status
          });
        });
      } else {
        dailyEntries.push({
          day: days[i].substring(0, 3),
          date: currentDate,
          project: '-',
          task: 'No entry',
          hours: 0,
          status: 'absent'
        });
      }
    }

    // Calculate totals
    const totalHours = weekEntries.reduce((sum, e) => sum + e.hours, 0);
    const regularHours = Math.min(40, totalHours);
    const overtimeHours = Math.max(0, totalHours - 40);

    res.json({
      success: true,
      timesheet: {
        id: timesheet._id,
        employee: {
          id: timesheet.employeeId._id,
          name: `${timesheet.employeeId.firstName} ${timesheet.employeeId.lastName}`,
          initials: (timesheet.employeeId.firstName?.[0] || '') + (timesheet.employeeId.lastName?.[0] || ''),
          email: timesheet.employeeId.email,
          photo: timesheet.employeeId.employeeProfile?.photoUrl
        },
        weekStart: weekStart,
        weekEnd: weekEnd,
        dailyEntries: dailyEntries,
        totalHours: totalHours,
        regularHours: regularHours,
        overtimeHours: overtimeHours,
        status: timesheet.status,
        submittedAt: timesheet.createdAt,
        approvedBy: timesheet.approvedBy,
        approvedOn: timesheet.approvedOn,
        rejectionReason: timesheet.rejectionReason
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

// ==================== APPROVE TIMESHEET ====================
exports.approveTimesheet = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { timesheetId } = req.params;

    console.log('\n🟡 ===== APPROVE TIMESHEET STARTED =====');
    console.log('📝 Timesheet ID:', timesheetId);

    const timesheet = await Timesheet.findById(timesheetId);

    if (!timesheet) {
      return res.status(404).json({
        success: false,
        message: 'Timesheet not found'
      });
    }

    if (timesheet.employerId.toString() !== employerId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (timesheet.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This timesheet is already ${timesheet.status}`
      });
    }

    timesheet.status = 'approved';
    timesheet.approvedBy = employerId;
    timesheet.approvedOn = new Date();
    await timesheet.save();

    console.log('✅ Timesheet approved successfully');

    res.json({
      success: true,
      message: 'Timesheet approved successfully',
      timesheet
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== REJECT TIMESHEET ====================
exports.rejectTimesheet = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { timesheetId } = req.params;
    const { reason } = req.body;

    console.log('\n🟡 ===== REJECT TIMESHEET STARTED =====');
    console.log('📝 Timesheet ID:', timesheetId);
    console.log('📝 Reason:', reason);

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const timesheet = await Timesheet.findById(timesheetId);

    if (!timesheet) {
      return res.status(404).json({
        success: false,
        message: 'Timesheet not found'
      });
    }

    if (timesheet.employerId.toString() !== employerId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (timesheet.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This timesheet is already ${timesheet.status}`
      });
    }

    timesheet.status = 'rejected';
    timesheet.rejectionReason = reason;
    timesheet.approvedBy = employerId;
    timesheet.approvedOn = new Date();
    await timesheet.save();

    console.log('✅ Timesheet rejected successfully');

    res.json({
      success: true,
      message: 'Timesheet rejected successfully',
      timesheet
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== GET TIMESHEET STATS ====================
exports.getTimesheetStats = async (req, res) => {
  try {
    const employerId = req.user.id;

    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

    const timesheets = await Timesheet.find({
      employerId: employerId,
      createdAt: {
        $gte: startOfYear,
        $lte: endOfYear
      }
    });

    const stats = {
      total: timesheets.length,
      pending: timesheets.filter(t => t.status === 'pending').length,
      approved: timesheets.filter(t => t.status === 'approved').length,
      rejected: timesheets.filter(t => t.status === 'rejected').length,
      totalHours: timesheets
        .filter(t => t.status === 'approved')
        .reduce((sum, t) => sum + t.hours, 0),
      pendingHours: timesheets
        .filter(t => t.status === 'pending')
        .reduce((sum, t) => sum + t.hours, 0)
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

// ==================== GET EMPLOYEE TIMESHEETS ====================
exports.getEmployeeTimesheets = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { employeeId } = req.params;

    const timesheets = await Timesheet.find({
      employerId: employerId,
      employeeId: employeeId
    })
    .sort({ date: -1 });

    res.json({
      success: true,
      timesheets
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};