const mongoose = require("mongoose");

const PipelineStageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    order: { type: Number, required: true },
    probability: { type: Number, default: 20 },
    color: { type: String, default: "#3B82F6" },
  },
  { _id: false }
);

const EmployeePermissionSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    canViewAllLeads: { type: Boolean, default: false },
    canCreateLeads: { type: Boolean, default: true },
    canEditLeads: { type: Boolean, default: true },
    canDeleteLeads: { type: Boolean, default: false },
    canViewDeals: { type: Boolean, default: true },
    canManageDeals: { type: Boolean, default: true },
    canViewReports: { type: Boolean, default: false },
    canManageSettings: { type: Boolean, default: false },
    canManageProducts: { type: Boolean, default: false },
    canManageQuotations: { type: Boolean, default: true },
  },
  { _id: false }
);

const CrmSettingSchema = new mongoose.Schema(
  {
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    defaultCurrency: {
      type: String,
      default: "USD",
    },
    pipelineStages: {
      type: [PipelineStageSchema],
      default: [
        { id: "lead_in", name: "Lead In", order: 1, probability: 10, color: "#64748B" },
        { id: "contact_made", name: "Contact Made", order: 2, probability: 25, color: "#3B82F6" },
        { id: "needs_discovery", name: "Needs Discovery", order: 3, probability: 40, color: "#8B5CF6" },
        { id: "proposal_sent", name: "Proposal Sent", order: 4, probability: 65, color: "#F59E0B" },
        { id: "negotiation", name: "Negotiation", order: 5, probability: 80, color: "#EC4899" },
        { id: "closed_won", name: "Closed Won", order: 6, probability: 100, color: "#10B981" },
        { id: "closed_lost", name: "Closed Lost", order: 7, probability: 0, color: "#EF4444" },
      ],
    },
    leadSources: {
      type: [String],
      default: [
        "website",
        "referral",
        "linkedin",
        "cold_outreach",
        "advertisement",
        "event",
        "partner",
        "other",
      ],
    },
    industries: {
      type: [String],
      default: [
        "Technology & Software",
        "Healthcare",
        "Finance & Banking",
        "E-Commerce & Retail",
        "Real Estate",
        "Manufacturing",
        "Consulting & Professional Services",
        "Education",
        "Marketing & Advertising",
        "Other",
      ],
    },
    employeePermissions: {
      type: [EmployeePermissionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("CrmSetting", CrmSettingSchema);
