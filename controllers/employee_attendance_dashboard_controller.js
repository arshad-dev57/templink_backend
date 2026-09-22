// controllers/employee_dashboard_controller.js
const User = require('../models/user_model');
const JobPost = require('../models/jobpost');
const JobApplication = require('../models/JobApplication');
const { sendNotification } = require('./notificationController');

// controllers/employee_attendance_controller.js
const Attendance = require('../models/attendance_model');

// ==================== GET EMPLOYEE DASHBOARD DATA ====================
exports.getEmployeeDashboard = async (req, res) => {
  try {
    const employeeId = req.user.id;

    console.log('\n🟡 ===== GET EMPLOYEE DASHBOARD STARTED =====');
    console.log('📝 Employee ID:', employeeId);

    // Verify employee
    const employee = await User.findById(employeeId);
    if (!employee || employee.role !== 'employee') {
      return res.status(403).json({
        success: false,
        message: 'Only employees can access'
      });
    }

    console.log('👤 Employee found:', employee.email);

    // ============ 1. GET ALL HIRED COMPANIES ============
    const hiredApplications = await JobApplication.find({
      employeeId: employeeId,
      status: 'hired'
    }).sort({ hiredAt: -1 });

    console.log(`📊 Found ${hiredApplications.length} hired applications`);

    // Get unique employer IDs
    const employerIds = [...new Set(hiredApplications.map(app => app.employerId.toString()))];
    
    // Fetch all employers details
    const employers = await User.find({
      _id: { $in: employerIds },
      role: 'employer'
    }).select('firstName lastName email employerProfile pointsBalance');

    // Format companies data
    const companies = await Promise.all(employers.map(async (employer) => {
      // Get all jobs for this employer
      const employerJobs = hiredApplications.filter(
        app => app.employerId.toString() === employer._id.toString()
      );

      // Get current active job
      const activeJob = employerJobs.find(j => j.employmentStatus === 'active');
      
      // Get job details for each application
      const jobsWithDetails = await Promise.all(employerJobs.map(async (app) => {
        const job = await JobPost.findById(app.jobId)
          .select('title description type location workplace salary requirements qualifications');

        return {
          applicationId: app._id,
          jobId: app.jobId,
          jobTitle: app.jobSnapshot?.title || job?.title || 'Unknown',
          jobDetails: {
            title: job?.title || app.jobSnapshot?.title,
            description: job?.description || app.jobSnapshot?.about,
            type: job?.type || app.jobSnapshot?.type,
            location: job?.location || app.jobSnapshot?.location,
            workplace: job?.workplace || app.jobSnapshot?.workplace,
            salary: job?.salary || app.jobSnapshot?.salaryAmount,
            requirements: job?.requirements || app.jobSnapshot?.requirements,
            qualifications: job?.qualifications || app.jobSnapshot?.qualifications
          },
          hiredAt: app.hiredAt || app.updatedAt,
          employmentStatus: app.employmentStatus || 'active',
          leftAt: app.leftAt || null,
          leftReason: app.leftReason || null
        };
      }));

      return {
        companyId: employer._id,
        companyName: employer.employerProfile?.companyName || employer.firstName || 'Unknown Company',
        companyLogo: employer.employerProfile?.logoUrl || '',
        industry: employer.employerProfile?.industry || '',
        companySize: employer.employerProfile?.companySize || '',
        location: {
          city: employer.employerProfile?.city || '',
          country: employer.employerProfile?.country || employer.country || ''
        },
        workModel: employer.employerProfile?.workModel || '',
        about: employer.employerProfile?.about || '',
        website: employer.employerProfile?.website || '',
        isVerified: employer.employerProfile?.isVerifiedEmployer || false,
        rating: employer.employerProfile?.rating || 0,
        
        // Current active job (if any)
        currentJob: activeJob ? {
          jobId: activeJob.jobId,
          title: activeJob.jobTitle,
          hiredAt: activeJob.hiredAt,
          jobDetails: activeJob.jobDetails
        } : null,
        
        // All jobs with this company
        jobs: jobsWithDetails,
        
        // Stats
        stats: {
          totalJobs: jobsWithDetails.length,
          activeJobs: jobsWithDetails.filter(j => j.employmentStatus === 'active').length,
          completedJobs: jobsWithDetails.filter(j => j.employmentStatus === 'left').length
        }
      };
    }));

    // Separate active and past companies
    const activeCompanies = companies.filter(c => c.currentJob !== null);
    const pastCompanies = companies.filter(c => c.currentJob === null && c.jobs.length > 0);

    // ============ 2. GET EMPLOYEE STATS ============
    const totalApplications = await JobApplication.countDocuments({ employeeId: employeeId });
    const pendingApplications = await JobApplication.countDocuments({ 
      employeeId: employeeId, 
      status: 'pending' 
    });
    const hiredCount = await JobApplication.countDocuments({ 
      employeeId: employeeId, 
      status: 'hired' 
    });
    const rejectedCount = await JobApplication.countDocuments({ 
      employeeId: employeeId, 
      status: 'rejected' 
    });

    // ============ 3. GET RECENT ACTIVITIES ============
    const recentApplications = await JobApplication.find({ employeeId: employeeId })
      .sort({ appliedAt: -1 })
      .limit(5)
      .populate('jobId', 'title company')
      .populate('employerId', 'employerProfile');

    const activities = recentApplications.map(app => ({
      type: 'application',
      company: app.employerId?.employerProfile?.companyName || 'Unknown Company',
      jobTitle: app.jobId?.title || app.jobSnapshot?.title || 'Unknown Job',
      status: app.status,
      date: app.appliedAt,
      message: app.status === 'hired' 
        ? 'You were hired!' 
        : app.status === 'rejected' 
          ? 'Application rejected' 
          : 'Application submitted'
    }));

    // ============ 4. GET UPCOMING DEADLINES ============
    const activeJobs = hiredApplications.filter(j => j.employmentStatus === 'active');

    // ============ 5. GET EMPLOYEE PROFILE ============
    const employeeProfile = {
      name: `${employee.firstName} ${employee.lastName}`,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      country: employee.country,
      title: employee.employeeProfile?.title || '',
      experienceLevel: employee.employeeProfile?.experienceLevel || '',
      category: employee.employeeProfile?.category || '',
      skills: employee.employeeProfile?.skills || [],
      hourlyRate: employee.employeeProfile?.hourlyRate || '',
      photoUrl: employee.employeeProfile?.photoUrl || '',
      bio: employee.employeeProfile?.bio || '',
      rating: employee.employeeProfile?.rating || 0,
      totalReviews: employee.employeeProfile?.totalReviews || 0,
      pointsBalance: employee.pointsBalance || 0
    };

    // ============ 6. FINAL RESPONSE ============
    console.log('✅ Employee dashboard data prepared successfully');
    console.log(`📊 Active Companies: ${activeCompanies.length}`);
    console.log(`📊 Past Companies: ${pastCompanies.length}`);

    res.json({
      success: true,
      data: {
        profile: employeeProfile,
        companies: {
          all: companies,
          active: activeCompanies,
          past: pastCompanies
        },
        stats: {
          totalCompanies: companies.length,
          activeCompanies: activeCompanies.length,
          pastCompanies: pastCompanies.length,
          totalJobs: companies.reduce((acc, c) => acc + c.stats.totalJobs, 0),
          totalApplications: totalApplications,
          pendingApplications: pendingApplications,
          hiredCount: hiredCount,
          rejectedCount: rejectedCount
        },
        recentActivity: activities,
        summary: {
          totalEarnings: '$4,250',
          hoursWorked: 86,
          upcomingDeadlines: activeJobs.length
        }
      }
    });

  } catch (error) {
    console.error('❌ Get employee dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ==================== GET EMPLOYEE PROFILE ONLY ====================
exports.getEmployeeProfile = async (req, res) => {
  try {
    const employeeId = req.user.id;

    const employee = await User.findById(employeeId);
    if (!employee || employee.role !== 'employee') {
      return res.status(403).json({
        success: false,
        message: 'Only employees can access'
      });
    }

    const profile = {
      name: `${employee.firstName} ${employee.lastName}`,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      country: employee.country,
      title: employee.employeeProfile?.title || '',
      experienceLevel: employee.employeeProfile?.experienceLevel || '',
      category: employee.employeeProfile?.category || '',
      skills: employee.employeeProfile?.skills || [],
      hourlyRate: employee.employeeProfile?.hourlyRate || '',
      photoUrl: employee.employeeProfile?.photoUrl || '',
      bio: employee.employeeProfile?.bio || '',
      rating: employee.employeeProfile?.rating || 0,
      totalReviews: employee.employeeProfile?.totalReviews || 0,
      pointsBalance: employee.pointsBalance || 0,
      memberSince: employee.createdAt
    };

    res.json({
      success: true,
      profile
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== GET EMPLOYEE COMPANIES ONLY ====================
exports.getEmployeeCompanies = async (req, res) => {
  try {
    const employeeId = req.user.id;

    const hiredApplications = await JobApplication.find({
      employeeId: employeeId,
      status: 'hired'
    }).sort({ hiredAt: -1 });

    const employerIds = [...new Set(hiredApplications.map(app => app.employerId.toString()))];
    
    const employers = await User.find({
      _id: { $in: employerIds },
      role: 'employer'
    }).select('firstName lastName email employerProfile');

    const companies = await Promise.all(employers.map(async (employer) => {
      const employerJobs = hiredApplications.filter(
        app => app.employerId.toString() === employer._id.toString()
      );

      const activeJob = employerJobs.find(j => j.employmentStatus === 'active');

      return {
        companyId: employer._id,
        companyName: employer.employerProfile?.companyName || employer.firstName || 'Unknown Company',
        companyLogo: employer.employerProfile?.logoUrl || '',
        industry: employer.employerProfile?.industry || '',
        location: {
          city: employer.employerProfile?.city || '',
          country: employer.employerProfile?.country || ''
        },
        isVerified: employer.employerProfile?.isVerifiedEmployer || false,
        rating: employer.employerProfile?.rating || 0,
        currentJob: activeJob ? {
          jobId: activeJob.jobId,
          title: activeJob.jobTitle,
          hiredAt: activeJob.hiredAt
        } : null,
        totalJobs: employerJobs.length,
        activeJobs: employerJobs.filter(j => j.employmentStatus === 'active').length
      };
    }));

    res.json({
      success: true,
      companies: companies
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== CHECK-IN ====================
exports.checkIn = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { latitude, longitude, locationName } = req.body;

    console.log('\n🟡 ===== EMPLOYEE CHECK-IN STARTED =====');
    console.log('📝 Employee ID:', employeeId);

    // Check if already checked in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingAttendance = await Attendance.findOne({
      employeeId: employeeId,
      date: {
        $gte: today,
        $lt: tomorrow
      }
    });

    if (existingAttendance) {
      if (existingAttendance.checkIn) {
        return res.status(400).json({
          success: false,
          message: 'You have already checked in today'
        });
      }
    }

    // Get employer's office hours for late calculation
    const employee = await User.findById(employeeId).populate('myEmployers.employerId');
    
    // Find active employer
    const activeEmployer = employee.myEmployers?.find(e => e.status === 'active');
    
    let isLate = false;
    let lateMinutes = 0;
    let officeStartTime = '09:00';
    let employerName = 'Your employer';

    if (activeEmployer) {
      const employer = await User.findById(activeEmployer.employerId);
      officeStartTime = employer.employerProfile?.officeHours?.checkIn || '09:00';
      const gracePeriod = employer.employerProfile?.officeHours?.gracePeriod || 10;
      employerName = employer.employerProfile?.companyName || employer.firstName || 'Your employer';
      
      // Calculate if late
      const now = new Date();
      const [checkHour, checkMinute] = officeStartTime.split(':').map(Number);
      
      const officeStart = new Date();
      officeStart.setHours(checkHour, checkMinute + gracePeriod, 0, 0);
      
      if (now > officeStart) {
        isLate = true;
        lateMinutes = Math.round((now - officeStart) / 60000);
      }
    }

    // Create or update attendance
    let attendance;
    if (existingAttendance) {
      attendance = await Attendance.findByIdAndUpdate(
        existingAttendance._id,
        {
          checkIn: new Date(),
          checkInLocation: { latitude, longitude, name: locationName },
          status: isLate ? 'late' : 'present',
          isLate: isLate,
          lateMinutes: lateMinutes
        },
        { new: true }
      );
    } else {
      attendance = await Attendance.create({
        employeeId: employeeId,
        employerId: activeEmployer?.employerId,
        date: new Date(),
        checkIn: new Date(),
        checkInLocation: { latitude, longitude, name: locationName },
        status: isLate ? 'late' : 'present',
        isLate: isLate,
        lateMinutes: lateMinutes,
        officeStartTime: officeStartTime
      });
    }

    // 🔔 SEND NOTIFICATION - Check-in successful
    let notificationMessage = isLate 
      ? `You checked in late by ${lateMinutes} minutes. Office starts at ${officeStartTime}`
      : `You checked in on time at ${new Date().toLocaleTimeString()}`;
    
    await sendNotification(
      employeeId,
      isLate ? "⏰ Late Check-in" : "✅ Check-in Successful",
      notificationMessage,
      {
        type: "attendance_checkin",
        checkInTime: new Date().toISOString(),
        isLate: isLate,
        lateMinutes: lateMinutes,
        officeStartTime: officeStartTime,
        status: attendance.status
      }
    );

    // 🔔 NOTIFY EMPLOYER IF LATE
    if (isLate && activeEmployer) {
      await sendNotification(
        activeEmployer.employerId,
        "⏰ Employee Late Check-in",
        `${employee.firstName} ${employee.lastName} checked in late by ${lateMinutes} minutes`,
        {
          type: "employee_late_checkin",
          employeeId: employeeId,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          checkInTime: new Date().toISOString(),
          lateMinutes: lateMinutes,
          attendanceId: attendance._id.toString()
        }
      );
    }

    console.log('✅ Check-in successful');
    console.log(`⏰ Time: ${new Date().toLocaleTimeString()}`);
    console.log(`📊 Status: ${isLate ? 'LATE' : 'ON TIME'}`);

    res.json({
      success: true,
      message: isLate ? 'Checked in (Late)' : 'Checked in successfully',
      data: {
        attendanceId: attendance._id,
        checkIn: attendance.checkIn,
        status: attendance.status,
        isLate: attendance.isLate,
        lateMinutes: attendance.lateMinutes,
        officeStartTime: officeStartTime
      }
    });

  } catch (error) {
    console.error('❌ Check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== CHECK-OUT ====================
exports.checkOut = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { latitude, longitude, locationName } = req.body;

    console.log('\n🟡 ===== EMPLOYEE CHECK-OUT STARTED =====');
    console.log('📝 Employee ID:', employeeId);

    // Find today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const attendance = await Attendance.findOne({
      employeeId: employeeId,
      date: {
        $gte: today,
        $lt: tomorrow
      }
    });

    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: 'No check-in record found for today'
      });
    }

    if (attendance.checkOut) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked out today'
      });
    }

    // Calculate total hours worked
    const checkInTime = new Date(attendance.checkIn);
    const checkOutTime = new Date();
    
    const hoursWorked = (checkOutTime - checkInTime) / (1000 * 60 * 60);
    const roundedHours = Math.round(hoursWorked * 10) / 10;

    // Update attendance
    attendance.checkOut = checkOutTime;
    attendance.checkOutLocation = { latitude, longitude, name: locationName };
    attendance.totalHours = roundedHours;
    await attendance.save();

    // 🔔 SEND NOTIFICATION - Check-out successful
    await sendNotification(
      employeeId,
      "✅ Check-out Successful",
      `You worked for ${roundedHours} hours today. Checked out at ${checkOutTime.toLocaleTimeString()}`,
      {
        type: "attendance_checkout",
        checkOutTime: checkOutTime.toISOString(),
        totalHours: roundedHours,
        attendanceId: attendance._id.toString()
      }
    );

    // Get employee for name
    const employee = await User.findById(employeeId);
    
    // 🔔 NOTIFY EMPLOYER - Employee checked out
    if (attendance.employerId) {
      await sendNotification(
        attendance.employerId,
        "👋 Employee Checked Out",
        `${employee.firstName} ${employee.lastName} checked out after working ${roundedHours} hours today`,
        {
          type: "employee_checkout",
          employeeId: employeeId,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          checkOutTime: checkOutTime.toISOString(),
          totalHours: roundedHours,
          attendanceId: attendance._id.toString()
        }
      );
    }

    console.log('✅ Check-out successful');
    console.log(`⏰ Time: ${checkOutTime.toLocaleTimeString()}`);
    console.log(`📊 Hours worked: ${roundedHours}h`);

    res.json({
      success: true,
      message: 'Checked out successfully',
      data: {
        attendanceId: attendance._id,
        checkIn: attendance.checkIn,
        checkOut: attendance.checkOut,
        totalHours: roundedHours
      }
    });

  } catch (error) {
    console.error('❌ Check-out error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== GET TODAY ATTENDANCE ====================
exports.getTodayAttendance = async (req, res) => {
  try {
    const employeeId = req.user.id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const attendance = await Attendance.findOne({
      employeeId: employeeId,
      date: {
        $gte: today,
        $lt: tomorrow
      }
    });

    if (attendance) {
      return res.json({
        success: true,
        data: {
          isCheckedIn: !!attendance.checkIn,
          isCheckedOut: !!attendance.checkOut,
          checkIn: attendance.checkIn,
          checkOut: attendance.checkOut,
          status: attendance.status,
          isLate: attendance.isLate,
          lateMinutes: attendance.lateMinutes,
          totalHours: attendance.totalHours,
          officeStartTime: attendance.officeStartTime,
          officeEndTime: attendance.officeEndTime,
          gracePeriod: attendance.gracePeriod,
          pointsBalance: 0
        }
      });
    }

    const employee = await User.findById(employeeId).populate('myEmployers.employerId');
    
    const activeEmployer = employee.myEmployers?.find(e => e.status === 'active');
    
    let officeStartTime = '09:00';
    let officeEndTime = '18:00';
    let gracePeriodVal = 10;

    if (activeEmployer) {
      const employer = await User.findById(activeEmployer.employerId);
      const officeHours = employer.employerProfile?.officeHours || {};
      officeStartTime = officeHours.checkIn || '09:00';
      officeEndTime = officeHours.checkOut || '18:00';
      gracePeriodVal = officeHours.gracePeriod || 10;
    }

    return res.json({
      success: true,
      data: {
        isCheckedIn: false,
        isCheckedOut: false,
        checkIn: null,
        checkOut: null,
        status: null,
        isLate: false,
        lateMinutes: 0,
        totalHours: 0,
        officeStartTime: officeStartTime,
        officeEndTime: officeEndTime,
        gracePeriod: gracePeriodVal,
        pointsBalance: employee.pointsBalance || 0
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

// ==================== GET ATTENDANCE HISTORY ====================
exports.getAttendanceHistory = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { month, year } = req.query;

    let startDate, endDate;

    if (month && year) {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    endDate.setHours(23, 59, 59, 999);

    const attendance = await Attendance.find({
      employeeId: employeeId,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ date: -1 });

    const totalDays = attendance.length;
    const presentDays = attendance.filter(a => a.status === 'present').length;
    const lateDays = attendance.filter(a => a.status === 'late').length;
    const absentDays = attendance.filter(a => a.status === 'absent').length;
    const totalHours = attendance.reduce((sum, a) => sum + (a.totalHours || 0), 0);

    res.json({
      success: true,
      data: {
        records: attendance,
        stats: {
          totalDays,
          presentDays,
          lateDays,
          absentDays,
          totalHours: Math.round(totalHours * 10) / 10
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