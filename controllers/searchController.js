const Project = require('../models/project');
const JobPost = require('../models/jobpost');
const User = require('../models/user_model');

// ==================== SEARCH ALL ====================
exports.searchAll = async (req, res) => {
  try {
    const { q, type } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const searchQuery = q.trim();
    const searchRegex = new RegExp(searchQuery, 'i');
    
    let results = {
      projects: [],
      jobs: [],
      talents: []
    };

    // Search Projects
    if (!type || type === 'projects' || type === 'all') {
      const projects = await Project.find({
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { category: searchRegex },
          { skills: { $in: [searchRegex] } }
        ]
      })
      .select('title description category budgetType minBudget maxBudget skills employerSnapshot')
      .limit(10)
      .sort({ createdAt: -1 });

      results.projects = projects.map(p => ({
        id: p._id,
        title: p.title,
        description: p.description?.substring(0, 100),
        category: p.category,
        budget: p.budgetType === 'FIXED' 
          ? `$${p.minBudget} - $${p.maxBudget}`
          : `$${p.minBudget}/hr - $${p.maxBudget}/hr`,
        skills: p.skills?.slice(0, 3),
        companyName: p.employerSnapshot?.companyName || 'Company',
        type: 'project'
      }));
    }

    // Search Jobs
    if (!type || type === 'jobs' || type === 'all') {
      const jobs = await JobPost.find({
        $or: [
          { title: searchRegex },
          { company: searchRegex },
          { about: searchRegex },
          { requirements: searchRegex },
          { qualifications: searchRegex }
        ]
      })
      .select('title company workplace location type about employerSnapshot urgency')
      .limit(10)
      .sort({ postedDate: -1 });

      results.jobs = jobs.map(j => ({
        id: j._id,
        title: j.title,
        company: j.company,
        workplace: j.workplace,
        location: j.location,
        type: j.type,
        description: j.about?.substring(0, 100),
        urgency: j.urgency,
        companyName: j.employerSnapshot?.companyName || j.company,
        type: 'job'
      }));
    }

    // Search Talents (Employees)
    if (!type || type === 'talents' || type === 'all') {
      const talents = await User.find({
        role: 'employee',
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { 'employeeProfile.title': searchRegex },
          { 'employeeProfile.skills': { $in: [searchRegex] } },
          { 'employeeProfile.bio': searchRegex }
        ]
      })
      .select('firstName lastName employeeProfile')
      .limit(10);

      results.talents = talents.map(t => ({
        id: t._id,
        name: `${t.firstName} ${t.lastName}`.trim(),
        title: t.employeeProfile?.title || 'Professional',
        skills: t.employeeProfile?.skills?.slice(0, 3) || [],
        hourlyRate: t.employeeProfile?.hourlyRate 
          ? `$${t.employeeProfile.hourlyRate}/hr` 
          : 'Not specified',
        rating: t.employeeProfile?.rating || 0,
        photoUrl: t.employeeProfile?.photoUrl || '',
        type: 'talent'
      }));
    }

    return res.status(200).json({
      success: true,
      query: searchQuery,
      results
    });

  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== SEARCH BY TYPE ====================
exports.searchByType = async (req, res) => {
  try {
    const { type } = req.params;
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const searchQuery = q.trim();
    const searchRegex = new RegExp(searchQuery, 'i');
    
    let results = [];

    switch(type) {
      case 'projects':
        results = await Project.find({
          $or: [
            { title: searchRegex },
            { description: searchRegex },
            { category: searchRegex },
            { skills: { $in: [searchRegex] } }
          ]
        })
        .select('title description category budgetType minBudget maxBudget skills employerSnapshot')
        .limit(20)
        .sort({ createdAt: -1 });
        break;

      case 'jobs':
        results = await JobPost.find({
          $or: [
            { title: searchRegex },
            { company: searchRegex },
            { about: searchRegex },
            { requirements: searchRegex }
          ]
        })
        .select('title company workplace location type about employerSnapshot urgency')
        .limit(20)
        .sort({ postedDate: -1 });
        break;

      case 'talents':
        results = await User.find({
          role: 'employee',
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { 'employeeProfile.title': searchRegex },
            { 'employeeProfile.skills': { $in: [searchRegex] } }
          ]
        })
        .select('firstName lastName employeeProfile')
        .limit(20);
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid search type'
        });
    }

    return res.status(200).json({
      success: true,
      type,
      query: searchQuery,
      count: results.length,
      results
    });

  } catch (error) {
    console.error('Search by type error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== SUGGESTIONS ====================
exports.getSuggestions = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 1) {
      return res.json({ suggestions: [] });
    }

    const searchQuery = q.trim();
    const searchRegex = new RegExp(searchQuery, 'i');
    
    const [projectTitles, jobTitles, talentNames, skills] = await Promise.all([
      Project.find({ title: searchRegex }).distinct('title').limit(5),
      JobPost.find({ title: searchRegex }).distinct('title').limit(5),
      User.find({ 
        role: 'employee',
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex }
        ]
      }).limit(5).select('firstName lastName'),
      Project.find({ skills: { $in: [searchRegex] } }).distinct('skills').limit(5)
    ]);

    const suggestions = [
      ...projectTitles.map(t => ({ text: t, type: 'project' })),
      ...jobTitles.map(t => ({ text: t, type: 'job' })),
      ...talentNames.map(t => ({ 
        text: `${t.firstName} ${t.lastName}`.trim(), 
        type: 'talent' 
      })),
      ...skills.filter(s => s).map(s => ({ text: s, type: 'skill' }))
    ];

    return res.json({
      success: true,
      suggestions: suggestions.slice(0, 10)
    });

  } catch (error) {
    console.error('Suggestions error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};