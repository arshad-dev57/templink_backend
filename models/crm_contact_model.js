const mongoose = require("mongoose");

const CrmContactSchema = new mongoose.Schema(
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
      type: mongoose.Schema.Types.ObjectId,
      ref: "CrmCompany",
      default: null,
      index: true,
    },
    contactId: {
      type: String,
      required: true,
      index: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    mobilePhone: {
      type: String,
      trim: true,
      default: "",
    },
    jobTitle: {
      type: String,
      default: "",
    },
    department: {
      type: String,
      default: "",
    },
    lifecycleStage: {
      type: String,
      enum: [
        "lead",
        "subscriber",
        "marketing_qualified",
        "sales_qualified",
        "opportunity",
        "customer",
        "evangelist",
        "other",
      ],
      default: "lead",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CrmLead",
      default: null,
    },
    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      country: { type: String, default: "" },
      zipCode: { type: String, default: "" },
    },
    linkedin: {
      type: String,
      default: "",
    },
    notes: {
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

CrmContactSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

CrmContactSchema.index({ employerId: 1, email: 1 });
CrmContactSchema.index({ employerId: 1, contactId: 1 }, { unique: true });

module.exports = mongoose.model("CrmContact", CrmContactSchema);
