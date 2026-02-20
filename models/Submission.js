// models/Submission.js
const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  milestoneId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
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
  milestoneTitle: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  notes: String,
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileType: String,
    fileSize: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED'],
    default: 'PENDING'
  },
  employerFeedback: String,
  submittedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: Date,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

SubmissionSchema.index({ projectId: 1, milestoneId: 1 });
SubmissionSchema.index({ employeeId: 1, createdAt: -1 });

module.exports = mongoose.model('Submission', SubmissionSchema);