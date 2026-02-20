// models/PointsTransaction.js

const mongoose = require("mongoose");

const PointsTransactionSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },

    type: {
      type: String,
      enum: ["DEBIT", "CREDIT"],
      required: true,
    },

    amount: { type: Number, required: true },

    reason: { type: String },

    relatedProposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PointsTransaction", PointsTransactionSchema);  