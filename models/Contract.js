const mongoose = require('mongoose');

const ContractSchema = new mongoose.Schema({
  // Basic Info
  contractNumber: { 
    type: String, 
    required: true, 
    unique: true 
  },
  projectId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Project', 
    required: true 
  },
  proposalId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Proposal', 
    required: true 
  },
  
  // Parties Involved (employee = freelancer)
  employerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  employeeId: {  // 👈 Changed from freelancerId to employeeId
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },

  // Project Snapshot (freeze at contract time)
  projectSnapshot: {
    title: String,
    description: String,
    category: String,
    duration: String,
    experienceLevel: String,
    budgetType: String,
    minBudget: Number,
    maxBudget: Number,
    skills: [String],
    deliverables: [String]
  },

  // Milestones Snapshot (freeze at contract time)
  milestones: [{
    title: String,
    description: String,
    amount: Number,
    dueDate: Date,
    sequence: Number
  }],

  // Contract Terms
  terms: {
    startDate: { type: Date, default: Date.now },
    endDate: Date,
    revisionCount: { type: Number, default: 2 },
    revisionDays: { type: Number, default: 7 },
    intellectualProperty: { 
      type: String, 
      enum: ['EMPLOYEE', 'EMPLOYER', 'TRANSFER_ON_FINAL_PAYMENT'], // 👈 Updated
      default: 'TRANSFER_ON_FINAL_PAYMENT'
    },
    confidentialityRequired: { type: Boolean, default: true },
    nonCompete: { type: Boolean, default: false },
    terminationNotice: { type: Number, default: 7 } // days
  },

  // Signatures
  signatures: {
    employer: {
      signed: { type: Boolean, default: false },
      signedAt: Date,
      ipAddress: String,
      userAgent: String,
      signature: String // base64 encoded signature
    },
    employee: {  // 👈 Changed from freelancer to employee
      signed: { type: Boolean, default: false },
      signedAt: Date,
      ipAddress: String,
      userAgent: String,
      signature: String
    }
  },

  // Financial Summary
  financialSummary: {
    totalAmount: Number,
    milestoneCount: Number,
    paymentTerms: { type: String, default: 'MILESTONE_BASED' }
  },

  // Status
  status: {
    type: String,
    enum: [
      'DRAFT',
      'PENDING_EMPLOYER_SIGN',
      'PENDING_EMPLOYEE_SIGN',  // 👈 Changed
      'ACTIVE',
      'COMPLETED',
      'TERMINATED',
      'DISPUTED'
    ],
    default: 'DRAFT'
  },

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  signedAt: Date,
  completedAt: Date,
  terminatedAt: Date
});

// Generate unique contract number
ContractSchema.pre('save', async function(next) {
  if (!this.contractNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Contract').countDocuments();
    this.contractNumber = `CONT-${year}-${(count + 1).toString().padStart(4, '0')}`;
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Contract', ContractSchema);