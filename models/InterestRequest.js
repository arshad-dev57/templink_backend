// models/InterestRequest.js
const mongoose = require('mongoose');

const InterestRequestSchema = new mongoose.Schema({
  employerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  jobTitle: {
    type: String,
    required: true
  },
  salaryAmount: {
    type: Number,
    required: true
  },
  salaryPeriod: {
    type: String,
    enum: ['hourly', 'monthly', 'yearly'],
    default: 'monthly'
  },
  message: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'interested', 'declined', 'hired', 'cancelled'],
    default: 'pending'
  },
  commissionAmount: {
    type: Number,
    required: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 7*24*60*60*1000) // 7 days
  },
  respondedAt: Date,
  hiredAt: Date
}, { timestamps: true });

// Indexes for fast queries
InterestRequestSchema.index({ employerId: 1, status: 1 });
InterestRequestSchema.index({ employeeId: 1, status: 1 });
InterestRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('InterestRequest', InterestRequestSchema);