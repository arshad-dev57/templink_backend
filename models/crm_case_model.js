const mongoose = require("mongoose");

const CrmCaseSchema = new mongoose.Schema(
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
    caseId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CrmContact",
      default: null,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CrmCompany",
      default: null,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "waiting_customer", "resolved", "closed"],
      default: "open",
      index: true,
    },
    type: {
      type: String,
      enum: ["question", "problem", "incident", "feature_request", "billing"],
      default: "problem",
    },
    resolution: {
      type: String,
      default: "",
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

CrmCaseSchema.index({ employerId: 1, caseId: 1 }, { unique: true });
CrmCaseSchema.index({ employerId: 1, status: 1 });

module.exports = mongoose.model("CrmCase", CrmCaseSchema);
