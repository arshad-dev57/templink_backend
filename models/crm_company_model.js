const mongoose = require("mongoose");

const CrmCompanySchema = new mongoose.Schema(
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
    companyId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
      default: "",
    },
    industry: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    annualRevenue: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    employeeCount: {
      type: String,
      default: "1-10",
    },
    type: {
      type: String,
      enum: ["prospect", "customer", "partner", "vendor", "reseller", "other"],
      default: "prospect",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "churned"],
      default: "active",
      index: true,
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

CrmCompanySchema.index({ employerId: 1, name: 1 });
CrmCompanySchema.index({ employerId: 1, companyId: 1 }, { unique: true });

module.exports = mongoose.model("CrmCompany", CrmCompanySchema);
