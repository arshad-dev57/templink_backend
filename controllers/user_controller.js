const jwt = require("jsonwebtoken");
const User = require("../models/user_model");
const bcrypt = require("bcryptjs");

// ✅ Google
const { OAuth2Client } = require("google-auth-library");
const crypto = require("crypto");
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

exports.register = async (req, res) => {
  try {
    const {
      role,
      firstName,
      lastName,
      email,
      password,
      country,
      sendEmails = false,
      termsAccepted = false,
      employeeProfile,
      employerProfile,
    } = req.body;

    if (!role || !["employee", "employer"].includes(role)) {
      return res.status(400).json({ message: "Invalid role. Use employee or employer." });
    }
    if (!firstName || !lastName) {
      return res.status(400).json({ message: "First name and last name are required." });
    }
    if (!email) return res.status(400).json({ message: "Email is required." });
    if (!password || password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }
    if (!country) return res.status(400).json({ message: "Country is required." });
    if (!termsAccepted) {
      return res.status(400).json({ message: "You must accept terms & conditions." });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: "Email already registered." });

    const passwordHash = await bcrypt.hash(password, 10);

    const userDoc = {
      role,
      firstName,
      lastName,
      email: email.toLowerCase(),
      passwordHash,
      country,
      sendEmails: !!sendEmails,
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      authProvider: "password",
    };

    if (role === "employee") {
      userDoc.employeeProfile = employeeProfile ?? {};
      userDoc.employerProfile = {};
    } else {
      userDoc.employerProfile = { ...(employerProfile ?? {}), country };
      userDoc.employeeProfile = {};
    }

    const user = await User.create(userDoc);
    const token = signToken(user);

    return res.status(201).json({
      message: "Registered successfully",
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error("REGISTER_ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) return res.status(400).json({ message: "Email is required." });
    if (!password) return res.status(400).json({ message: "Password is required." });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ message: "Invalid email or password." });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid email or password." });

    if (user.status && user.status !== "active") {
      return res.status(403).json({ message: "Account is not active." });
    }

    const token = signToken(user);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error("LOGIN_ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * ✅ GOOGLE AUTH (signup/login)
 * POST /api/users/google
 * body: { idToken, role, country, sendEmails, termsAccepted }
 */
exports.googleAuth = async (req, res) => {
  try {
    const { idToken, role, country, sendEmails = false, termsAccepted = false } = req.body;

    if (!idToken) return res.status(400).json({ message: "idToken required" });
    if (!role || !["employee", "employer"].includes(role)) {
      return res.status(400).json({ message: "Invalid role. Use employee or employer." });
    }
    if (!country) return res.status(400).json({ message: "Country is required." });
    if (!termsAccepted) {
      return res.status(400).json({ message: "You must accept terms & conditions." });
    }

    // ✅ verify google token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email = (payload.email || "").toLowerCase().trim();
    const fullName = (payload.name || "").trim();

    if (!email) return res.status(400).json({ message: "Google email not found" });

    let user = await User.findOne({ email });

    // ✅ if existing user is not google-linked, block (avoid takeover)
    if (user && user.authProvider && user.authProvider !== "google") {
      return res.status(409).json({
        message: "Email already registered with password. Please login with password.",
      });
    }

    // ✅ create if not exists
    if (!user) {
      const parts = fullName.split(/\s+/).filter(Boolean);
      const firstName = payload.given_name || parts[0] || "";
      const lastName = payload.family_name || (parts.length > 1 ? parts.slice(1).join(" ") : "");

      // random password hash (password login won't be used unless you add set-password flow)
      const randomPass = crypto.randomBytes(16).toString("hex");
      const passwordHash = await bcrypt.hash(randomPass, 10);

      const userDoc = {
        role,
        firstName,
        lastName,
        email,
        passwordHash,
        country,
        sendEmails: !!sendEmails,
        termsAccepted: true,
        termsAcceptedAt: new Date(),
        googleId,
        authProvider: "google",
      };

      if (role === "employee") {
        userDoc.employeeProfile = {};
        userDoc.employerProfile = {};
      } else {
        userDoc.employerProfile = { country };
        userDoc.employeeProfile = {};
      }

      user = await User.create(userDoc);
    } else {
      // ✅ sync googleId if missing
      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = "google";
        await user.save();
      }
    }

    const token = signToken(user);

    return res.status(200).json({
      message: "Google auth successful",
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error("GOOGLE_AUTH_ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};