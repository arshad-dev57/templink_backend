// models/Conversation.js
const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true }],

    lastMessage: {
      messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
      text: { type: String, default: "" },
      type: { type: String, default: "text" },
      from: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      at: { type: Date, default: null },
    },

    // unreadCounts[userId] = number
    unreadCounts: { type: Map, of: Number, default: {} },

    lastMessageAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// optional: enforce 1-to-1 conversation uniqueness by a computed key
ConversationSchema.index({ participants: 1 });

module.exports = mongoose.model("Conversation", ConversationSchema);
