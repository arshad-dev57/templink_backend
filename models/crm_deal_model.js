const mongoose = require("mongoose");

const DealProductSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CrmProduct",
      default: null,
    },
    name: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);

const CrmDealSchema = new mongoose.Schema(
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
    dealId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CrmCompany",
      default: null,
      index: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CrmContact",
      default: null,
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CrmLead",
      default: null,
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    stage: {
      type: String,
      required: true,
      default: "lead_in",
      index: true,
    },
    pipelineId: {
      type: String,
      default: "default_pipeline",
      index: true,
    },
    probability: {
      type: Number,
      min: 0,
      max: 100,
      default: 20,
    },
    expectedCloseDate: {
      type: Date,
      default: null,
    },
    actualCloseDate: {
      type: Date,
      default: null,
    },
    leadSource: {
      type: String,
      default: "",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    wonReason: {
      type: String,
      default: "",
    },
    lostReason: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    products: {
      type: [DealProductSchema],
      default: [],
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

CrmDealSchema.virtual("weightedValue").get(function () {
  return ((this.amount || 0) * (this.probability || 0)) / 100;
});

CrmDealSchema.index({ employerId: 1, stage: 1 });
CrmDealSchema.index({ employerId: 1, assignedTo: 1, stage: 1 });
CrmDealSchema.index({ employerId: 1, dealId: 1 }, { unique: true });

module.exports = mongoose.model("CrmDeal", CrmDealSchema);
