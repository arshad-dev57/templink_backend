const mongoose = require("mongoose");

const CrmEmailSchema = new mongoose.Schema(
  {
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fromEmail: {
      type: String,
      required: true,
    },
    toEmail: {
      type: String,
      required: true,
      index: true,
    },
    toName: {
      type: String,
      default: "",
    },
    cc: {
      type: [String],
      default: [],
    },
    bcc: {
      type: [String],
      default: [],
    },
    subject: {
      type: String,
      required: true,
    },
    bodyHtml: {
      type: String,
      default: "",
    },
    bodyText: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["sent", "failed", "draft"],
      default: "sent",
      index: true,
    },
    relatedToType: {
      type: String,
      enum: ["lead", "contact", "deal", "case", "general"],
      default: "general",
    },
    relatedToId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    errorMessage: {
      type: String,
      default: "",
    },
    sentAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

CrmEmailSchema.index({ employerId: 1, createdAt: -1 });

module.exports = mongoose.model("CrmEmail", CrmEmailSchema);
