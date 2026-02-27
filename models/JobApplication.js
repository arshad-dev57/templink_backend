const mongoose = require('mongoose');

const JobApplicationSchema = new mongoose.Schema({
  // ============== BASIC RELATIONSHIPS ==============
  jobId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'JobPost', 
    required: true 
  },
  
  employeeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  employerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // ============== RESUME FIELDS ==============
  resumeFileName: { 
    type: String, 
    required: true 
  },
  
  resumeFileUrl: { 
    type: String, 
    required: true 
  },
  
  resumeCloudinaryPublicId: { 
    type: String 
  },
  
  resumeFileSize: { 
    type: Number 
  },
  
  // ============== EMPLOYMENT STATUS & PROTECTION ==============
  employmentStatus: {
    type: String,
    enum: ['active', 'left', 'terminated'],
    default: 'active'
  },
  
  leftAt: {
    type: Date
  },
  
  leftReason: {
    type: String,
    default: ''
  },
  
  protectionEligible: {
    type: Boolean,
    default: false
  },
  
  // ============== HIRING & COMMISSION DETAILS ==============
  hiredAt: {
    type: Date
  },
  
  hiringCommission: {
    salaryAmount: {
      type: Number,
      default: 0
    },
    commissionAmount: {
      type: Number,
      default: 0
    },
    commissionRate: {
      type: Number,
      default: 20  // 20% default
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'free_hire_protection', 'failed'],
      default: 'pending'
    },
    paidAt: {
      type: Date
    },
    paymentId: {
      type: String  // Stripe payment intent ID
    },
    isFreeHire: {
      type: Boolean,
      default: false
    },
    stripeMetadata: {
      type: mongoose.Schema.Types.Mixed  // Store additional Stripe data
    }
  },
  
  // ============== EMPLOYEE SNAPSHOT (AT APPLICATION TIME) ==============
  employeeSnapshot: {
    // Basic Info
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    country: { type: String, required: true },
    
    // Professional Info
    title: { type: String, default: '' },
    experienceLevel: { type: String, default: '' },
    category: { type: String, default: '' },
    skills: [{ type: String }],
    hourlyRate: { type: String, default: '' },
    photoUrl: { type: String, default: '' },
    bio: { type: String, default: '' },
    
    // Experience History
    recentExperiences: [{
      title: { type: String },
      company: { type: String },
      startYear: { type: String },
      endYear: { type: String },
      description: { type: String }
    }],
    
    // Education
    recentEducation: {
      degree: { type: String },
      school: { type: String },
      field: { type: String },
      graduationYear: { type: String }
    },
    
    // Ratings
    rating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    
    // Contact (optional)
    phone: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    portfolio: { type: String, default: '' }
  },
  
  // ============== JOB SNAPSHOT (AT APPLICATION TIME) ==============
  jobSnapshot: {
    // Basic Job Info
    title: { type: String, required: true },
    company: { type: String, default: '' },
    workplace: { 
      type: String, 
      enum: ['Onsite', 'Hybrid', 'Remote'],
      default: 'Onsite'
    },
    location: { type: String, required: true },
    type: { type: String, required: true }, // Full-time, Part-time, etc.
    
    // Job Details
    about: { type: String, required: true },
    requirements: { type: String, required: true },
    qualifications: { type: String, required: true },
    responsibilities: { type: String, default: '' },
    
    // Salary
    salaryAmount: { type: Number, default: 0 },
    salaryCurrency: { type: String, default: 'USD' },
    salaryPeriod: { 
      type: String, 
      enum: ['hourly', 'monthly', 'yearly'],
      default: 'monthly'
    },
    
    // Dates
    postedDate: { type: Date },
    applicationDeadline: { type: Date },
    
    // Category
    category: { type: String, default: '' },
    subCategory: { type: String, default: '' },
    
    // Benefits
    benefits: [{ type: String }]
  },
  
  // ============== EMPLOYER SNAPSHOT ==============
  employerSnapshot: {
    companyName: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
    industry: { type: String, default: '' },
    city: { type: String, default: '' },
    country: { type: String, default: '' },
    companySize: { type: String, default: '' },
    foundedYear: { type: String, default: '' },
    website: { type: String, default: '' },
    description: { type: String, default: '' }
  },
  
  // ============== APPLICATION DETAILS ==============
  coverLetter: { 
    type: String, 
    default: '' 
  },
  
  additionalDocuments: [{
    fileName: String,
    fileUrl: String,
    fileType: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  // ============== APPLICATION STATUS & TRACKING ==============
  status: { 
    type: String, 
    enum: ['pending', 'reviewed', 'shortlisted', 'rejected', 'hired'],
    default: 'pending'
  },
  
  employerNotes: { 
    type: String, 
    default: '' 
  },
  
  reviewedAt: { 
    type: Date 
  },
  
  shortlistedAt: {
    type: Date
  },
  
  rejectedAt: {
    type: Date
  },
  
  rejectionReason: {
    type: String,
    default: ''
  },
  
  // ============== INTERVIEW DETAILS (if applicable) ==============
  interviewDetails: {
    scheduledAt: Date,
    interviewDate: Date,
    interviewType: {
      type: String,
      enum: ['online', 'phone', 'in-person'],
    },
    meetingLink: String,
    location: String,
    interviewerName: String,
    interviewerEmail: String,
    notes: String,
    feedback: String,
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'],
    }
  },
  
  // ============== TIMESTAMPS ==============
  appliedAt: { 
    type: Date, 
    default: Date.now 
  },
  
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
  
  // ============== METADATA ==============
  metadata: {
    ipAddress: String,
    userAgent: String,
    referrer: String,
    source: {
      type: String,
      enum: ['direct', 'search', 'referral', 'social', 'email'],
      default: 'direct'
    }
  },
  
  // ============== ARCHIVE FLAG ==============
  isArchived: {
    type: Boolean,
    default: false
  },
  
  archivedAt: Date,
  
  archivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true  // This will automatically add createdAt and updatedAt
});

// ============== INDEXES FOR PERFORMANCE ==============
// Unique index to prevent duplicate applications
JobApplicationSchema.index({ jobId: 1, employeeId: 1 }, { unique: true });

// Index for employer queries
JobApplicationSchema.index({ employerId: 1, status: 1, appliedAt: -1 });

// Index for employee queries
JobApplicationSchema.index({ employeeId: 1, appliedAt: -1 });

// Index for status filtering
JobApplicationSchema.index({ status: 1, appliedAt: -1 });

// Index for employment status
JobApplicationSchema.index({ employmentStatus: 1, hiredAt: -1 });

// Index for commission queries
JobApplicationSchema.index({ 'hiringCommission.paymentStatus': 1 });

// Index for date range queries
JobApplicationSchema.index({ appliedAt: -1 });
JobApplicationSchema.index({ hiredAt: -1 });
JobApplicationSchema.index({ leftAt: -1 });

// ============== VIRTUAL PROPERTIES ==============
// Get full name of employee
JobApplicationSchema.virtual('employeeFullName').get(function() {
  return `${this.employeeSnapshot.firstName} ${this.employeeSnapshot.lastName}`;
});

// Get days since applied
JobApplicationSchema.virtual('daysSinceApplied').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.appliedAt);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Get days worked (if hired and left)
JobApplicationSchema.virtual('daysWorked').get(function() {
  if (!this.hiredAt) return 0;
  const endDate = this.leftAt || new Date();
  const diffTime = Math.abs(endDate - this.hiredAt);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Check if within protection period
JobApplicationSchema.virtual('isWithinProtectionPeriod').get(function() {
  if (!this.leftAt || !this.hiredAt) return false;
  const daysWorked = this.daysWorked;
  return daysWorked <= 30;
});

// ============== MIDDLEWARE ==============
// Update timestamp on save
JobApplicationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Set protectionEligible when employee leaves within 30 days
JobApplicationSchema.pre('save', function(next) {
  if (this.isModified('employmentStatus') && this.employmentStatus === 'left') {
    if (this.hiredAt) {
      const daysWorked = Math.ceil(
        (this.leftAt - this.hiredAt) / (1000 * 60 * 60 * 24)
      );
      this.protectionEligible = daysWorked <= 30;
    }
  }
  next();
});

// ============== INSTANCE METHODS ==============
// Mark as hired
JobApplicationSchema.methods.markAsHired = async function(commissionData = {}) {
  this.status = 'hired';
  this.hiredAt = new Date();
  this.employmentStatus = 'active';
  
  this.hiringCommission = {
    salaryAmount: commissionData.salaryAmount || 0,
    commissionAmount: commissionData.commissionAmount || 0,
    commissionRate: commissionData.commissionRate || 20,
    paymentStatus: commissionData.paymentStatus || 'paid',
    paidAt: commissionData.paidAt || new Date(),
    paymentId: commissionData.paymentId,
    isFreeHire: commissionData.isFreeHire || false
  };
  
  return this.save();
};

// Mark as left
JobApplicationSchema.methods.markAsLeft = async function(reason = '') {
  this.employmentStatus = 'left';
  this.leftAt = new Date();
  this.leftReason = reason;
  
  // Check if within 30 days for protection
  if (this.hiredAt) {
    const daysWorked = Math.ceil(
      (this.leftAt - this.hiredAt) / (1000 * 60 * 60 * 24)
    );
    this.protectionEligible = daysWorked <= 30;
  }
  
  return this.save();
};

// Get application timeline
JobApplicationSchema.methods.getTimeline = function() {
  return {
    applied: this.appliedAt,
    reviewed: this.reviewedAt,
    shortlisted: this.shortlistedAt,
    hired: this.hiredAt,
    left: this.leftAt,
    currentStatus: this.status,
    employmentStatus: this.employmentStatus
  };
};

// ============== STATIC METHODS ==============
// Get applications by employer with filters
JobApplicationSchema.statics.getEmployerApplications = async function(employerId, filters = {}) {
  const query = { employerId };
  
  if (filters.status) query.status = filters.status;
  if (filters.employmentStatus) query.employmentStatus = filters.employmentStatus;
  
  return this.find(query)
    .populate('jobId', 'title location')
    .sort(filters.sortBy || { appliedAt: -1 })
    .limit(filters.limit || 50)
    .skip(filters.skip || 0);
};

// Get active hired employees
JobApplicationSchema.statics.getActiveHires = async function(employerId) {
  return this.find({
    employerId,
    status: 'hired',
    employmentStatus: 'active'
  }).populate('employeeId', 'firstName lastName email');
};

// Get commission summary
JobApplicationSchema.statics.getCommissionSummary = async function(employerId) {
  const applications = await this.find({
    employerId,
    status: 'hired',
    'hiringCommission.paymentStatus': 'paid'
  });
  
  const totalCommission = applications.reduce((sum, app) => {
    return sum + (app.hiringCommission?.commissionAmount || 0);
  }, 0);
  
  const freeHires = applications.filter(app => app.hiringCommission?.isFreeHire).length;
  
  return {
    totalApplications: applications.length,
    totalCommission: totalCommission / 100, // Convert from cents
    freeHires,
    paidHires: applications.length - freeHires
  };
};

// Get protection eligible jobs
JobApplicationSchema.statics.getProtectionEligible = async function() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return this.find({
    employmentStatus: 'left',
    leftAt: { $gte: thirtyDaysAgo },
    protectionEligible: true
  }).populate('jobId');
};

// ============== AGGREGATION PIPELINES ==============
// Get monthly hire statistics
JobApplicationSchema.statics.getMonthlyHireStats = async function(employerId, year) {
  return this.aggregate([
    {
      $match: {
        employerId: mongoose.Types.ObjectId(employerId),
        status: 'hired',
        hiredAt: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`)
        }
      }
    },
    {
      $group: {
        _id: { $month: '$hiredAt' },
        count: { $sum: 1 },
        totalCommission: { $sum: '$hiringCommission.commissionAmount' }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
};
module.exports = mongoose.model('JobApplication', JobApplicationSchema);