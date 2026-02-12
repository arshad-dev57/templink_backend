const express = require("express");
const router = express.Router();

const {
  redirectToLinkedIn,
  linkedInCallback,
  getLinkedInMe,
  postToLinkedIn,
} = require("../controllers/linkedin_controller");

// Login redirect
router.get("/linkedin", redirectToLinkedIn);

// Callback
router.get("/linkedin/callback", linkedInCallback);

// OpenID userinfo
router.get("/linkedin/me", getLinkedInMe);

// ✅ POST route (this was missing)
router.post("/linkedin/post", postToLinkedIn);

module.exports = router;