const mongoose = require('mongoose');

const LeaveSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  employerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['Annual Leave', 'Sick Leave', 'Casual Leave', 'Unpaid Leave'],
    required: true
  },
  fromDate: {
    type: Date,
    required: true
  },
  toDate: {
    type: Date,
    required: true
  },
  days: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  appliedOn: {
    type: Date,
    default: Date.now
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedOn: Date,
  rejectionReason: String,
  documents: [{
    name: String,
    url: String
  }]
}, {
  timestamps: true
});

// Index for faster queries
LeaveSchema.index({ employeeId: 1, fromDate: -1 });
LeaveSchema.index({ employerId: 1, status: 1 });

module.exports = mongoose.model('Leave', LeaveSchema);