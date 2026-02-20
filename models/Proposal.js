const mongoose = require("mongoose");

const SelectedPortfolioSchema = new mongoose.Schema(
  {
    portfolioId: { type: mongoose.Schema.Types.ObjectId },
    title: String,
    description: String,
    imageUrl: String,
    completionDate: String,
  },
  { _id: false }
);

const ProposalSchema = new mongoose.Schema(
  {
    projectId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Project", 
      required: true 
    },

    employeeId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },

    coverLetter: { 
      type: String, 
      required: true 
    },

    paymentMethod: { 
      type: String, 
      enum: ["fixed", "hourly"], 
      required: true 
    },

    fixedPrice: { type: Number },
    projectDuration: { type: Number },

    serviceFee: { type: Number },
    youWillReceive: { type: Number },

    attachedFiles: [
      {
        fileName: String,
        fileUrl: String,
      }
    ],

    // ✅ MULTIPLE PORTFOLIO PROJECTS
    selectedPortfolioProjects: {
      type: [SelectedPortfolioSchema],
      default: [],
    },

    pointsUsed: { 
      type: Number, 
      default: 13 
    },

    // ✅ CLEAN STATUS SYSTEM
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED"],
      default: "PENDING",
    },
    
    // ✅ ADD THIS - Contract reference
    contractId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Contract",
      default: null
    },
    
  },
  { timestamps: true }
);

module.exports = mongoose.model("Proposal", ProposalSchema);