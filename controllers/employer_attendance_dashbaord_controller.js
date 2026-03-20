// controllers/employer_dashboard_controller.js
const User = require('../models/user_model');
const JobPost = require('../models/jobpost');
const JobApplication = require('../models/JobApplication');


const Attendance = require('../models/attendance_model');

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

    // 1. Get all active team members (hired employees)
    const employer = await User.findById(employerId)
      .populate({
        path: 'employerProfile.teamMembers.employeeId',
        select: 'firstName lastName email employeeProfile'
      });

    const teamMembers = employer.employerProfile?.teamMembers || [];
    
    // Filter active team members
    const activeTeamMembers = teamMembers.filter(m => m.status === 'active');
    const activeEmployeeIds = activeTeamMembers.map(m => m.employeeId?._id.toString());

    console.log(`👥 Active team members: ${activeEmployeeIds.length}`);

    // 2. Get today's attendance records
    const todayAttendance = await Attendance.find({
      employerId: employerId,
      date: {
        $gte: today,
        $lt: tomorrow
      }
    });

    console.log(`📊 Today's attendance records: ${todayAttendance.length}`);

    // 3. Get today's leave requests (from JobApplication)
    const leaveRequests = await JobApplication.find({
      employerId: employerId,
      status: 'hired',
      employmentStatus: 'active',
      'leaveRequest.date': {
        $gte: today,
        $lt: tomorrow
      }
    }).populate('employeeId', 'firstName lastName');

    console.log(`📝 Today's leave requests: ${leaveRequests.length}`);

    // 4. Calculate stats
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    
    // Create a map of employee attendance
    const attendanceMap = new Map();
    todayAttendance.forEach(record => {
      attendanceMap.set(record.employeeId.toString(), record);
    });

    // Create a map of employee leaves
    const leaveMap = new Map();
    leaveRequests.forEach(request => {
      leaveMap.set(request.employeeId._id.toString(), request);
    });

    // Calculate counts based on active team members
    activeEmployeeIds.forEach(empId => {
      if (leaveMap.has(empId)) {
        // Employee is on leave
        leaveCount++;
      } else if (attendanceMap.has(empId)) {
        const record = attendanceMap.get(empId);
        if (record.status === 'late') {
          lateCount++;
        } else {
          presentCount++;
        }
      } else {
        // No attendance record = absent
        absentCount++;
      }
    });

    // 5. Get detailed attendance list for UI
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

    console.log('✅ Stats calculated:');
    console.log(`   Present: ${presentCount}`);
    console.log(`   Late: ${lateCount}`);
    console.log(`   Absent: ${absentCount}`);
    console.log(`   Leave: ${leaveCount}`);

    res.json({
      success: true,
      data: {
        summary: {
          totalTeam,
          presentCount,
          lateCount,
          absentCount,
          leaveCount,
          attendanceRate,
          presentPercentage: totalTeam > 0 ? ((presentCount + lateCount) / totalTeam * 100).toFixed(0) : 0
        },
        attendanceList,
        officeHours: employer.employerProfile?.officeHours || {
          checkIn: '09:00',
          checkOut: '18:00',
          gracePeriod: 10
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

// ==================== GET EMPLOYEE ATTENDANCE HISTORY ====================
exports.getEmployeeAttendanceHistory = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { employeeId, month, year } = req.query;

    let startDate, endDate;

    if (month && year) {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0);
    } else {
      // Default to current month
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    endDate.setHours(23, 59, 59, 999);

    const query = {
      employerId: employerId,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    };

    if (employeeId) {
      query.employeeId = employeeId;
    }

    const attendance = await Attendance.find(query)
      .populate('employeeId', 'firstName lastName employeeProfile')
      .sort({ date: -1 });

    res.json({
      success: true,
      data: attendance
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== GET DASHBOARD STATS ====================
exports. getDashboardStats = async (req, res) => {
  try {
    const employerId = req.user.id;

    // Verify employer
    const employer = await User.findById(employerId);
    if (!employer || employer.role !== 'employer') {
      return res.status(403).json({
        success: false,
        message: 'Only employers can access'
      });
    }

    // 1. Get team members from employerProfile.teamMembers
    const teamMembers = employer.employerProfile?.teamMembers || [];
    
    // ✅ FILTER: Sirf active team members count karo (left wale exclude)
    const activeTeamMembers = teamMembers.filter(m => m.status === 'active');
    const totalActiveTeam = activeTeamMembers.length;
    
    // Left team members count (for reference)
    const leftTeamMembers = teamMembers.filter(m => m.status === 'left' || m.status === 'terminated');
    const leftTeamCount = leftTeamMembers.length;

    // 2. Get jobs stats
    const jobs = await JobPost.find({ postedBy: employerId });
    const totalJobs = jobs.length;
    
    // Count active jobs
    const activeJobs = jobs.filter(job => 
      job.status === 'active' || job.status === 'open' || !job.status
    ).length;
    
    // Count paused/closed jobs
    const pausedJobs = jobs.filter(job => 
      job.status === 'paused' || job.status === 'closed'
    ).length;

    // 3. Get applications stats
    const applications = await JobApplication.find({ employerId: employerId });
    
    const totalApplications = applications.length;
    const pendingApplications = applications.filter(a => a.status === 'pending').length;
    const hiredCount = applications.filter(a => a.status === 'hired').length;
    const shortlistedCount = applications.filter(a => a.status === 'shortlisted').length;
    const rejectedCount = applications.filter(a => a.status === 'rejected').length;

    // 4. Get open jobs
    const openJobs = jobs.filter(job => 
      job.status === 'active' || job.status === 'open' || !job.status
    ).length;

    // 5. Get hiring requests
    const hiringRequests = applications.filter(a => 
      a.status === 'pending' || a.status === 'reviewed'
    ).length;

    // 6. Get office hours from employer profile (if exists)
    const officeHours = employer.employerProfile?.officeHours || {
      checkIn: '09:00',
      checkOut: '18:00',
      gracePeriod: 10
    };

    res.json({
      success: true,
      stats: {
        // Team stats - SIRF ACTIVE MEMBERS
        totalTeam: totalActiveTeam,
        activeTeam: totalActiveTeam,
        leftTeam: leftTeamCount,
        totalTeamAll: teamMembers.length, // Optional: total including left
        
        // Jobs stats
        totalJobs,
        activeJobs,
        pausedJobs,
        openJobs,
        
        // Applications stats
        totalApplications,
        pendingApplications,
        hiredCount,
        shortlistedCount,
        rejectedCount,
        hiringRequests,
        
        // Combined stats for dashboard
        myJobs: totalJobs,
        jobApplications: totalApplications,
        
        // Office Hours
        officeHours
      }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
// ==================== GET OFFICE HOURS ====================
exports.getOfficeHours = async (req, res) => {
  try {
    const employerId = req.user.id;

    console.log('\n🟡 ===== GET OFFICE HOURS =====');
    console.log('📝 Employer ID:', employerId);

    const employer = await User.findById(employerId);
    if (!employer || employer.role !== 'employer') {
      return res.status(403).json({
        success: false,
        message: 'Only employers can access'
      });
    }

    console.log('👤 Employer found:', employer.email);
    console.log('📊 Office hours from DB:', employer.employerProfile?.officeHours);

    const officeHours = employer.employerProfile?.officeHours || {
      checkIn: '09:00',
      checkOut: '18:00',
      gracePeriod: 10
    };

    res.json({
      success: true,
      officeHours
    });

  } catch (error) {
    console.error('❌ Get office hours error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};// ==================== UPDATE OFFICE HOURS ====================
exports.updateOfficeHours = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { checkIn, checkOut, gracePeriod } = req.body;

    console.log('\n🟡 ===== BACKEND UPDATE OFFICE HOURS =====');
    console.log('📝 Employer ID:', employerId);
    console.log('📝 Request:', { checkIn, checkOut, gracePeriod });

    // Validation
    if (!checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Check-in and check-out times are required'
      });
    }

    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(checkIn) || !timeRegex.test(checkOut)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid time format. Use HH:MM (24-hour format)'
      });
    }

    // Directly update using findOneAndUpdate (bypasses any middleware issues)
    const updatedEmployer = await User.findOneAndUpdate(
      { _id: employerId, role: 'employer' },
      { 
        $set: { 
          'employerProfile.officeHours': {
            checkIn,
            checkOut,
            gracePeriod: gracePeriod || 10
          }
        } 
      },
      { 
        new: true,  // Return updated document
        runValidators: true 
      }
    );

    if (!updatedEmployer) {
      return res.status(403).json({
        success: false,
        message: 'Only employers can access'
      });
    }

    console.log('✅ Updated employer in DB:', updatedEmployer.employerProfile?.officeHours);

    // Return the updated office hours
    res.json({
      success: true,
      message: 'Office hours updated successfully',
      officeHours: updatedEmployer.employerProfile?.officeHours || {
        checkIn,
        checkOut,
        gracePeriod: gracePeriod || 10
      }
    });

  } catch (error) {
    console.error('❌ Update office hours error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
// ==================== CALCULATE LATE THRESHOLD ====================
// Helper function to calculate late threshold based on check-in + grace period
exports.calculateLateThreshold = (checkIn, gracePeriod) => {
  const [hours, minutes] = checkIn.split(':').map(Number);
  let totalMinutes = hours * 60 + minutes + (gracePeriod || 10);
  
  const lateHours = Math.floor(totalMinutes / 60) % 24;
  const lateMinutes = totalMinutes % 60;
  
  return `${lateHours.toString().padStart(2, '0')}:${lateMinutes.toString().padStart(2, '0')}`;
};

// ==================== GET ATTENDANCE SETTINGS ====================
exports.getAttendanceSettings = async (req, res) => {
  try {
    const employerId = req.user.id;

    const employer = await User.findById(employerId);
    if (!employer || employer.role !== 'employer') {
      return res.status(403).json({
        success: false,
        message: 'Only employers can access'
      });
    }

    const officeHours = employer.employerProfile?.officeHours || {
      checkIn: '09:00',
      checkOut: '18:00',
      gracePeriod: 10
    };

    const lateThreshold = exports.calculateLateThreshold(officeHours.checkIn, officeHours.gracePeriod);

    res.json({
      success: true,
      settings: {
        officeHours,
        lateThreshold,
        timezone: 'UTC', // Can be extended based on employer's location
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], // Default working days
        weekendDays: ['Saturday', 'Sunday']
      }
    });

  } catch (error) {
    console.error('Get attendance settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== GET TEAM STATS ONLY ====================
exports.getTeamStats = async (req, res) => {
  try {
    const employerId = req.user.id;

    const employer = await User.findById(employerId);
    if (!employer || employer.role !== 'employer') {
      return res.status(403).json({
        success: false,
        message: 'Only employers can access'
      });
    }

    const teamMembers = employer.employerProfile?.teamMembers || [];
    
    // FILTER: Sirf active members count karo
    const activeTeamMembers = teamMembers.filter(m => m.status === 'active');
    
    res.json({
      success: true,
      stats: {
        totalTeam: activeTeamMembers.length,
        activeTeam: activeTeamMembers.length,
        leftTeam: teamMembers.filter(m => m.status === 'left' || m.status === 'terminated').length,
        totalTeamAll: teamMembers.length // Optional
      }
    });

  } catch (error) {
    console.error('Get team stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== GET JOBS STATS ONLY ====================
exports.getJobsStats = async (req, res) => {
  try {
    const employerId = req.user.id;

    const jobs = await JobPost.find({ postedBy: employerId });
    
    res.json({
      success: true,
      stats: {
        totalJobs: jobs.length,
        activeJobs: jobs.filter(job => job.status === 'active' || job.status === 'open' || !job.status).length,
        pausedJobs: jobs.filter(job => job.status === 'paused' || job.status === 'closed').length
      }
    });

  } catch (error) {
    console.error('Get jobs stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};