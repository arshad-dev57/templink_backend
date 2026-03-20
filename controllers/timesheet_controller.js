const Timesheet = require('../models/timesheet_model');
const User = require('../models/user_model');

 exports.addTimeEntry = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { project, task, date, hours, description } = req.body;

    console.log('\n🟡 ===== ADD TIME ENTRY STARTED =====');
    console.log('📝 Project:', project, 'Task:', task, 'Hours:', hours);

    // Validation
    if (!project || !task || !date || !hours) {
      return res.status(400).json({
        success: false,
        message: 'Project, task, date and hours are required'
      });
    }

    // Find active employer
    const employee = await User.findById(employeeId)
      .populate('myEmployers.employerId');

    const activeEmployer = employee.myEmployers?.find(e => e.status === 'active');
    
    if (!activeEmployer) {
      return res.status(400).json({
        success: false,
        message: 'No active employer found'
      });
    }

    // Create timesheet entry
    const timesheet = await Timesheet.create({
      employeeId: employeeId,
      employerId: activeEmployer.employerId,
      project,
      task,
      date: new Date(date),
      hours,
      description,
      status: 'pending'
    });

    console.log('✅ Time entry added successfully');

    res.json({
      success: true,
      message: 'Time entry added successfully',
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

// ==================== GET WEEKLY TIMESHEET ====================
exports.getWeeklyTimesheet = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { weekStart } = req.query;

    console.log('\n🟡 ===== GET WEEKLY TIMESHEET STARTED =====');

    // Calculate week range
    const startDate = weekStart ? new Date(weekStart) : new Date();
    startDate.setHours(0, 0, 0, 0);
    
    // Get Monday of current week
    const day = startDate.getDay();
    const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(startDate.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    console.log('📅 Week:', monday, 'to', sunday);

    // Get all timesheet entries for this week
    const entries = await Timesheet.find({
      employeeId: employeeId,
      date: {
        $gte: monday,
        $lte: sunday
      }
    }).sort({ date: 1 });

    // Group by date
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weeklyData = [];
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(monday);
      currentDate.setDate(monday.getDate() + i);
      
      const dayEntries = entries.filter(e => {
        const entryDate = new Date(e.date);
        return entryDate.toDateString() === currentDate.toDateString();
      });

      const totalHours = dayEntries.reduce((sum, e) => sum + e.hours, 0);
      
      weeklyData.push({
        day: days[i],
        date: currentDate.getDate().toString(),
        hours: totalHours,
        project: dayEntries.length > 0 ? dayEntries[0].project : '-',
        entries: dayEntries
      });
    }

    // Calculate totals
    const totalHours = weeklyData.reduce((sum, d) => sum + d.hours, 0);
    const billableHours = totalHours; // You can add logic for billable vs non-billable
    const overtime = Math.max(0, totalHours - 40);

    res.json({
      success: true,
      data: {
        weekStart: monday,
        weekEnd: sunday,
        weekNumber: getWeekNumber(monday),
        weeklyData,
        summary: {
          totalHours,
          billableHours,
          overtime,
          targetHours: 40,
          percentage: totalHours > 0 ? Math.min(100, (totalHours / 50) * 100) : 0
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

// Helper: Get week number
function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// ==================== GET TIMESHEET HISTORY ====================
exports.getTimesheetHistory = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { month, year } = req.query;

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

    const entries = await Timesheet.find({
      employeeId: employeeId,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ date: -1 });

    // Calculate stats
    const stats = {
      totalEntries: entries.length,
      totalHours: entries.reduce((sum, e) => sum + e.hours, 0),
      approved: entries.filter(e => e.status === 'approved').length,
      pending: entries.filter(e => e.status === 'pending').length,
      rejected: entries.filter(e => e.status === 'rejected').length
    };

    res.json({
      success: true,
      data: {
        entries,
        stats
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

// ==================== GET PROJECT BREAKDOWN ====================
exports.getProjectBreakdown = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);

    const entries = await Timesheet.find({
      employeeId: employeeId,
      date: {
        $gte: start,
        $lte: end
      }
    });

    // Group by project
    const projectMap = {};
    entries.forEach(entry => {
      if (!projectMap[entry.project]) {
        projectMap[entry.project] = {
          project: entry.project,
          hours: 0,
          entries: 0
        };
      }
      projectMap[entry.project].hours += entry.hours;
      projectMap[entry.project].entries += 1;
    });

    const projects = Object.values(projectMap);
    const totalHours = projects.reduce((sum, p) => sum + p.hours, 0);

    // Calculate percentages
    projects.forEach(p => {
      p.percentage = totalHours > 0 ? (p.hours / totalHours * 100).toFixed(1) : 0;
    });

    res.json({
      success: true,
      data: {
        projects,
        totalHours,
        period: { start, end }
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

// ==================== UPDATE TIME ENTRY ====================
exports.updateTimeEntry = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { entryId } = req.params;
    const { project, task, date, hours, description } = req.body;

    const timesheet = await Timesheet.findOne({
      _id: entryId,
      employeeId: employeeId
    });

    if (!timesheet) {
      return res.status(404).json({
        success: false,
        message: 'Time entry not found'
      });
    }

    if (timesheet.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update approved/rejected entries'
      });
    }

    // Update fields
    if (project) timesheet.project = project;
    if (task) timesheet.task = task;
    if (date) timesheet.date = new Date(date);
    if (hours) timesheet.hours = hours;
    if (description !== undefined) timesheet.description = description;

    await timesheet.save();

    res.json({
      success: true,
      message: 'Time entry updated successfully',
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

// ==================== DELETE TIME ENTRY ====================
exports.deleteTimeEntry = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { entryId } = req.params;

    const timesheet = await Timesheet.findOne({
      _id: entryId,
      employeeId: employeeId
    });

    if (!timesheet) {
      return res.status(404).json({
        success: false,
        message: 'Time entry not found'
      });
    }

    if (timesheet.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete approved/rejected entries'
      });
    }

    await timesheet.deleteOne();

    res.json({
      success: true,
      message: 'Time entry deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};