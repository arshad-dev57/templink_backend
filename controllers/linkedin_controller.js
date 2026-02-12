const axios = require("axios");

/**
 * STEP 1: Redirect user to LinkedIn consent screen
 * GET /auth/linkedin
 */
exports.redirectToLinkedIn = (req, res) => {
  // ✅ OpenID + profile for userinfo, and w_member_social for posting
  const scope = "openid profile w_member_social";

  const authURL =
    "https://www.linkedin.com/oauth/v2/authorization" +
    "?response_type=code" +
    "&client_id=" +
    process.env.LINKEDIN_CLIENT_ID +
    "&redirect_uri=" +
    encodeURIComponent(process.env.LINKEDIN_REDIRECT_URI) +
    "&scope=" +
    encodeURIComponent(scope);

  return res.redirect(authURL);
};

/**
 * STEP 2: LinkedIn redirects back with ?code=...
 * GET /auth/linkedin/callback
 */
exports.linkedInCallback = async (req, res) => {
  try {
    const { code, error, error_description } = req.query;

    if (error) {
      return res.status(400).json({ success: false, error, error_description });
    }

    if (!code) {
      return res
        .status(400)
        .json({ success: false, message: "No code received from LinkedIn" });
    }

    const tokenRes = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = tokenRes.data.access_token;

    // ✅ For now we return token (Next step: DB save per-user)
    return res.status(200).json({
      success: true,
      message: "LinkedIn connected successfully",
      accessToken,
    });
  } catch (e) {
    const status = e.response?.status || 500;
    return res.status(status).json({
      success: false,
      message: "Token exchange failed",
      error: e.response?.data || e.message,
    });
  }
};

/**
 * STEP 3: Get LinkedIn user info (OpenID)
 * GET /auth/linkedin/me
 */
exports.getLinkedInMe = async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.replace("Bearer ", "");
    if (!accessToken) {
      return res
        .status(401)
        .json({ success: false, message: "Missing Bearer token" });
    }

    // ✅ OpenID Connect endpoint
    const meRes = await axios.get("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return res.status(200).json({
      success: true,
      me: meRes.data, // contains "sub"
    });
  } catch (e) {
    const status = e.response?.status || 500;
    return res.status(status).json({
      success: false,
      message: "Failed to fetch /userinfo",
      error: e.response?.data || e.message,
    });
  }
};

/**
 * STEP 4: Post on LinkedIn (text post)
 * POST /auth/linkedin/post
 * Body: { "text": "..." }
 */
exports.postToLinkedIn = async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.replace("Bearer ", "");
    if (!accessToken) {
      return res
        .status(401)
        .json({ success: false, message: "Missing Bearer token" });
    }

    const { text } = req.body;
    if (!text) {
      return res
        .status(400)
        .json({ success: false, message: "text is required" });
    }

    // ✅ get member id using OpenID userinfo
    const meRes = await axios.get("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // OpenID userinfo usually returns "sub" as the member id
    const memberId = meRes.data.sub;
    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: "Could not get member id (sub) from /userinfo",
        me: meRes.data,
      });
    }

    const payload = {
      author: `urn:li:person:${memberId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };

    const postRes = await axios.post(
      "https://api.linkedin.com/v2/ugcPosts",
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
          "Content-Type": "application/json",
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Posted to LinkedIn",
      post: postRes.data,
    });
  } catch (e) {
    const status = e.response?.status || 500;
    return res.status(status).json({
      success: false,
      message: "Posting failed",
      error: e.response?.data || e.message,
    });
  }
};