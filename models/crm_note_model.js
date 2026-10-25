const mongoose = require("mongoose");

const CrmNoteSchema = new mongoose.Schema(
  {
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      default: "",
    },
    content: {
      type: String,
      required: true,
    },
    relatedToType: {
      type: String,
      enum: ["lead", "contact", "company", "deal", "case", "general"],
      default: "general",
      index: true,
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
    isPinned: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

CrmNoteSchema.index({ employerId: 1, relatedToType: 1, relatedToId: 1 });
CrmNoteSchema.index({ employerId: 1, createdAt: -1 });

module.exports = mongoose.model("CrmNote", CrmNoteSchema);
