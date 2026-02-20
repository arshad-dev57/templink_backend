// models/Resume.js
const mongoose = require('mongoose');

const ExperienceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  company: { type: String, required: true },
  location: String,
  startDate: Date,
  endDate: Date,
  current: { type: Boolean, default: false },
  description: String,
  achievements: [String]
});

const EducationSchema = new mongoose.Schema({
  degree: { type: String, required: true },
  field: { type: String, required: true },
  institution: { type: String, required: true },
  location: String,
  startDate: Date,
  endDate: Date,
  current: { type: Boolean, default: false },
  grade: String,
  description: String
});

const SkillSchema = new mongoose.Schema({
  name: { type: String, required: true },
  level: { 
    type: String, 
    enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
    default: 'Beginner'
  },
  yearsOfExperience: Number
});

const ProjectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  technologies: [String],
  link: String,
  startDate: Date,
  endDate: Date,
  achievements: [String]
});

const CertificationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  issuer: String,
  date: Date,
  link: String,
  expires: Date
});

const LanguageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  proficiency: { 
    type: String, 
    enum: ['Basic', 'Conversational', 'Professional', 'Native'],
    default: 'Basic'
  }
});

const ResumeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    default: 'My Resume'
  },
  status: {
    type: String,
    enum: ['draft', 'complete', 'ai_enhanced'],
    default: 'draft'
  },
  
  // Personal Information
  personalInfo: {
    firstName: String,
    lastName: String,
    title: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    country: String,
    linkedin: String,
    github: String,
    portfolio: String,
    summary: String,
    photo: String
  },
  
  // Sections
  experiences: [ExperienceSchema],
  education: [EducationSchema],
  skills: [SkillSchema],
  projects: [ProjectSchema],
  certifications: [CertificationSchema],
  languages: [LanguageSchema],
  
  // Metadata
  completionPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  lastAIOptimized: Date,
  
}, { timestamps: true });

// Calculate completion percentage before saving
ResumeSchema.pre('save', function(next) {
  let totalFields = 0;
  let filledFields = 0;
  
  // Check personal info
  if (this.personalInfo) {
    const personalFields = ['firstName', 'lastName', 'email', 'phone', 'summary'];
    personalFields.forEach(field => {
      totalFields++;
      if (this.personalInfo[field]) filledFields++;
    });
  }
  
  // Check experiences
  totalFields += 5; // At least one experience
  if (this.experiences.length > 0) filledFields += 5;
  
  // Check education
  totalFields += 5;
  if (this.education.length > 0) filledFields += 5;
  
  // Check skills
  totalFields += 5;
  if (this.skills.length > 0) filledFields += 5;
  
  this.completionPercentage = Math.min(100, Math.round((filledFields / totalFields) * 100));
  
  next();
});

module.exports = mongoose.model('Resume', ResumeSchema);