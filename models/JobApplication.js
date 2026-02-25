const mongoose = require('mongoose');

const JobApplicationSchema = new mongoose.Schema({
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
  
  // 👇 YAHAN PE YE FIELDS ADD KARO (RESUME FIELDS)
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
  // 👆 YAHAN TAK ADD KARO
  
  // Employee ka snapshot (jo apply kar raha hai)
  employeeSnapshot: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    country: { type: String, required: true },
    
    title: { type: String, default: '' },
    experienceLevel: { type: String, default: '' },
    category: { type: String, default: '' },
    skills: [{ type: String }],
    hourlyRate: { type: String, default: '' },
    photoUrl: { type: String, default: '' },
    bio: { type: String, default: '' },
    
    recentExperiences: [{
      title: String,
      company: String,
      startYear: String,
      endYear: String
    }],
    
    recentEducation: {
      degree: String,
      school: String,
      field: String
    },
    
    rating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 }
  },
  
  // Job ka snapshot
  jobSnapshot: {
    title: { type: String, required: true },
    company: { type: String, default: '' },
    workplace: { type: String, enum: ['Onsite', 'Hybrid', 'Remote'] },
    location: { type: String, required: true },
    type: { type: String, required: true },
    about: { type: String, required: true },
    requirements: { type: String, required: true },
    qualifications: { type: String, required: true },
    postedDate: { type: Date }
  },
  
  // Employer ka snapshot
  employerSnapshot: {
    companyName: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
    industry: { type: String, default: '' },
    city: { type: String, default: '' },
    country: { type: String, default: '' }
  },
  
  // Application Status
  status: { 
    type: String, 
    enum: ['pending', 'reviewed', 'shortlisted', 'rejected', 'hired'],
    default: 'pending'
  },
  
  employerNotes: { type: String, default: '' },
  reviewedAt: { type: Date },
  
  coverLetter: { type: String, default: '' },
  
  appliedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes
JobApplicationSchema.index({ jobId: 1, employeeId: 1 }, { unique: true });
JobApplicationSchema.index({ employerId: 1, status: 1 });
JobApplicationSchema.index({ employeeId: 1, appliedAt: -1 });

// Update timestamp
JobApplicationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('JobApplication', JobApplicationSchema);