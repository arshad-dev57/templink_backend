const router = require("express").Router();
const auth = require("../middleware/auth_middleware");
const chat = require("../controllers/chat_controller");
const upload = require("../middleware/multer");

// ── Conversation routes ────────────────────────────────────
router.get("/conversations", auth, chat.getMyConversations);
router.post("/conversations/with/:otherUserId", auth, chat.getOrCreateConversationWith);
router.get("/conversations/:conversationId/messages", auth, chat.getConversationMessages);

// ── File upload route ──────────────────────────────────────
// POST /api/chat/upload
// Body: multipart/form-data, field name: "file"
// Returns: { ok, mediaUrl, originalName, mimeType, fileSize, fileType }
router.post("/upload", auth, upload.single("file"), chat.uploadChatFile);

module.exports = router;