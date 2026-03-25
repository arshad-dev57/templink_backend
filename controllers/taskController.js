const Task = require('../models/Tasks');
const User = require('../models/user_model');
const { sendToUser } = require('../services/onesignal');

// ==================== CREATE TASK ====================
exports.createTask = async (req, res) => {
  try {
    const employerId = req.user.id;
    const {
      title,
      description,
      employeeId,
      priority,
      dueDate,
      estimatedHours
    } = req.body;

    // Verify employer exists
    const employer = await User.findById(employerId);
    if (!employer || employer.role !== 'employer') {
      return res.status(403).json({
        success: false,
        message: 'Only employers can create tasks'
      });
    }

    // Verify employee exists
    const employee = await User.findById(employeeId);
    if (!employee || employee.role !== 'employee') {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Verify that employee is actively hired by this employer
    const isHired = employer.employerProfile?.teamMembers?.some(
      member => member.employeeId?.toString() === employeeId && member.status === 'active'
    );

    if (!isHired) {
      return res.status(403).json({
        success: false,
        message: 'This employee is not actively hired by you'
      });
    }

    // Create task
    const task = await Task.create({
      title,
      description,
      employerId,
      employeeId,
      priority: priority || 'medium',
      dueDate: new Date(dueDate),
      estimatedHours: estimatedHours || 0,
      status: 'pending'
    });

    // Populate employee details for response
    const populatedTask = await Task.findById(task._id)
      .populate('employerId', 'firstName lastName employerProfile')
      .populate('employeeId', 'firstName lastName employeeProfile');

    // Send notification to employee
    try {
      await sendToUser({
        mongoUserId: employeeId,
        title: 'New Task Assigned! 📋',
        message: `${employer.firstName} ${employer.lastName} assigned you a new task: "${title}"`,
        data: {
          type: 'new_task',
          screen: 'tasks',
          taskId: task._id.toString()
        }
      });
    } catch (notifError) {
      console.log('Notification error (non-fatal):', notifError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: populatedTask
    });

  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ==================== GET EMPLOYER TASKS ====================
exports.getEmployerTasks = async (req, res) => {
  try {
    const employerId = req.user.id;
    const {
      status,
      priority,
      employeeId,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      fromDate,
      toDate
    } = req.query;

    // Verify employer
    const employer = await User.findById(employerId);
    if (!employer || employer.role !== 'employer') {
      return res.status(403).json({
        success: false,
        message: 'Only employers can access'
      });
    }

    // Build query
    const query = { employerId, isArchived: false };
    
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (employeeId) query.employeeId = employeeId;
    if (fromDate || toDate) {
      query.dueDate = {};
      if (fromDate) query.dueDate.$gte = new Date(fromDate);
      if (toDate) query.dueDate.$lte = new Date(toDate);
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Get tasks with pagination
    const tasks = await Task.find(query)
      .populate('employeeId', 'firstName lastName employeeProfile')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await Task.countDocuments(query);

    // Summary statistics
    const summary = await Task.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          in_progress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $and: [{ $ne: ['$status', 'completed'] }, { $ne: ['$status', 'cancelled'] }, { $lt: ['$dueDate', new Date()] }] }, 1, 0] } }
        }
      }
    ]);

    res.json({
      success: true,
      summary: summary[0] || {
        total: 0,
        pending: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0,
        overdue: 0
      },
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum * limitNum < total,
        hasPrevPage: pageNum > 1
      },
      data: tasks
    });

  } catch (error) {
    console.error('Get employer tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== GET EMPLOYEE TASKS ====================
exports.getEmployeeTasks = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const {
      status,
      priority,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Verify employee
    const employee = await User.findById(employeeId);
    if (!employee || employee.role !== 'employee') {
      return res.status(403).json({
        success: false,
        message: 'Only employees can access'
      });
    }

    // Build query
    const query = { employeeId, isArchived: false };
    if (status) query.status = status;
    if (priority) query.priority = priority;

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Get tasks
    const tasks = await Task.find(query)
      .populate('employerId', 'firstName lastName employerProfile')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await Task.countDocuments(query);

    // Summary statistics
    const summary = await Task.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          in_progress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $and: [{ $ne: ['$status', 'completed'] }, { $ne: ['$status', 'cancelled'] }, { $lt: ['$dueDate', new Date()] }] }, 1, 0] } }
        }
      }
    ]);

    res.json({
      success: true,
      summary: summary[0] || {
        total: 0,
        pending: 0,
        in_progress: 0,
        completed: 0,
        overdue: 0
      },
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum * limitNum < total,
        hasPrevPage: pageNum > 1
      },
      data: tasks
    });

  } catch (error) {
    console.error('Get employee tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== GET TASK BY ID ====================
exports.getTaskById = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const task = await Task.findById(taskId)
      .populate('employerId', 'firstName lastName employerProfile')
      .populate('employeeId', 'firstName lastName employeeProfile')
      .populate('comments.userId', 'firstName lastName role');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check authorization
    if (task.employerId._id.toString() !== userId && task.employeeId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this task'
      });
    }

    res.json({
      success: true,
      data: task
    });

  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== UPDATE TASK STATUS ====================
exports.updateTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    const task = await Task.findById(taskId)
      .populate('employerId', 'firstName lastName')
      .populate('employeeId', 'firstName lastName');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check authorization
    if (task.employeeId._id.toString() !== userId && task.employerId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this task'
      });
    }

    const oldStatus = task.status;
    task.status = status;
    
    if (status === 'completed' && !task.completedAt) {
      task.completedAt = new Date();
    }

    await task.save();

    // Send notification to other party
    const notifyUserId = userRole === 'employer' 
      ? task.employeeId._id 
      : task.employerId._id;
    
    const updaterName = userRole === 'employer' 
      ? `${task.employerId.firstName} ${task.employerId.lastName}`
      : `${task.employeeId.firstName} ${task.employeeId.lastName}`;

    try {
      await sendToUser({
        mongoUserId: notifyUserId,
        title: `Task Status Updated: ${task.title}`,
        message: `${updaterName} changed task status from ${oldStatus} to ${status}`,
        data: {
          type: 'task_update',
          screen: 'tasks',
          taskId: task._id.toString(),
          status: status
        }
      });
    } catch (notifError) {
      console.log('Notification error:', notifError.message);
    }

    res.json({
      success: true,
      message: 'Task status updated successfully',
      data: task
    });

  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== UPDATE TASK ====================
exports.updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check authorization (only employer can edit task details)
    if (task.employerId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the employer who created the task can edit it'
      });
    }

    // Fields that can be updated
    const allowedUpdates = ['title', 'description', 'priority', 'dueDate', 'estimatedHours'];
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        task[field] = updates[field];
      }
    });

    await task.save();

    const updatedTask = await Task.findById(taskId)
      .populate('employeeId', 'firstName lastName employeeProfile');

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: updatedTask
    });

  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== ADD COMMENT ====================
exports.addComment = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { comment } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    const task = await Task.findById(taskId)
      .populate('employerId', 'firstName lastName')
      .populate('employeeId', 'firstName lastName');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check authorization
    if (task.employerId._id.toString() !== userId && task.employeeId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to comment'
      });
    }

    task.comments.push({
      userId,
      userRole,
      comment
    });

    await task.save();

    // Send notification to other party
    const notifyUserId = userRole === 'employer' 
      ? task.employeeId._id 
      : task.employerId._id;
    
    const commenterName = userRole === 'employer' 
      ? `${task.employerId.firstName} ${task.employerId.lastName}`
      : `${task.employeeId.firstName} ${task.employeeId.lastName}`;

    try {
      await sendToUser({
        mongoUserId: notifyUserId,
        title: `New Comment on Task: ${task.title}`,
        message: `${commenterName} commented: "${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}"`,
        data: {
          type: 'task_comment',
          screen: 'task_detail',
          taskId: task._id.toString()
        }
      });
    } catch (notifError) {
      console.log('Notification error:', notifError.message);
    }

    res.json({
      success: true,
      message: 'Comment added successfully',
      data: task.comments
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== ADD FEEDBACK ====================
exports.addFeedback = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { rating, comment, type } = req.body; // type: 'employer' or 'employee'
    const userId = req.user.id;

    const task = await Task.findById(taskId)
      .populate('employerId', 'firstName lastName')
      .populate('employeeId', 'firstName lastName');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check authorization
    if (type === 'employer' && task.employerId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the employer can give employer feedback'
      });
    }

    if (type === 'employee' && task.employeeId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the employee can give employee feedback'
      });
    }

    // Update feedback
    if (type === 'employer') {
      task.employerFeedback = {
        rating,
        comment,
        givenAt: new Date()
      };
    } else {
      task.employeeFeedback = {
        rating,
        comment,
        givenAt: new Date()
      };
    }

    await task.save();

    res.json({
      success: true,
      message: 'Feedback added successfully',
      data: {
        employerFeedback: task.employerFeedback,
        employeeFeedback: task.employeeFeedback
      }
    });

  } catch (error) {
    console.error('Add feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== ARCHIVE TASK ====================
exports.archiveTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Only employer or the assigned employee can archive
    if (task.employerId.toString() !== userId && task.employeeId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to archive this task'
      });
    }

    task.isArchived = true;
    await task.save();

    res.json({
      success: true,
      message: 'Task archived successfully'
    });

  } catch (error) {
    console.error('Archive task error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== GET TASK STATISTICS ====================
exports.getTaskStatistics = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    const matchCondition = userRole === 'employer' 
      ? { employerId: userId, isArchived: false }
      : { employeeId: userId, isArchived: false };

    const stats = await Task.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          pendingTasks: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          inProgressTasks: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          overdueTasks: { $sum: { $cond: [{ $and: [{ $ne: ['$status', 'completed'] }, { $ne: ['$status', 'cancelled'] }, { $lt: ['$dueDate', new Date()] }] }, 1, 0] } },
          avgEstimatedHours: { $avg: '$estimatedHours' },
          avgActualHours: { $avg: '$actualHours' },
          totalEstimatedHours: { $sum: '$estimatedHours' },
          totalActualHours: { $sum: '$actualHours' }
        }
      },
      {
        $project: {
          completionRate: {
            $multiply: [
              { $divide: ['$completedTasks', { $max: ['$totalTasks', 1] }] },
              100
            ]
          },
          onTimeRate: {
            $multiply: [
              { $divide: [
                { $subtract: ['$totalTasks', '$overdueTasks'] },
                { $max: ['$totalTasks', 1] }
              ] },
              100
            ]
          },
          efficiency: {
            $divide: ['$totalEstimatedHours', { $max: ['$totalActualHours', 1] }]
          },
          ...stats[0]
        }
      }
    ]);

    // Priority breakdown
    const priorityStats = await Task.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
        }
      }
    ]);

    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrend = await Task.aggregate([
      { $match: { ...matchCondition, createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          inProgressTasks: 0,
          overdueTasks: 0,
          completionRate: 0,
          onTimeRate: 0,
          efficiency: 0,
          avgEstimatedHours: 0,
          avgActualHours: 0,
          totalEstimatedHours: 0,
          totalActualHours: 0
        },
        priorityBreakdown: priorityStats,
        monthlyTrend: monthlyTrend
      }
    });

  } catch (error) {
    console.error('Get task statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};