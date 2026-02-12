const mongoose = require('mongoose');

const EmployerSnapshotSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },

    // from User
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    email: { type: String, default: "" },
    country: { type: String, default: "" },

    // from employerProfile
    companyName: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
    industry: { type: String, default: "" },
    city: { type: String, default: "" },
    employerCountry: { type: String, default: "" },
    companySize: { type: String, default: "" },
    workModel: { type: String, default: "" },

    phone: { type: String, default: "" },
    companyEmail: { type: String, default: "" },
    website: { type: String, default: "" },
    linkedin: { type: String, default: "" },

    about: { type: String, default: "" },
    mission: { type: String, default: "" },

    cultureTags: { type: [String], default: [] },
    teamMembers: { type: [Object], default: [] },

    isVerifiedEmployer: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
    sizeLabel: { type: String, default: "" },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    duration: { type: String, required: true },
    experienceLevel: { type: String, required: true },
    budgetType: { type: String, enum: ['FIXED', 'HOURLY'], required: true },
    minBudget: { type: Number, required: true },
    maxBudget: { type: Number, required: true },
    skills: { type: [String], required: true },
    deliverables: { type: [String], required: true },

    media: [
      {
        fileName: { type: String, required: true },
        fileUrl: { type: String, required: true },
        fileType: { type: String, required: true },
        publicId: { type: String },
      },
    ],

   
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // ✅ snapshot of employer at post time
    employerSnapshot: { type: EmployerSnapshotSchema, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Project', projectSchema);