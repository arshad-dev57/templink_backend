const mongoose = require('mongoose');

const WithdrawalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  fee: {
    type: Number,
    default: 2  // $2 fixed fee
  },
  netAmount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer'],
    default: 'bank_transfer'
  },
  
  // Bank Account Details
  bankName: {
    type: String,
    required: true
  },
  accountNumber: {
    type: String,
    required: true
  },
  accountName: {
    type: String,
    required: true
  },
  routingNumber: {
    type: String
  },
  iban: {
    type: String
  },
  swiftCode: {
    type: String
  },
  bankAddress: {
    type: String
  },
  accountType: {
    type: String,
    enum: ['checking', 'savings'],
    default: 'checking'
  },
  
  // Status
  status: {
    type: String,
    enum: [
      'pending',      // Waiting for admin review
      'processing',   // Admin approved, processing
      'completed',    // Money sent
      'failed',       // Failed, need retry
      'cancelled'     // User cancelled
    ],
    default: 'pending'
  },
  
  // Admin Fields
  adminNotes: {
    type: String,
    default: ''
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: Date,
  completedAt: Date,
  
  // Bank Transaction Reference
  transactionReference: {
    type: String,
    unique: true,
    sparse: true
  },
  
  // For tracking
  failureReason: String,
  retryCount: {
    type: Number,
    default: 0
  },
  
  // Security
  ipAddress: String,
  userAgent: String,
  
  // Audit Trail
  approvalHistory: [{
    action: String,
    by: mongoose.Schema.Types.ObjectId,
    at: Date,
    notes: String
  }]
}, {
  timestamps: true
});

// Indexes
WithdrawalSchema.index({ userId: 1, createdAt: -1 });
WithdrawalSchema.index({ status: 1 });
WithdrawalSchema.index({ transactionReference: 1 });

module.exports = mongoose.model('Withdrawal', WithdrawalSchema);