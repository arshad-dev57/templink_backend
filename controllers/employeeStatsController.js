const User = require('../models/user_model');
const Proposal = require('../models/Proposal');
const Project = require('../models/project');
const Contract = require('../models/Contract');

exports.getEmployeeStats = async (req, res) => {
  try {
    const employeeId = req.user.id;
    
    console.log(`\n🟡 Fetching stats for employee: ${employeeId}`);
    const user = await User.findById(employeeId).select('employeeProfile pointsBalance');
    const proposals = await Proposal.find({ employeeId });
    const totalProposals = proposals.length;
    const acceptedProposals = proposals.filter(p => p.status === 'ACCEPTED').length;
    const pendingProposals = proposals.filter(p => p.status === 'PENDING').length;
    const rejectedProposals = proposals.filter(p => p.status === 'REJECTED').length;
    
    // 3. Contract Stats
    const contracts = await Contract.find({ employeeId });
    const activeContracts = contracts.filter(c => c.status === 'ACTIVE').length;
    const completedContracts = contracts.filter(c => c.status === 'COMPLETED').length;
    
    // 4. Project Stats (Projects employee is working on)
    const workingProjects = await Project.find({
      'acceptedProposal.employeeId': employeeId,
      status: 'IN_PROGRESS'
    }).countDocuments();
    
    const completedProjects = await Project.find({
      'acceptedProposal.employeeId': employeeId,
      status: 'COMPLETED'
    }).countDocuments();

    // 5. Earnings Calculation
    let totalEarnings = 0;
    let pendingEarnings = 0;
    
    contracts.forEach(contract => {
      if (contract.status === 'ACTIVE' || contract.status === 'COMPLETED') {
        // Sum up all milestone amounts
        const contractTotal = contract.milestones?.reduce((sum, m) => sum + (m.amount || 0), 0) || 0;
        
        if (contract.status === 'COMPLETED') {
          totalEarnings += contractTotal;
        } else {
          pendingEarnings += contractTotal;
        }
      }
    });

    // 6. Rating Stats
    const ratings = contracts
      .filter(c => c.employerFeedback?.rating)
      .map(c => c.employerFeedback.rating);
    
    const averageRating = ratings.length > 0 
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
      : 0;

    // 7. Success Rate
    const successRate = totalProposals > 0 
      ? Math.round((acceptedProposals / totalProposals) * 100) 
      : 0;

    const stats = {
      profile: {
        title: user?.employeeProfile?.title || 'Not set',
        hourlyRate: user?.employeeProfile?.hourlyRate || 0,
        pointsBalance: user?.pointsBalance || 0,
        rating: user?.employeeProfile?.rating || 0,
        totalReviews: user?.employeeProfile?.totalReviews || 0,
      },
      proposals: {
        total: totalProposals,
        accepted: acceptedProposals,
        pending: pendingProposals,
        rejected: rejectedProposals,
        successRate: successRate
      },
      contracts: {
        total: contracts.length,
        active: activeContracts,
        completed: completedContracts
      },
      projects: {
        working: workingProjects,
        completed: completedProjects
      },
      earnings: {
        total: totalEarnings,
        pending: pendingEarnings,
        averagePerProject: contracts.length > 0 
          ? Math.round(totalEarnings / contracts.length) 
          : 0
      },
      performance: {
        averageRating: averageRating.toFixed(1),
        totalRatings: ratings.length,
        successRate: successRate,
        responseRate: 95 // Default, you can calculate from messages
      },
      timeline: {
        memberSince: user?.createdAt || new Date(),
        totalDays: Math.floor((new Date() - (user?.createdAt || new Date())) / (1000 * 60 * 60 * 24))
      }
    };

    return res.status(200).json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Error fetching employee stats:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== GET EARNINGS HISTORY ====================
exports.getEarningsHistory = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { period = 'month' } = req.query; // week, month, year

    const contracts = await Contract.find({ 
      employeeId,
      status: { $in: ['ACTIVE', 'COMPLETED'] }
    }).populate('projectId', 'title');

    let earnings = [];
    let labels = [];

    if (period === 'week') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
        
        const dayEarnings = contracts.reduce((sum, c) => {
          const paidAt = c.milestones?.filter(m => m.releasedAt && 
            new Date(m.releasedAt).toDateString() === date.toDateString()
          ).reduce((s, m) => s + (m.amount || 0), 0) || 0;
          return sum + paidAt;
        }, 0);
        
        earnings.push(dayEarnings);
      }
    } else if (period === 'month') {
      // Last 30 days grouped by week
      for (let i = 3; i >= 0; i--) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() - (i * 7));
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 7);
        
        labels.push(`Week ${4 - i}`);
        
        const weekEarnings = contracts.reduce((sum, c) => {
          const weekPaid = c.milestones?.filter(m => m.releasedAt && 
            new Date(m.releasedAt) >= startDate && 
            new Date(m.releasedAt) <= endDate
          ).reduce((s, m) => s + (m.amount || 0), 0) || 0;
          return sum + weekPaid;
        }, 0);
        
        earnings.push(weekEarnings);
      }
    } else if (period === 'year') {
      // Last 12 months
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        labels.push(date.toLocaleDateString('en-US', { month: 'short' }));
        
        const monthEarnings = contracts.reduce((sum, c) => {
          const monthPaid = c.milestones?.filter(m => m.releasedAt && 
            new Date(m.releasedAt).getMonth() === date.getMonth() &&
            new Date(m.releasedAt).getFullYear() === date.getFullYear()
          ).reduce((s, m) => s + (m.amount || 0), 0) || 0;
          return sum + monthPaid;
        }, 0);
        
        earnings.push(monthEarnings);
      }
    }

    return res.status(200).json({
      success: true,
      period,
      labels,
      earnings
    });

  } catch (error) {
    console.error('❌ Error fetching earnings history:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== GET RECENT ACTIVITY ====================
exports.getRecentActivity = async (req, res) => {
  try {
    const employeeId = req.user.id;

    // Get recent proposals
    const recentProposals = await Proposal.find({ employeeId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('projectId', 'title');

    // Get recent contracts
    const recentContracts = await Contract.find({ employeeId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('projectId', 'title');

    // Combine and sort activities
    const activities = [];

    recentProposals.forEach(p => {
      activities.push({
        type: 'proposal',
        id: p._id,
        title: `Proposal sent for "${p.projectId?.title || 'Project'}"`,
        status: p.status,
        date: p.createdAt,
        amount: p.fixedPrice
      });
    });

    recentContracts.forEach(c => {
      activities.push({
        type: 'contract',
        id: c._id,
        title: `Contract ${c.status === 'ACTIVE' ? 'started' : 'completed'}`,
        projectName: c.projectId?.title || 'Project',
        status: c.status,
        date: c.signedAt || c.createdAt,
        amount: c.financialSummary?.totalAmount || 0
      });
    });

    // Sort by date (newest first)
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.status(200).json({
      success: true,
      activities: activities.slice(0, 10)
    });

  } catch (error) {
    console.error('❌ Error fetching recent activity:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};