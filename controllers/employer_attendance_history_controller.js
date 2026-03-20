// controllers/employer_attendance_history_controller.js
const User = require('../models/user_model');
const Attendance = require('../models/attendance_model');
const JobApplication = require('../models/JobApplication');

// ==================== GET ATTENDANCE HISTORY ====================
exports.getAttendanceHistory = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { view, month, year, startDate, endDate } = req.query;

    console.log('\n🟡 ===== GET ATTENDANCE HISTORY STARTED =====');
    console.log('📝 Employer ID:', employerId);
    console.log('📝 View:', view, 'Month:', month, 'Year:', year);

    // Get all active team members
    const employer = await User.findById(employerId)
      .populate({
        path: 'employerProfile.teamMembers.employeeId',
        select: 'firstName lastName email employeeProfile'
      });

    const teamMembers = employer.employerProfile?.teamMembers || [];
    const activeTeamMembers = teamMembers.filter(m => m.status === 'active');
    
    console.log(`👥 Active team members: ${activeTeamMembers.length}`);

    // Build date range based on view
    let start, end;
    const now = new Date();

    if (view === 'monthly' && month && year) {
      // Monthly view
      start = new Date(year, month - 1, 1);
      end = new Date(year, month, 0);
      end.setHours(23, 59, 59, 999);
    } else if (view === 'yearly' && year) {
      // Yearly view
      start = new Date(year, 0, 1);
      end = new Date(year, 11, 31);
      end.setHours(23, 59, 59, 999);
    } else if (view === 'custom' && startDate && endDate) {
      // Custom range
      start = new Date(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      // Default to current month
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    }

    console.log('📅 Date Range:', start, 'to', end);

    // Get all attendance records for this period
    const attendanceRecords = await Attendance.find({
      employerId: employerId,
      date: {
        $gte: start,
        $lte: end
      }
    }).populate('employeeId', 'firstName lastName employeeProfile');

    console.log(`📊 Found ${attendanceRecords.length} attendance records`);

    // Get leave records for this period
    const leaveRecords = await JobApplication.find({
      employerId: employerId,
      status: 'hired',
      employmentStatus: 'active',
      'leaveRequest.date': {
        $gte: start,
        $lte: end
      }
    }).populate('employeeId', 'firstName lastName');

    console.log(`📝 Found ${leaveRecords.length} leave records`);

    // Build employee-wise attendance summary
    const employeesData = await Promise.all(activeTeamMembers.map(async (member) => {
      const employeeId = member.employeeId?._id.toString();
      
      // Get employee's attendance records for this period
      const employeeAttendance = attendanceRecords.filter(
        r => r.employeeId?._id?.toString() === employeeId
      );

      // Get employee's leave records for this period
      const employeeLeaves = leaveRecords.filter(
        l => l.employeeId?._id?.toString() === employeeId
      );

      // Calculate stats
      let present = 0;
      let late = 0;
      let absent = 0;
      let leave = 0;
      let halfDay = 0;
      let totalHours = 0;
      let overtime = 0;

      // Calculate working days in period
      const workingDays = _getWorkingDays(start, end);
      
      // Count attendance
      employeeAttendance.forEach(record => {
        if (record.status === 'present') present++;
        else if (record.status === 'late') late++;
        else if (record.status === 'half_day') halfDay++;
        
        if (record.totalHours) {
          totalHours += record.totalHours;
          if (record.totalHours > 8) overtime += (record.totalHours - 8);
        }
      });

      // Count leaves
      leave = employeeLeaves.length;

      // Absent = working days - (present + late + halfDay + leave)
      absent = workingDays - (present + late + halfDay + leave);

      return {
        employeeId: employeeId,
        name: `${member.employeeId?.firstName || ''} ${member.employeeId?.lastName || ''}`.trim(),
        initials: (member.employeeId?.firstName?.[0] || '') + (member.employeeId?.lastName?.[0] || ''),
        designation: member.employeeId?.employeeProfile?.title || member.jobTitle || 'Employee',
        department: member.employeeId?.employeeProfile?.category || 'General',
        photo: member.employeeId?.employeeProfile?.photoUrl,
        stats: {
          present,
          absent: absent < 0 ? 0 : absent,
          late,
          leave,
          halfDay,
          workingHours: '${totalHours.toFixed(0)}h',
          overtime: '${overtime.toFixed(0)}h'
        },
        dailyRecords: employeeAttendance.map(r => ({
          date: r.date,
          checkIn: r.checkIn,
          checkOut: r.checkOut,
          status: r.status,
          totalHours: r.totalHours,
          isLate: r.isLate
        }))
      };
    }));

    // Calculate monthly trend data
    const trendData = _calculateTrendData(attendanceRecords, start, end);

    res.json({
      success: true,
      data: {
        employees: employeesData,
        trend: trendData,
        summary: {
          totalEmployees: employeesData.length,
          totalDays: _getWorkingDays(start, end),
          dateRange: {
            start,
            end
          }
        }
      }
    });

  } catch (error) {
    console.error('❌ Get attendance history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Helper: Get working days count (excluding weekends)
function _getWorkingDays(start, end) {
  let count = 0;
  let current = new Date(start);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

// Helper: Calculate trend data
function _calculateTrendData(records, start, end) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const trend = [];
  let current = new Date(start);
  
  while (current <= end) {
    const monthKey = `${current.getFullYear()}-${current.getMonth() + 1}`;
    const monthName = months[current.getMonth()];
    
    // Get records for this month
    const monthRecords = records.filter(r => {
      const recordDate = new Date(r.date);
      return recordDate.getMonth() === current.getMonth() &&
             recordDate.getFullYear() === current.getFullYear();
    });

    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;

    monthRecords.forEach(r => {
      if (r.status === 'present') present++;
      else if (r.status === 'late') late++;
      else if (r.status === 'leave') leave++;
    });

    // For absent, we need to calculate based on working days
    const workingDays = _getWorkingDays(
      new Date(current.getFullYear(), current.getMonth(), 1),
      new Date(current.getFullYear(), current.getMonth() + 1, 0)
    );
    
    absent = workingDays - (present + late);

    trend.push({
      month: monthName,
      present,
      absent: absent < 0 ? 0 : absent,
      late,
      leave
    });

    // Move to next month
    current.setMonth(current.getMonth() + 1);
  }

  return trend;
}

// ==================== GET EMPLOYEE ATTENDANCE DETAILS ====================
exports.getEmployeeAttendanceDetails = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { employeeId } = req.params;
    const { month, year } = req.query;

    // Verify employee is in employer's team
    const employer = await User.findById(employerId);
    const isTeamMember = employer.employerProfile?.teamMembers?.some(
      m => m.employeeId?.toString() === employeeId && m.status === 'active'
    );

    if (!isTeamMember) {
      return res.status(403).json({
        success: false,
        message: 'Employee not found in your team'
      });
    }

    // Build date range
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    end.setHours(23, 59, 59, 999);

    // Get attendance records
    const records = await Attendance.find({
      employeeId: employeeId,
      employerId: employerId,
      date: {
        $gte: start,
        $lte: end
      }
    }).sort({ date: -1 });

    // Get employee details
    const employee = await User.findById(employeeId)
      .select('firstName lastName employeeProfile');

    res.json({
      success: true,
      data: {
        employee: {
          id: employee._id,
          name: `${employee.firstName} ${employee.lastName}`,
          initials: (employee.firstName?.[0] || '') + (employee.lastName?.[0] || ''),
          designation: employee.employeeProfile?.title || 'Employee',
          department: employee.employeeProfile?.category || 'General',
          photo: employee.employeeProfile?.photoUrl
        },
        records: records.map(r => ({
          date: r.date,
          checkIn: r.checkIn,
          checkOut: r.checkOut,
          status: r.status,
          totalHours: r.totalHours,
          isLate: r.isLate,
          lateMinutes: r.lateMinutes
        }))
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


// controllers/employer_attendance_history_controller.js mein ye function add karo

// ==================== GET TODAY'S ATTENDANCE STATS ====================
exports.getTodayAttendanceStats = async (req, res) => {
  try {
    const employerId = req.user.id;

    console.log('\n🟡 ===== GET TODAY\'S ATTENDANCE STATS STARTED =====');
    console.log('📝 Employer ID:', employerId);

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all active team members
    const employer = await User.findById(employerId)
      .populate({
        path: 'employerProfile.teamMembers.employeeId',
        select: 'firstName lastName email employeeProfile'
      });

    const teamMembers = employer.employerProfile?.teamMembers || [];
    const activeTeamMembers = teamMembers.filter(m => m.status === 'active');
    const activeEmployeeIds = activeTeamMembers.map(m => m.employeeId?._id.toString());

    console.log(`👥 Active team members: ${activeEmployeeIds.length}`);

    // Get today's attendance records
    const todayAttendance = await Attendance.find({
      employerId: employerId,
      date: {
        $gte: today,
        $lt: tomorrow
      }
    });

    // Get today's leave requests
    const leaveRequests = await JobApplication.find({
      employerId: employerId,
      status: 'hired',
      employmentStatus: 'active',
      'leaveRequest.date': {
        $gte: today,
        $lt: tomorrow
      }
    }).populate('employeeId', 'firstName lastName');

    // Calculate stats
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    
    const attendanceMap = new Map();
    todayAttendance.forEach(record => {
      attendanceMap.set(record.employeeId.toString(), record);
    });

    const leaveMap = new Map();
    leaveRequests.forEach(request => {
      leaveMap.set(request.employeeId._id.toString(), request);
    });

    activeEmployeeIds.forEach(empId => {
      if (leaveMap.has(empId)) {
        leaveCount++;
      } else if (attendanceMap.has(empId)) {
        const record = attendanceMap.get(empId);
        if (record.status === 'late') {
          lateCount++;
        } else {
          presentCount++;
        }
      } else {
        absentCount++;
      }
    });

    // Get detailed attendance list
    const attendanceList = await Promise.all(activeTeamMembers.map(async (member) => {
      const employeeId = member.employeeId?._id.toString();
      const attendance = attendanceMap.get(employeeId);
      const leave = leaveMap.get(employeeId);
      
      let status = 'absent';
      let checkIn = null;
      let checkOut = null;
      let totalHours = null;
      let isLate = false;
      
      if (leave) {
        status = 'leave';
      } else if (attendance) {
        status = attendance.status;
        checkIn = attendance.checkIn;
        checkOut = attendance.checkOut;
        totalHours = attendance.totalHours;
        isLate = attendance.isLate;
      }
      
      return {
        employeeId: member.employeeId?._id,
        name: `${member.employeeId?.firstName || ''} ${member.employeeId?.lastName || ''}`.trim(),
        initials: (member.employeeId?.firstName?.[0] || '') + (member.employeeId?.lastName?.[0] || ''),
        title: member.employeeId?.employeeProfile?.title || member.jobTitle || 'Employee',
        photoUrl: member.employeeId?.employeeProfile?.photoUrl,
        status: status,
        checkIn: checkIn,
        checkOut: checkOut,
        totalHours: totalHours,
        isLate: isLate,
        leaveDetails: leave ? {
          type: leave.leaveRequest?.type,
          reason: leave.leaveRequest?.reason
        } : null
      };
    }));

    const totalTeam = activeEmployeeIds.length;
    const attendanceRate = totalTeam > 0 ? (presentCount + lateCount) / totalTeam : 0;

    res.json({
      success: true,
      data: {
        today: {
          totalTeam,
          presentCount,
          lateCount,
          absentCount,
          leaveCount,
          attendanceRate,
          presentPercentage: totalTeam > 0 ? Math.round((presentCount + lateCount) / totalTeam * 100) : 0,
          attendanceList
        }
      }
    });

  } catch (error) {
    console.error('❌ Get today\'s attendance stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};