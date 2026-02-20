// F:\templink_backend\sockets\chat_socket.js

const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

const onlineUsers = new Map(); // userId -> Set(socketId)

/** helpers */
function addOnline(userId, socketId) {
  const uid = userId?.toString();
  if (!uid) return;

  if (!onlineUsers.has(uid)) onlineUsers.set(uid, new Set());
  onlineUsers.get(uid).add(socketId);
}

function removeOnline(userId, socketId) {
  const uid = userId?.toString();
  if (!uid) return;

  if (!onlineUsers.has(uid)) return;
  onlineUsers.get(uid).delete(socketId);
  if (onlineUsers.get(uid).size === 0) onlineUsers.delete(uid);
}

function isUserOnline(userId) {
  const uid = userId?.toString();
  if (!uid) return false;
  return onlineUsers.has(uid);
}

/** check if user is in conversation */
async function ensureParticipant(conversationId, userId) {
  if (!conversationId) return { ok: false, error: "Missing conversationId" };
  if (!userId) return { ok: false, error: "Missing userId" };

  const convo = await Conversation.findById(conversationId).lean();
  if (!convo) return { ok: false, error: "Conversation not found" };

  const allowed = (convo.participants || []).some(
    (p) => p?.toString?.() === userId.toString()
  );

  if (!allowed) return { ok: false, error: "Not allowed" };
  return { ok: true, convo };
}

/** check if receiver is currently inside convo room */
function receiverInRoom(io, conversationId, receiverId) {
  const cid = conversationId?.toString();
  const rid = receiverId?.toString();
  if (!cid || !rid) return false;

  const room = io.sockets.adapter.rooms.get(`convo:${cid}`);
  if (!room) return false;

  for (const sid of room) {
    const s = io.sockets.sockets.get(sid);
    if (s?.userId?.toString?.() === rid) return true;
  }
  return false;
}

function initChatSocket(server) {
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  // =============== JWT AUTH ===============
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];

      if (!token) return next(new Error("No token"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // support multiple common jwt payload keys
      const uid = decoded?.id || decoded?._id || decoded?.userId || decoded?.sub;

      if (!uid) return next(new Error("Token missing user id"));

      socket.userId = uid.toString();
      next();
    } catch (e) {
      next(new Error("Auth failed"));
    }
  });

  io.on("connection", (socket) => {
    const myId = socket.userId; // already string now

    if (!myId) {
      // should never happen due to middleware, but safety
      socket.disconnect(true);
      return;
    }

    // =============== PRESENCE (multi-device) ===============
    addOnline(myId, socket.id);
    socket.join(`user:${myId}`);

    io.emit("presence", { userId: myId, online: true });
    socket.emit("connected", { userId: myId });

    // =============== JOIN CONVERSATION ROOM (secured) ===============
    socket.on("join_conversation", async ({ conversationId }, ack) => {
      try {
        if (!conversationId) return ack?.({ ok: false, error: "Missing conversationId" });

        const check = await ensureParticipant(conversationId, myId);
        if (!check.ok) return ack?.({ ok: false, error: check.error });

        socket.join(`convo:${conversationId}`);

        // mark "delivered" for messages that were pending delivery to me in this conversation
        const now = new Date();
        const upd = await Message.updateMany(
          { conversationId, to: myId, status: "sent" },
          { $set: { status: "delivered", deliveredAt: now } }
        );

        // notify other participant that messages are delivered (optional)
        const otherId = check.convo.participants
          .find((p) => p.toString() !== myId)
          ?.toString();

        if (otherId && upd.modifiedCount > 0) {
          io.to(`user:${otherId}`).emit("message_status", {
            conversationId,
            status: "delivered",
            at: now,
          });
        }

        return ack?.({ ok: true });
      } catch (e) {
        return ack?.({ ok: false, error: e.message });
      }
    });

    socket.on("leave_conversation", ({ conversationId }) => {
      if (!conversationId) return;
      socket.leave(`convo:${conversationId}`);
    });

    // =============== TYPING ===============
    socket.on("typing", async ({ conversationId, toUserId, isTyping }) => {
      if (!toUserId || !conversationId) return;

      // security: ensure sender is participant
      const check = await ensureParticipant(conversationId, myId);
      if (!check.ok) return;

      io.to(`user:${toUserId}`).emit("typing", {
        conversationId,
        fromUserId: myId,
        isTyping: !!isTyping,
      });
    });

    // =============== SEND MESSAGE (DEDUP + STATUS + UNREAD) ===============
    socket.on("send_message", async (payload, ack) => {
      try {
        const {
          toUserId,
          text,
          clientId,           // REQUIRED (uuid from app)
          conversationId,     // recommended (from REST get/create)
          type = "text",
          mediaUrl = "",
        } = payload || {};

        const t = (text || "").trim();

        if (!toUserId) return ack?.({ ok: false, error: "Missing toUserId" });
        if (!clientId) return ack?.({ ok: false, error: "Missing clientId" });
        if (type === "text" && !t) return ack?.({ ok: false, error: "Empty text" });

        let convo;

        // if conversationId provided, use it (faster + safer)
        if (conversationId) {
          const check = await ensureParticipant(conversationId, myId);
          if (!check.ok) return ack?.({ ok: false, error: check.error });
          convo = check.convo;

          // ensure toUser is actually the other participant
          const otherId = convo.participants
            .find((p) => p.toString() !== myId)
            ?.toString();

          if (!otherId || otherId !== toUserId.toString()) {
            return ack?.({ ok: false, error: "Invalid toUserId for this conversation" });
          }
        } else {
          // find or create 1-to-1
          convo = await Conversation.findOne({
            participants: { $all: [myId, toUserId] },
            $expr: { $eq: [{ $size: "$participants" }, 2] },
          });

          if (!convo) {
            convo = await Conversation.create({
              participants: [myId, toUserId],
              unreadCounts: { [myId]: 0, [toUserId]: 0 },
            });
          } else {
            convo = convo.toObject ? convo.toObject() : convo;
          }
        }

        const convoId = convo._id.toString();

        // delivered logic
        const receiverOnline = isUserOnline(toUserId);
        const receiverInsideChat = receiverInRoom(io, convoId, toUserId);

        const now = new Date();
        const initialStatus = receiverOnline ? "delivered" : "sent";
        const deliveredAt = receiverOnline ? now : null;

        // create message with dedupe (clientId unique per conversation)
        let msgDoc;
        try {
          msgDoc = await Message.create({
            conversationId: convoId,
            from: myId,
            to: toUserId,
            type,
            text: type === "text" ? t : "",
            mediaUrl: type === "text" ? "" : (mediaUrl || ""),
            clientId,
            status: initialStatus,
            deliveredAt,
          });
        } catch (e) {
          // duplicate key -> get the existing message
          if (e.code === 11000) {
            msgDoc = await Message.findOne({ conversationId: convoId, clientId }).lean();
          } else {
            throw e;
          }
        }

        const msg = msgDoc.toObject ? msgDoc.toObject() : msgDoc;

        // unread: don’t increment if receiver is currently in chat screen
        const incUnread = receiverInsideChat ? 0 : 1;

        // update conversation last message + unread counts
        await Conversation.updateOne(
          { _id: convoId },
          {
            $set: {
              lastMessage: {
                messageId: msg._id,
                text: msg.type === "text" ? msg.text : `[${msg.type}]`,
                type: msg.type,
                from: msg.from,
                at: msg.createdAt,
              },
              lastMessageAt: msg.createdAt,
            },
            ...(incUnread ? { $inc: { [`unreadCounts.${toUserId}`]: 1 } } : {}),
          }
        );

        // emit message to both user rooms
        io.to(`user:${myId}`).emit("new_message", msg);
        io.to(`user:${toUserId}`).emit("new_message", msg);

        // update list screens
        io.to(`user:${myId}`).emit("conversation_updated", {
          conversationId: convoId,
          otherUserId: toUserId,
          lastMessage: msg.type === "text" ? msg.text : `[${msg.type}]`,
          lastMessageAt: msg.createdAt,
          unreadInc: 0,
        });

        io.to(`user:${toUserId}`).emit("conversation_updated", {
          conversationId: convoId,
          otherUserId: myId,
          lastMessage: msg.type === "text" ? msg.text : `[${msg.type}]`,
          lastMessageAt: msg.createdAt,
          unreadInc: incUnread,
        });

        // ACK includes server message
        return ack?.({ ok: true, conversationId: convoId, message: msg });
      } catch (e) {
        return ack?.({ ok: false, error: e.message });
      }
    });

    // =============== MARK READ (STATUS + UNREAD RESET) ===============
    socket.on("mark_read", async ({ conversationId }, ack) => {
      try {
        if (!conversationId) return ack?.({ ok: false, error: "Missing conversationId" });

        const check = await ensureParticipant(conversationId, myId);
        if (!check.ok) return ack?.({ ok: false, error: check.error });

        const now = new Date();

        // mark unread incoming messages as read
        const upd = await Message.updateMany(
          { conversationId, to: myId, readAt: null },
          { $set: { readAt: now, status: "read" } }
        );

        // reset unread count for me
        await Conversation.updateOne(
          { _id: conversationId },
          { $set: { [`unreadCounts.${myId}`]: 0 } }
        );

        // notify other participant
        const otherId = check.convo.participants
          .find((p) => p.toString() !== myId)
          ?.toString();

        if (otherId) {
          io.to(`user:${otherId}`).emit("read_receipt", {
            conversationId,
            readerId: myId,
            readAt: now,
          });

          io.to(`user:${otherId}`).emit("conversation_updated", {
            conversationId,
            otherUserId: myId,
            unreadInc: 0,
          });
        }

        // update my list screen too
        io.to(`user:${myId}`).emit("unread_reset", { conversationId });

        return ack?.({ ok: true, modified: upd.modifiedCount, readAt: now });
      } catch (e) {
        return ack?.({ ok: false, error: e.message });
      }
    });

    // ================= VOICE / VIDEO CALL (signal only) =================
    socket.on("call_invite", ({ toUserId, callType }) => {
      if (!toUserId) return;
      io.to(`user:${toUserId}`).emit("call_incoming", { fromUserId: myId, callType });
    });
    socket.on("call_accept", ({ toUserId, callType }) => {
      if (!toUserId) return;
      io.to(`user:${toUserId}`).emit("call_accepted", { fromUserId: myId, callType });
    });
    socket.on("call_reject", ({ toUserId }) => {
      if (!toUserId) return;
      io.to(`user:${toUserId}`).emit("call_rejected", { fromUserId: myId });
    });
    socket.on("call_end", ({ toUserId }) => {
      if (!toUserId) return;
      io.to(`user:${toUserId}`).emit("call_ended", { fromUserId: myId });
    });

    // ================= WEBRTC SIGNALING =================
    socket.on("webrtc_offer", ({ toUserId, sdp }) => {
      if (!toUserId) return;
      io.to(`user:${toUserId}`).emit("webrtc_offer", { fromUserId: myId, sdp });
    });
    socket.on("webrtc_answer", ({ toUserId, sdp }) => {
      if (!toUserId) return;
      io.to(`user:${toUserId}`).emit("webrtc_answer", { fromUserId: myId, sdp });
    });
    socket.on("webrtc_ice_candidate", ({ toUserId, candidate }) => {
      if (!toUserId) return;
      io.to(`user:${toUserId}`).emit("webrtc_ice_candidate", { fromUserId: myId, candidate });
    });

    // =============== DISCONNECT (multi-device) ===============
    socket.on("disconnect", () => {
      removeOnline(myId, socket.id);
      if (!isUserOnline(myId)) io.emit("presence", { userId: myId, online: false });
    });
  });

  return io;
}

module.exports = { initChatSocket };