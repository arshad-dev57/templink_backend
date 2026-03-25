const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Task title cannot exceed 200 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
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
    // Make jobId optional - remove required
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobPost',
      required: false  // Changed to false
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobApplication',
      required: false
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending'
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required']
    },
    estimatedHours: {
      type: Number,
      min: 0,
      default: 0
    },
    actualHours: {
      type: Number,
      min: 0,
      default: 0
    },
    completedAt: {
      type: Date
    },
    attachments: [
      {
        fileName: String,
        fileUrl: String,
        fileSize: Number,
        uploadedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    comments: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        userRole: {
          type: String,
          enum: ['employer', 'employee']
        },
        comment: {
          type: String,
          required: true
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    employerFeedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      comment: String,
      givenAt: Date
    },
    employeeFeedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      comment: String,
      givenAt: Date
    },
    isArchived: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better query performance
TaskSchema.index({ employerId: 1, status: 1 });
TaskSchema.index({ employeeId: 1, status: 1 });
TaskSchema.index({ dueDate: 1 });
TaskSchema.index({ priority: 1 });
TaskSchema.index({ createdAt: -1 });

// Virtual for overdue status
TaskSchema.virtual('isOverdue').get(function() {
  if (this.status === 'completed' || this.status === 'cancelled') return false;
  return new Date() > this.dueDate;
});

// Virtual for days remaining
TaskSchema.virtual('daysRemaining').get(function() {
  if (this.status === 'completed' || this.status === 'cancelled') return 0;
  const today = new Date();
  const due = new Date(this.dueDate);
  const diffTime = due - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Middleware to set completedAt when status changes to completed
TaskSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Task', TaskSchema);