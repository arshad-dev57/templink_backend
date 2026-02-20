const mongoose = require("mongoose");

/* ===============================
  EMPLOYER SNAPSHOT SCHEMA
=============================== */

const EmployerSnapshotSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },

    // From User
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    email: { type: String, default: "" },
    country: { type: String, default: "" },

    // From Employer Profile
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

/* ===============================
  UPDATED MILESTONE SCHEMA WITH PAYMENT INFO
=============================== */
// models/project.js - Update MilestoneSchema with setter

const MilestoneSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    dueDate: { type: Date },

    status: {
      type: String,
      enum: [
        "PENDING",     // Not funded yet
        "FUNDED",      // Escrow funded
        "SUBMITTED",   // Employee submitted work
        "APPROVED",    // Employer approved
        "RELEASED"     // Payment released
      ],
      default: "PENDING",
    },

    /* ===============================
      🔥 FIXED PAYMENT FIELDS - WITH SETTER
    =============================== */

    // Payment method used for this milestone
    paymentMethod: {
      type: String,
      enum: ["WALLET", "CARD", "GOOGLE_PAY", "APPLE_PAY"],
      set: function(v) {
        // 🔥 Automatically convert to uppercase when saving
        if (!v) return v;
        const upper = v.toString().toUpperCase();
        // Ensure it's a valid enum value
        if (['WALLET', 'CARD', 'GOOGLE_PAY', 'APPLE_PAY'].includes(upper)) {
          return upper;
        }
        return 'CARD'; // Default to CARD if invalid
      },
      default: null
    },

    // Payment status tracking
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      set: function(v) {
        if (!v) return v;
        const upper = v.toString().toUpperCase();
        return ['PENDING', 'PAID', 'FAILED', 'REFUNDED'].includes(upper) ? upper : 'PENDING';
      },
      default: "PENDING"
    },

    // Stripe payment intent ID (for card payments)
    paymentIntentId: {
      type: String,
      default: null,
      index: true
    },

    // Wallet transaction ID (for wallet payments)
    walletTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WalletTransaction',
      default: null
    },

    // Payment receipt URL from Stripe
    receiptUrl: {
      type: String,
      default: null
    },

    // When payment was processed
    fundedAt: Date,
    submittedAt: Date,
    approvedAt: Date,
    releasedAt: Date,

    // Who processed the payment
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    // Additional payment metadata
    paymentMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    // Refund information (if any)
    refundedAt: Date,
    refundReason: String,
    refundAmount: Number,
  },
  { _id: true }
);
/* ===============================
  PROJECT SCHEMA
=============================== */

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },

    category: { type: String, required: true },
    duration: { type: String, required: true },
    experienceLevel: { type: String, required: true },

    budgetType: {
      type: String,
      enum: ["FIXED", "HOURLY"],
      required: true,
    },

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

    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    employerSnapshot: {
      type: EmployerSnapshotSchema,
      required: true,
    },

    /* ===============================
      MILESTONES
    =============================== */

    milestones: {
      type: [MilestoneSchema],
      default: [],
    },

    /* ===============================
      COUNTERS
    =============================== */

    proposalsCount: { type: Number, default: 0 },
    interviewingCount: { type: Number, default: 0 },
    invitesCount: { type: Number, default: 0 },

    /* ===============================
      PROJECT STATUS
    =============================== */

    status: {
      type: String,
      enum: [
        "OPEN",
        "AWAITING_FUNDING",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "OPEN",
    },

    /* ===============================
      🔥 NEW PROJECT-LEVEL PAYMENT FIELDS
    =============================== */

    // Total amount paid so far
    totalPaid: {
      type: Number,
      default: 0
    },

    // Payment summary
    paymentSummary: {
      totalBudget: { type: Number },
      paidAmount: { type: Number, default: 0 },
      pendingAmount: { type: Number, default: 0 },
      escrowBalance: { type: Number, default: 0 },
      lastPaymentAt: Date,
    },

    // Accepted proposal with payment info
    acceptedProposal: {
      proposalId: { type: mongoose.Schema.Types.ObjectId, ref: "Proposal" },
      employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      acceptedAt: Date,
      fixedPrice: Number,
      projectDuration: Number,
      
      // Contract signed status
      contractSigned: { type: Boolean, default: false },
      contractSignedAt: Date,
    },

    // Escrow account details (if using escrow)
    escrowId: {
      type: String,
      default: null
    },
  },
  { timestamps: true }
);

/* ===============================
  VALIDATION HOOK
  Ensure milestone total matches budget
=============================== */

projectSchema.pre("save", function (next) {
  if (this.budgetType === "FIXED" && this.milestones.length > 0) {
    const totalMilestones = this.milestones.reduce(
      (sum, m) => sum + m.amount,
      0
    );

    if (totalMilestones !== this.maxBudget) {
      return next(
        new Error("Milestone total amount must equal maxBudget")
      );
    }
  }

  next();
});

/* ===============================
  🔥 POST-SAVE HOOK TO UPDATE PAYMENT SUMMARY
=============================== */

projectSchema.post('save', async function() {
  // Update payment summary after milestone changes
  const totalPaid = this.milestones
    .filter(m => m.paymentStatus === 'PAID')
    .reduce((sum, m) => sum + m.amount, 0);
  
  const pendingAmount = this.milestones
    .filter(m => m.paymentStatus === 'PENDING')
    .reduce((sum, m) => sum + m.amount, 0);

  this.paymentSummary = {
    totalBudget: this.maxBudget,
    paidAmount: totalPaid,
    pendingAmount: pendingAmount,
    escrowBalance: totalPaid, // If using escrow
    lastPaymentAt: this.milestones
      .filter(m => m.fundedAt)
      .sort((a, b) => b.fundedAt - a.fundedAt)[0]?.fundedAt
  };

  this.totalPaid = totalPaid;
  
  // Don't trigger another save to avoid loop
  await this.constructor.updateOne(
    { _id: this._id },
    { 
      $set: { 
        paymentSummary: this.paymentSummary,
        totalPaid: totalPaid
      }
    }
  );
});

/* ===============================
  🔥 INSTANCE METHODS FOR PAYMENT
=============================== */

// Mark milestone as paid
projectSchema.methods.markMilestoneAsPaid = async function(
  milestoneId, 
  paymentData
) {
  const milestone = this.milestones.id(milestoneId);
  if (!milestone) throw new Error('Milestone not found');

  milestone.status = 'FUNDED';
  milestone.paymentStatus = 'PAID';
  milestone.fundedAt = new Date();
  milestone.paymentIntentId = paymentData.paymentIntentId;
  milestone.paymentMethod = paymentData.paymentMethod;
  milestone.walletTransactionId = paymentData.walletTransactionId;
  milestone.receiptUrl = paymentData.receiptUrl;
  milestone.processedBy = paymentData.processedBy;

  return this.save();
};

// Check if milestone is payable
projectSchema.methods.isMilestonePayable = function(milestoneId) {
  const milestone = this.milestones.id(milestoneId);
  if (!milestone) return false;

  // Check if milestone is pending and previous milestones are completed
  const milestoneIndex = this.milestones.findIndex(m => m._id.toString() === milestoneId);
  
  if (milestoneIndex === 0) {
    return milestone.status === 'PENDING';
  }

  const previousMilestone = this.milestones[milestoneIndex - 1];
  return milestone.status === 'PENDING' && previousMilestone.status === 'RELEASED';
};

/* ===============================
  INDEXES FOR PERFORMANCE
=============================== */

projectSchema.index({ status: 1 });
projectSchema.index({ postedBy: 1 });
projectSchema.index({ 'milestones.paymentIntentId': 1 });
projectSchema.index({ 'milestones.walletTransactionId': 1 });
projectSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Project", projectSchema);