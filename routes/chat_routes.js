const router = require("express").Router();
const auth = require("../middleware/auth_middleware");
const chat = require("../controllers/chat_controller");

router.get("/conversations", auth, chat.getMyConversations);
router.post("/conversations/with/:otherUserId", auth, chat.getOrCreateConversationWith);
router.get("/conversations/:conversationId/messages", auth, chat.getConversationMessages);

module.exports = router;
