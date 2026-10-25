const mongoose = require("mongoose");

const CrmLeadSchema = new mongoose.Schema(
  {
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    leadId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    company: {
      type: String,
      trim: true,
      default: "",
    },
    jobTitle: {
      type: String,
      trim: true,
      default: "",
    },
    leadSource: {
      type: String,
      enum: [
        "website",
        "referral",
        "linkedin",
        "cold_outreach",
        "advertisement",
        "event",
        "partner",
        "other",
      ],
      default: "website",
    },
    status: {
      type: String,
      enum: [
        "new",
        "contacted",
        "qualified",
        "proposal_sent",
        "negotiation",
        "converted",
        "lost",
        "unqualified",
      ],
      default: "new",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    industry: {
      type: String,
      default: "",
    },
    estimatedDealValue: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    expectedClosingDate: {
      type: Date,
      default: null,
    },
    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      country: { type: String, default: "" },
      zipCode: { type: String, default: "" },
    },
    description: {
      type: String,
      default: "",
    },
    tags: {
      type: [String],
      default: [],
    },
    isConverted: {
      type: Boolean,
      default: false,
      index: true,
    },
    convertedAt: {
      type: Date,
      default: null,
    },
    convertedContactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CrmContact",
      default: null,
    },
    convertedCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CrmCompany",
      default: null,
    },
    convertedDealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CrmDeal",
      default: null,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

CrmLeadSchema.index({ employerId: 1, createdAt: -1 });
CrmLeadSchema.index({ employerId: 1, assignedTo: 1, status: 1 });
CrmLeadSchema.index({ employerId: 1, leadId: 1 }, { unique: true });

module.exports = mongoose.model("CrmLead", CrmLeadSchema);
