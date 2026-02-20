const jwt = require("jsonwebtoken");
const User = require("../models/user_model");
const bcrypt = require("bcryptjs");

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

    console.log("📦 Register request received:");
    console.log("- Role:", role);
    console.log("- Name:", firstName, lastName);
    console.log("- Email:", email);
    console.log("- Country:", country);
    console.log("- Has file:", req.file ? "Yes" : "No");

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

    const uploadedPhotoUrl = req.file?.path || "";

    const passwordHash = await bcrypt.hash(password, 10);

    // Parse nested objects
    let parsedEmployeeProfile = {};
    if (employeeProfile) {
      if (typeof employeeProfile === "string") {
        try {
          parsedEmployeeProfile = JSON.parse(employeeProfile);
          console.log("✅ Parsed employeeProfile:", parsedEmployeeProfile);
        } catch (e) {
          console.error("❌ Failed to parse employeeProfile:", e);
        }
      } else {
        parsedEmployeeProfile = employeeProfile;
      }
    }

    let parsedEmployerProfile = {};
    if (employerProfile) {
      if (typeof employerProfile === "string") {
        try {
          parsedEmployerProfile = JSON.parse(employerProfile);
          console.log("✅ Parsed employerProfile:", parsedEmployerProfile);
        } catch (e) {
          console.error("❌ Failed to parse employerProfile:", e);
        }
      } else {
        parsedEmployerProfile = employerProfile;
      }
    }

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
      userDoc.employeeProfile = {
        experienceLevel: parsedEmployeeProfile.experienceLevel || "",
        category: parsedEmployeeProfile.category || "",
        subcategory: parsedEmployeeProfile.subcategory || "",
        skills: Array.isArray(parsedEmployeeProfile.skills) ? parsedEmployeeProfile.skills : [],
        title: parsedEmployeeProfile.title || "",
        bio: parsedEmployeeProfile.bio || "",
        hourlyRate: parsedEmployeeProfile.hourlyRate || "",
        photoUrl: uploadedPhotoUrl,
        dateOfBirth: parsedEmployeeProfile.dateOfBirth || "",
        streetAddress: parsedEmployeeProfile.streetAddress || "",
        city: parsedEmployeeProfile.city || "",
        province: parsedEmployeeProfile.province || "",
        phoneNumber: parsedEmployeeProfile.phoneNumber || "",
        workExperiences: Array.isArray(parsedEmployeeProfile.workExperiences) 
          ? parsedEmployeeProfile.workExperiences 
          : [],
        educations: Array.isArray(parsedEmployeeProfile.educations) 
          ? parsedEmployeeProfile.educations 
          : [],
        portfolioProjects: Array.isArray(parsedEmployeeProfile.portfolioProjects) 
          ? parsedEmployeeProfile.portfolioProjects 
          : [],
        rating: 0,
        totalReviews: 0,
      };
      userDoc.employerProfile = {};
      
      console.log("✅ Employee profile prepared");
      
    } else {
      // ✅ FIXED: Properly assign employer profile with ALL fields
      userDoc.employerProfile = {
        companyName: parsedEmployerProfile.companyName || "",
        logoUrl: uploadedPhotoUrl || parsedEmployerProfile.logoUrl || "",
        industry: parsedEmployerProfile.industry || "",
        city: parsedEmployerProfile.city || "",
        country: parsedEmployerProfile.country || country,
        companySize: parsedEmployerProfile.companySize || "",
        workModel: parsedEmployerProfile.workModel || "",
        phone: parsedEmployerProfile.phone || "",
        companyEmail: parsedEmployerProfile.companyEmail || "",
        website: parsedEmployerProfile.website || "",
        linkedin: parsedEmployerProfile.linkedin || "",
        about: parsedEmployerProfile.about || "",
        mission: parsedEmployerProfile.mission || "",
        cultureTags: Array.isArray(parsedEmployerProfile.cultureTags) 
          ? parsedEmployerProfile.cultureTags 
          : [],
        teamMembers: Array.isArray(parsedEmployerProfile.teamMembers) 
          ? parsedEmployerProfile.teamMembers 
          : [],
        isVerifiedEmployer: false,
        rating: 0,
        sizeLabel: parsedEmployerProfile.companySize || "",
      };
      userDoc.employeeProfile = {};
      
      console.log("✅ Employer profile prepared:", {
        companyName: userDoc.employerProfile.companyName,
        industry: userDoc.employerProfile.industry,
        city: userDoc.employerProfile.city,
        cultureTagsCount: userDoc.employerProfile.cultureTags.length,
        teamMembersCount: userDoc.employerProfile.teamMembers.length,
      });
    }

    const user = await User.create(userDoc);
    const token = signToken(user);

    console.log("✅ User created with ID:", user._id);
    console.log("✅ Role:", user.role);

    return res.status(201).json({
      message: "Registered successfully",
      token,
      user: user.toJSON(),
    });
    
  } catch (err) {
    console.error("❌ REGISTER_ERROR:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};
// ✅ UPDATED: Login function with image and name
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

    // ✅ Get image URL based on role
    let imageUrl = '';
    if (user.role === 'employee') {
      imageUrl = user.employeeProfile?.photoUrl || '';
    } else {
      imageUrl = user.employerProfile?.logoUrl || '';
    }

    // ✅ Prepare user response with all necessary fields
    const userResponse = {
      _id: user._id,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      country: user.country,
      status: user.status,
      pointsBalance: user.pointsBalance,
      imageUrl: imageUrl, // ✅ Add image URL
      // Include full profiles if needed
      employeeProfile: user.employeeProfile,
      employerProfile: user.employerProfile,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    return res.status(200).json({
      message: "Login successful",
      token,
      user: userResponse, // ✅ Send enhanced user object
    });
    
  } catch (err) {
    console.error("LOGIN_ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
// ✅ UPDATED: Google Auth function with image
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

    // ✅ Get image URL based on role
    let imageUrl = '';
    if (user.role === 'employee') {
      imageUrl = user.employeeProfile?.photoUrl || '';
    } else {
      imageUrl = user.employerProfile?.logoUrl || '';
    }

    // ✅ Prepare user response
    const userResponse = {
      _id: user._id,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      country: user.country,
      status: user.status,
      pointsBalance: user.pointsBalance,
      imageUrl: imageUrl, // ✅ Add image URL
      employeeProfile: user.employeeProfile,
      employerProfile: user.employerProfile,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    return res.status(200).json({
      message: "Google auth successful",
      token,
      user: userResponse, // ✅ Send enhanced user object
    });
    
  } catch (err) {
    console.error("GOOGLE_AUTH_ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};