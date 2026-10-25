const mongoose = require("mongoose");

const CrmActivitySchema = new mongoose.Schema(
  {
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    activityType: {
      type: String,
      enum: ["task", "call", "meeting", "follow_up", "email"],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "cancelled", "scheduled", "rescheduled"],
      default: "pending",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    dueDate: {
      type: Date,
      default: null,
      index: true,
    },
    startTime: {
      type: Date,
      default: null,
    },
    endTime: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: 30,
    },
    relatedToType: {
      type: String,
      enum: ["lead", "contact", "company", "deal", "case", "general"],
      default: "general",
    },
    relatedToId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    relatedToName: {
      type: String,
      default: "",
    },
    // Call specific fields
    callDirection: {
      type: String,
      enum: ["inbound", "outbound", "none"],
      default: "none",
    },
    callOutcome: {
      type: String,
      enum: ["connected", "left_voicemail", "no_answer", "wrong_number", "busy", "scheduled_meeting", "none"],
      default: "none",
    },
    // Meeting specific fields
    meetingType: {
      type: String,
      enum: ["in_person", "video_call", "phone_call", "none"],
      default: "none",
    },
    meetingLink: {
      type: String,
      default: "",
    },
    location: {
      type: String,
      default: "",
    },
    outcomeNotes: {
      type: String,
      default: "",
    },
    completedAt: {
      type: Date,
      default: null,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

CrmActivitySchema.index({ employerId: 1, dueDate: 1 });
CrmActivitySchema.index({ employerId: 1, assignedTo: 1, status: 1 });
CrmActivitySchema.index({ employerId: 1, activityType: 1, status: 1 });

module.exports = mongoose.model("CrmActivity", CrmActivitySchema);
