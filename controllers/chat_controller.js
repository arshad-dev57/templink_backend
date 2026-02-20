const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/user_model");

// GET /api/chat/conversations// controllers/chat_controller.js - getMyConversations function

exports.getMyConversations = async (req, res) => {
  try {
    const myId = req.user.id;

    const convos = await Conversation.find({ participants: myId })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();

    const otherIds = convos
      .map((c) => c.participants.find((p) => p.toString() !== myId)?.toString())
      .filter(Boolean);

    // ✅ FIX: Get complete user data with profile photos
    const users = await User.find({ _id: { $in: otherIds } })
      .select({
        firstName: 1,
        lastName: 1,
        email: 1,
        // ✅ Employee photo
        'employeeProfile.photoUrl': 1,
        // ✅ Employer logo
        'employerProfile.logoUrl': 1,
        // ✅ Role decide karega kaunsa image lena hai
        role: 1
      })
      .lean();

    const userMap = new Map();
    users.forEach((u) => {
      const userId = u._id.toString();
      
      // ✅ Get name
      let name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
      if (!name) name = 'User';
      
      // ✅ Get profile image based on role
      let imageUrl = '';
      if (u.role === 'employee') {
        imageUrl = u.employeeProfile?.photoUrl || '';
      } else {
        imageUrl = u.employerProfile?.logoUrl || '';
      }
      
      // ✅ Default avatar if no image
      if (!imageUrl) {
        imageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff`;
      }
      
      userMap.set(userId, { name, imageUrl });
    });

    const result = convos.map((c) => {
      const otherId = c.participants.find((p) => p.toString() !== myId)?.toString();
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

    const isParticipant = convo.participants.some((p) => p.toString() === myId);
    if (!isParticipant) return res.status(403).json({ error: "Not allowed" });

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
