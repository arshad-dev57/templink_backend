const mongoose = require("mongoose");

/* ===========================
  Employee Sub Schemas
=========================== */

const WorkExperienceSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    company: { type: String, trim: true },
    location: { type: String, trim: true },
    country: { type: String, trim: true },
    startYear: { type: String, trim: true },
    endYear: { type: String, trim: true },
    currentlyWorking: { type: Boolean, default: false },
    description: { type: String, trim: true },
  },
  { _id: false }
);

const EducationSchema = new mongoose.Schema(
  {
    school: { type: String, trim: true },
    degree: { type: String, trim: true },
    field: { type: String, trim: true },
    startYear: { type: String, trim: true },
    endYear: { type: String, trim: true },
    currentlyAttending: { type: Boolean, default: false },
    description: { type: String, trim: true },
  },
  { _id: false }
);

const PortfolioProjectSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    imageUrl: { type: String, default: "" },
    category: { type: String, default: "" },
    completionDate: { type: String, default: "" },
    clientName: { type: String, default: "" },
    projectUrl: { type: String, default: "" },
  },
  { _id: false }
);

const EmployeeProfileSchema = new mongoose.Schema(
  {
    experienceLevel: { type: String, default: "" },
    category: { type: String, default: "" },
    skills: { type: [String], default: [] },
    title: { type: String, default: "" },
    workExperiences: { type: [WorkExperienceSchema], default: [] },
    educations: { type: [EducationSchema], default: [] },
    bio: { type: String, default: "" },
    hourlyRate: { type: String, default: "" },
    photoUrl: { type: String, default: "" },

    portfolioProjects: { 
      type: [PortfolioProjectSchema], 
      default: [] 
    },

    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
  },
  { _id: false }
);

/* ===========================
  Employer Schema (COMPLETE with Protection)
=========================== */

const EmployerProfileSchema = new mongoose.Schema(
  {
    // Basic Info
    companyName: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
    industry: { type: String, default: "" },
    city: { type: String, default: "" },
    country: { type: String, default: "" },
    companySize: { type: String, default: "" },
    workModel: { type: String, default: "" },         
    phone: { type: String, default: "" },             
    companyEmail: { type: String, default: "" },      
    website: { type: String, default: "" },           
    linkedin: { type: String, default: "" },          
    about: { type: String, default: "" },             
    mission: { type: String, default: "" },           
    cultureTags: { type: [String], default: [] },     
    isVerifiedEmployer: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
    
    // ============== TEAM MEMBERS ==============
    teamMembers: [
      {
        employeeId: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'User' 
        },
        jobId: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'JobPost' 
        },
        applicationId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'JobApplication'
        },
        jobTitle: { type: String },
        hiredAt: { type: Date },
        status: {
          type: String,
          enum: ['active', 'left', 'terminated'],
          default: 'active'
        },
        leftAt: Date,
        leftReason: String,
        commissionPaid: Number,
        isFreeHire: { type: Boolean, default: false }
      }
    ],

    
    protection: {
      isActive: { type: Boolean, default: false },
      expiryDate: Date,
      remainingHires: { type: Number, default: 0 }, // Kitni free hires available
      totalFreeHires: { type: Number, default: 0 }, // Total free hires granted
      originalEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      originalJobId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobPost' },
      reason: String,
      activatedAt: Date
    },
    
    // ============== PROTECTION HISTORY ==============
    protectionHistory: [
      {
        employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobPost' },
        hiredAt: Date,
        leftAt: Date,
        daysWorked: Number,
        protectionGranted: { type: Boolean, default: true },
        expiryDate: Date,
        freeHiresGranted: { type: Number, default: 1 }
      }
    ],
    
    // ============== STATS ==============
    stats: {
      totalHires: { type: Number, default: 0 },
      activeEmployees: { type: Number, default: 0 },
      totalFreeHiresUsed: { type: Number, default: 0 },
      totalCommissionPaid: { type: Number, default: 0 },
      averageEmployeeTenure: { type: Number, default: 0 } // in days
    }
  },
  { _id: false }
);

/* ===========================
  MAIN USER SCHEMA
=========================== */

const UserSchema = new mongoose.Schema(
  {
    role: { 
      type: String, 
      enum: ["employee", "employer"], 
      required: true 
    },

    firstName: { type: String, required: true },
    lastName: { type: String, required: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    passwordHash: { type: String, required: true },

    country: { type: String, required: true },

    status: { 
      type: String, 
      enum: ["active", "blocked"], 
      default: "active" 
    },

    /* POINTS WALLET */
    pointsBalance: {
      type: Number,
      default: 100,   // signup bonus
    },

    pointsHistory: [
      {
        amount: Number,
        type: { type: String, enum: ['credit', 'debit'] },
        reason: String,
        createdAt: { type: Date, default: Date.now }
      }
    ],

    employeeProfile: { 
      type: EmployeeProfileSchema, 
      default: () => ({}) 
    },

    employerProfile: { 
      type: EmployerProfileSchema, 
      default: () => ({}) 
    },
    
    // ✅ Employee ke liye - jobs where they are/were hired
    myEmployers: [
      {
        employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobPost' },
        jobTitle: String,
        hiredAt: Date,
        leftAt: Date,
        status: { type: String, enum: ['active', 'left', 'terminated'] },
        reason: String,
        rating: { type: Number, min: 0, max: 5 },
        review: String
      }
    ],

    // ✅ Notification Settings
    notificationSettings: {
      emailNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
      jobAlerts: { type: Boolean, default: true },
      messageAlerts: { type: Boolean, default: true }
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

/* ===========================
  VIRTUAL PROPERTIES
=========================== */

// Full name virtual
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Employer's active protection status
UserSchema.virtual('hasActiveProtection').get(function() {
  if (this.role !== 'employer' || !this.employerProfile?.protection) return false;
  
  const protection = this.employerProfile.protection;
  const now = new Date();
  
  return protection.isActive && protection.expiryDate > now && protection.remainingHires > 0;
});

// Protection days remaining
UserSchema.virtual('protectionDaysRemaining').get(function() {
  if (!this.hasActiveProtection) return 0;
  
  const now = new Date();
  const expiry = this.employerProfile.protection.expiryDate;
  return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
});

// Active team members count
UserSchema.virtual('activeTeamCount').get(function() {
  if (this.role !== 'employer' || !this.employerProfile?.teamMembers) return 0;
  
  return this.employerProfile.teamMembers.filter(m => m.status === 'active').length;
});

// Past team members count
UserSchema.virtual('pastTeamCount').get(function() {
  if (this.role !== 'employer' || !this.employerProfile?.teamMembers) return 0;
  
  return this.employerProfile.teamMembers.filter(m => m.status === 'left' || m.status === 'terminated').length;
});

/* ===========================
  INDEXES
=========================== */

// Unique indexes
UserSchema.index({ email: 1 }, { unique: true });

// Query indexes
UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ 'employerProfile.stats.activeEmployees': 1 });
UserSchema.index({ 'employerProfile.protection.isActive': 1, 'employerProfile.protection.expiryDate': 1 });
UserSchema.index({ createdAt: -1 });

/* ===========================
  MIDDLEWARE
=========================== */

// Auto-update employer stats when team members change
UserSchema.pre('save', function(next) {
  if (this.role === 'employer' && this.employerProfile) {
    // Update active employees count
    const activeCount = this.employerProfile.teamMembers?.filter(m => m.status === 'active').length || 0;
    
    if (!this.employerProfile.stats) {
      this.employerProfile.stats = {};
    }
    
    this.employerProfile.stats.activeEmployees = activeCount;
    this.employerProfile.stats.totalHires = this.employerProfile.teamMembers?.length || 0;
    
    // Calculate average tenure
    const leftMembers = this.employerProfile.teamMembers?.filter(m => m.leftAt) || [];
    if (leftMembers.length > 0) {
      const totalTenure = leftMembers.reduce((sum, m) => {
        const tenure = Math.ceil((m.leftAt - m.hiredAt) / (1000 * 60 * 60 * 24));
        return sum + tenure;
      }, 0);
      this.employerProfile.stats.averageEmployeeTenure = Math.round(totalTenure / leftMembers.length);
    }
  }
  next();
});

// Auto-deactivate expired protection
UserSchema.pre('save', function(next) {
  if (this.role === 'employer' && this.employerProfile?.protection) {
    const protection = this.employerProfile.protection;
    const now = new Date();
    
    if (protection.expiryDate && protection.expiryDate <= now) {
      protection.isActive = false;
      protection.remainingHires = 0;
    }
  }
  next();
});

/* ===========================
  INSTANCE METHODS
=========================== */

// Check if employer can hire for free
UserSchema.methods.canHireForFree = function() {
  if (this.role !== 'employer') return false;
  
  const protection = this.employerProfile?.protection;
  if (!protection) return false;
  
  const now = new Date();
  return protection.isActive && protection.expiryDate > now && protection.remainingHires > 0;
};

// Use a free hire
UserSchema.methods.useFreeHire = function() {
  if (!this.canHireForFree()) return false;
  
  if (!this.employerProfile.stats) {
    this.employerProfile.stats = {};
  }
  
  this.employerProfile.protection.remainingHires -= 1;
  this.employerProfile.stats.totalFreeHiresUsed = (this.employerProfile.stats.totalFreeHiresUsed || 0) + 1;
  
  if (this.employerProfile.protection.remainingHires <= 0) {
    this.employerProfile.protection.isActive = false;
  }
  
  return true;
};

// Add team member
UserSchema.methods.addTeamMember = function(memberData) {
  if (this.role !== 'employer') return false;
  
  if (!this.employerProfile.teamMembers) {
    this.employerProfile.teamMembers = [];
  }
  
  // Check if already exists
  const exists = this.employerProfile.teamMembers.some(
    m => m.employeeId && m.employeeId.toString() === memberData.employeeId.toString() && 
         m.jobId && m.jobId.toString() === memberData.jobId.toString() &&
         m.status === 'active'
  );
  
  if (!exists) {
    this.employerProfile.teamMembers.push({
      ...memberData,
      hiredAt: new Date(),
      status: 'active'
    });
    
    // Update stats
    if (!this.employerProfile.stats) {
      this.employerProfile.stats = {};
    }
    this.employerProfile.stats.totalHires = (this.employerProfile.stats.totalHires || 0) + 1;
    this.employerProfile.stats.activeEmployees = (this.employerProfile.stats.activeEmployees || 0) + 1;
    
    return true;
  }
  
  return false;
};

// Mark team member as left
UserSchema.methods.markTeamMemberLeft = function(employeeId, jobId, reason) {
  if (this.role !== 'employer') return false;
  
  const member = this.employerProfile.teamMembers?.find(
    m => m.employeeId && m.employeeId.toString() === employeeId.toString() && 
         m.jobId && m.jobId.toString() === jobId.toString() &&
         m.status === 'active'
  );
  
  if (member) {
    member.status = 'left';
    member.leftAt = new Date();
    member.leftReason = reason;
    
    // Update stats
    if (this.employerProfile.stats) {
      this.employerProfile.stats.activeEmployees = Math.max(0, (this.employerProfile.stats.activeEmployees || 1) - 1);
    }
    
    return true;
  }
  
  return false;
};

// Activate protection
UserSchema.methods.activateProtection = function(employeeId, jobId, daysWorked, reason) {
  if (this.role !== 'employer') return false;
  
  const now = new Date();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30);
  
  this.employerProfile.protection = {
    isActive: true,
    expiryDate: expiryDate,
    remainingHires: 1,
    totalFreeHires: 1,
    originalEmployeeId: employeeId,
    originalJobId: jobId,
    reason: reason || 'Employee left within 30 days',
    activatedAt: now
  };
  
  if (!this.employerProfile.protectionHistory) {
    this.employerProfile.protectionHistory = [];
  }
  
  this.employerProfile.protectionHistory.push({
    employeeId: employeeId,
    jobId: jobId,
    hiredAt: this.employerProfile.teamMembers?.find(
      m => m.employeeId && m.employeeId.toString() === employeeId.toString()
    )?.hiredAt || now,
    leftAt: now,
    daysWorked: daysWorked,
    protectionGranted: true,
    expiryDate: expiryDate,
    freeHiresGranted: 1
  });
  
  return true;
};

/* ===========================
  STATIC METHODS
=========================== */

// Find employers with active protection
UserSchema.statics.findEmployersWithActiveProtection = function() {
  const now = new Date();
  return this.find({
    role: 'employer',
    'employerProfile.protection.isActive': true,
    'employerProfile.protection.expiryDate': { $gt: now }
  });
};

// Get employer statistics
UserSchema.statics.getEmployerStats = async function(employerId) {
  const employer = await this.findById(employerId);
  if (!employer || employer.role !== 'employer') return null;
  
  return {
    totalHires: employer.employerProfile?.stats?.totalHires || 0,
    activeEmployees: employer.employerProfile?.stats?.activeEmployees || 0,
    totalFreeHiresUsed: employer.employerProfile?.stats?.totalFreeHiresUsed || 0,
    totalCommissionPaid: employer.employerProfile?.stats?.totalCommissionPaid || 0,
    averageEmployeeTenure: employer.employerProfile?.stats?.averageEmployeeTenure || 0,
    hasActiveProtection: employer.hasActiveProtection,
    protectionDaysRemaining: employer.protectionDaysRemaining,
    remainingFreeHires: employer.employerProfile?.protection?.remainingHires || 0
  };
};

/* ===========================
  JSON TRANSFORM
=========================== */

UserSchema.set("toJSON", {
  transform: function (doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

module.exports = mongoose.model("User", UserSchema);