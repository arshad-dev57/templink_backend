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

const jobPostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  company: { type: String,  },
  workplace: { type: String, enum: ['Onsite', 'Hybrid', 'Remote'], required: true },
  location: { type: String, required: true },
  type: {
    type: String,
    enum: ['Full Time', 'Part Time', 'Contract', 'Temporary', 'Internship', 'Other'],
    required: true,
  },
  about: { type: String, required: true },
  requirements: { type: String, required: true },
  qualifications: { type: String, required: true },
  images: [{ type: String }],

  // ✅ Reference
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // ✅ Snapshot (employer data saved inside job post)
  employerSnapshot: { type: EmployerSnapshotSchema, required: true },

  postedDate: { type: Date, default: Date.now },
});

module.exports = mongoose.model('JobPost', jobPostSchema);