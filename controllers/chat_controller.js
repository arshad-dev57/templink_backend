const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/user_model");
const { sendNotification } = require("./notificationController");

// GET /api/chat/conversations
exports.getMyConversations = async (req, res) => {
  try {
    const myId = req.user.id;

    const convos = await Conversation.find({ participants: myId })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();

    const otherIds = convos
      .map((c) => c.participants.find((p) => p.toString() !== myId)?.toString())
      .filter(Boolean);

    const users = await User.find({ _id: { $in: otherIds } })
      .select({
        firstName: 1,
        lastName: 1,
        email: 1,
        "employeeProfile.photoUrl": 1,
        "employerProfile.logoUrl": 1,
        role: 1,
      })
      .lean();

    const userMap = new Map();
    users.forEach((u) => {
      const userId = u._id.toString();
      let name = `${u.firstName || ""} ${u.lastName || ""}`.trim();
      if (!name) name = "User";
      let imageUrl = "";
      if (u.role === "employee") {
        imageUrl = u.employeeProfile?.photoUrl || "";
      } else {
        imageUrl = u.employerProfile?.logoUrl || "";
      }
      if (!imageUrl) {
        imageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff`;
      }
      userMap.set(userId, { name, imageUrl });
    });

    const result = convos.map((c) => {
      const otherId = c.participants
        .find((p) => p.toString() !== myId)
        ?.toString();
      const other = userMap.get(otherId) || { name: "Unknown", imageUrl: "" };
      const unread =
        (c.unreadCounts?.get && c.unreadCounts.get(myId)) ??
        c.unreadCounts?.[myId] ??
        0;

      return {
        conversationId: c._id,
        userId: otherId,
        name: other.name,
        image: other.imageUrl,
        lastMessage: c.lastMessage?.text ?? "",
        time: c.lastMessage?.at ?? c.lastMessageAt,
        unread,
        online: false,
      };
    });

    return res.json({ conversations: result });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

// POST /api/chat/conversations/with/:otherUserId
exports.getOrCreateConversationWith = async (req, res) => {
  try {
    const myId = req.user.id;
    const otherId = req.params.otherUserId;

    let convo = await Conversation.findOne({
      participants: { $all: [myId, otherId] },
      $expr: { $eq: [{ $size: "$participants" }, 2] },
    });

    if (!convo) {
      convo = await Conversation.create({
        participants: [myId, otherId],
        unreadCounts: { [myId]: 0, [otherId]: 0 },
      });
    }

    return res.json({ conversationId: convo._id.toString() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

// GET /api/chat/conversations/:conversationId/messages?page=1&limit=30
exports.getConversationMessages = async (req, res) => {
  try {
    const myId = req.user.id;
    const { conversationId } = req.params;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 30);

    const convo = await Conversation.findById(conversationId).lean();
    if (!convo) return res.status(404).json({ error: "Conversation not found" });

    const isParticipant = convo.participants.some(
      (p) => p.toString() === myId
    );
    if (!isParticipant)
      return res.status(403).json({ error: "Not allowed" });

    const msgs = await Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.json({ messages: msgs.reverse() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

// POST /api/chat/messages - Send new message
exports.sendMessage = async (req, res) => {
  try {
    const myId = req.user.id;
    const { conversationId, text, mediaUrl, mediaType } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: "Conversation ID required" });
    }

    if (!text && !mediaUrl) {
      return res.status(400).json({ error: "Message text or media required" });
    }

    // Find conversation
    let convo = await Conversation.findById(conversationId);
    if (!convo) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Check if user is participant
    const isParticipant = convo.participants.some(p => p.toString() === myId);
    if (!isParticipant) {
      return res.status(403).json({ error: "Not allowed" });
    }

    // Get receiver ID
    const receiverId = convo.participants.find(p => p.toString() !== myId);

    // Get sender info for notification
    const sender = await User.findById(myId).select('firstName lastName role');
    const senderName = `${sender.firstName} ${sender.lastName}`;

    // Create message
    const message = await Message.create({
      conversationId,
      senderId: myId,
      text: text || "",
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      readBy: [myId],
    });

    // Update conversation
    const lastMessageText = text || (mediaType === 'image' ? '📷 Image' : mediaType === 'video' ? '🎥 Video' : '📎 File');
    convo.lastMessage = { text: lastMessageText, at: new Date() };
    convo.lastMessageAt = new Date();
    
    // Increment unread count for receiver
    const receiverIdStr = receiverId.toString();
    const currentUnread = convo.unreadCounts.get(receiverIdStr) || 0;
    convo.unreadCounts.set(receiverIdStr, currentUnread + 1);
    
    await convo.save();

    // 🔔 SEND NOTIFICATION TO RECEIVER
    let notificationMessage = text || (mediaType === 'image' ? 'Sent you an image' : mediaType === 'video' ? 'Sent you a video' : 'Sent you a file');
    if (notificationMessage.length > 100) {
      notificationMessage = notificationMessage.substring(0, 100) + '...';
    }
    
    await sendNotification(
      receiverId,
      `📩 New message from ${senderName}`,
      notificationMessage,
      {
        type: "new_message",
        conversationId: conversationId.toString(),
        senderId: myId,
        senderName: senderName,
        messageId: message._id.toString()
      }
    );

    return res.status(201).json({
      success: true,
      message: {
        _id: message._id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        text: message.text,
        mediaUrl: message.mediaUrl,
        mediaType: message.mediaType,
        createdAt: message.createdAt,
        readBy: message.readBy
      }
    });
  } catch (e) {
    console.error("Send message error:", e);
    return res.status(500).json({ error: e.message });
  }
};

// PUT /api/chat/messages/:messageId/read - Mark message as read
exports.markMessageAsRead = async (req, res) => {
  try {
    const myId = req.user.id;
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check if user is receiver
    if (message.senderId.toString() === myId) {
      return res.status(400).json({ error: "Cannot mark own message as read" });
    }

    // Check if already read
    if (message.readBy.includes(myId)) {
      return res.json({ success: true, alreadyRead: true });
    }

    // Add to readBy
    message.readBy.push(myId);
    await message.save();

    // Update conversation unread count
    const convo = await Conversation.findById(message.conversationId);
    if (convo) {
      const currentUnread = convo.unreadCounts.get(myId) || 0;
      if (currentUnread > 0) {
        convo.unreadCounts.set(myId, Math.max(0, currentUnread - 1));
        await convo.save();
      }
    }

    return res.json({ success: true });
  } catch (e) {
    console.error("Mark read error:", e);
    return res.status(500).json({ error: e.message });
  }
};

// GET /api/chat/conversations/:conversationId/unread - Get unread count
exports.getUnreadCount = async (req, res) => {
  try {
    const myId = req.user.id;
    const { conversationId } = req.params;

    const convo = await Conversation.findById(conversationId);
    if (!convo) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const isParticipant = convo.participants.some(p => p.toString() === myId);
    if (!isParticipant) {
      return res.status(403).json({ error: "Not allowed" });
    }

    const unreadCount = convo.unreadCounts.get(myId) || 0;
    return res.json({ unreadCount });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

// POST /api/chat/upload
// Multer + Cloudinary se file upload karke mediaUrl return karo
exports.uploadChatFile = async (req, res) => {
  try {
    // Multer ne file process kar di hogi — req.file check karo
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const file = req.file;

    // Cloudinary se jo URL mila woh return karo
    const mediaUrl = file.path;           // CloudinaryStorage sets path = secure_url
    const originalName = file.originalname;
    const mimeType = file.mimetype;
    const fileSize = file.size;

    // File type determine karo
    const ext = originalName.split(".").pop().toLowerCase();
    let fileType = "file";
    if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) {
      fileType = "image";
    } else if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) {
      fileType = "video";
    } else if (["mp3", "aac", "wav", "ogg", "m4a"].includes(ext)) {
      fileType = "audio";
    } else if (["pdf"].includes(ext)) {
      fileType = "pdf";
    } else if (["doc", "docx"].includes(ext)) {
      fileType = "doc";
    } else if (["xls", "xlsx"].includes(ext)) {
      fileType = "excel";
    } else if (["zip", "rar", "7z"].includes(ext)) {
      fileType = "archive";
    }

    return res.json({
      ok: true,
      mediaUrl,
      originalName,
      mimeType,
      fileSize,
      fileType,
    });
  } catch (e) {
    console.error("❌ File upload error:", e.message);
    return res.status(500).json({ error: e.message });
  }
};