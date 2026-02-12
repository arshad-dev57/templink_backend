const mongoose = require("mongoose");

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

const EmployeeProfileSchema = new mongoose.Schema(
  {
    experienceLevel: { type: String, enum: ["new", "some", "expert", ""], default: "" },
    goal: { type: String, enum: ["money", "experience", "no_goal", ""], default: "" },
    category: { type: String, default: "" },
    subcategory: { type: String, default: "" },
    skills: { type: [String], default: [] },
    title: { type: String, default: "" },
    workExperiences: { type: [WorkExperienceSchema], default: [] },
    educations: { type: [EducationSchema], default: [] },
    bio: { type: String, default: "" },
    hourlyRate: { type: String, default: "" },
    photoUrl: { type: String, default: "" },
    dateOfBirth: { type: String, default: "" },
    streetAddress: { type: String, default: "" },
    city: { type: String, default: "" },
    province: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },
  },
  { _id: false }
);

const TeamMemberSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    role: { type: String, trim: true },
    email: { type: String, trim: true },
  },
  { _id: false }
);

const EmployerProfileSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
    industry: { type: String, default: "" },
    city: { type: String, default: "" },
    country: { type: String, default: "" }, // register screen se set
    companySize: { type: String, default: "" },
    workModel: { type: String, enum: ["Remote", "Onsite", "Hybrid", ""], default: "" },

    phone: { type: String, default: "" },
    companyEmail: { type: String, default: "" },
    website: { type: String, default: "" },
    linkedin: { type: String, default: "" },

    about: { type: String, default: "" },
    mission: { type: String, default: "" },

    cultureTags: { type: [String], default: [] },
    teamMembers: { type: [TeamMemberSchema], default: [] },

    isVerifiedEmployer: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
    sizeLabel: { type: String, default: "" }, // optional: "250+" etc
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["employee", "employer"], required: true },

    firstName: { type: String, trim: true, required: true },
    lastName: { type: String, trim: true, required: true },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      unique: true,
      index: true,
    },
    passwordHash: { type: String, required: true },

    country: { type: String, required: true }, // register screen country
    sendEmails: { type: Boolean, default: false },
    termsAccepted: { type: Boolean, default: false },
    termsAcceptedAt: { type: Date },

    status: { type: String, enum: ["active", "blocked"], default: "active" },

    employeeProfile: { type: EmployeeProfileSchema, default: () => ({}) },
    employerProfile: { type: EmployerProfileSchema, default: () => ({}) },

    // ✅ LinkedIn integration (ADDED)
    linkedinConnected: { type: Boolean, default: false },
    linkedinAccessToken: { type: String, default: "" },
    linkedinTokenCreatedAt: { type: Date },
  },
  { timestamps: true }
);

// Hide passwordHash in responses
UserSchema.set("toJSON", {
  transform: function (doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

module.exports = mongoose.model("User", UserSchema);