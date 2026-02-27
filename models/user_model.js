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
  Employer Schema (COMPLETE)
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
    
    // ✅ TEAM MEMBERS - Current and Past Employees
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
    
    // Stats
    totalHires: { type: Number, default: 0 },
    activeEmployees: { type: Number, default: 0 }
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
        status: { type: String, enum: ['active', 'left'] }
      }
    ]
  },
  { timestamps: true }
);

UserSchema.set("toJSON", {
  transform: function (doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

module.exports = mongoose.model("User", UserSchema);  