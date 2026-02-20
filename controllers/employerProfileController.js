const User = require("../models/user_model");
const Project = require("../models/project");
const mongoose = require("mongoose");

// ==================== GET EMPLOYER PROFILE ====================
exports.getEmployerProfile = async (req, res) => {
  try {
    console.log("\n🟡 ===== GET EMPLOYER PROFILE STARTED =====");
    
    const employerId = req.user.id;
    console.log("👤 Employer ID:", employerId);

    const user = await User.findById(employerId).select('-passwordHash');
    
    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    if (user.role !== 'employer') {
      console.log("❌ User is not an employer");
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. User is not an employer." 
      });
    }

    console.log("✅ Employer profile fetched successfully");
    
    // Get project stats
    const totalProjects = await Project.countDocuments({ postedBy: employerId });
    const activeProjects = await Project.countDocuments({ 
      postedBy: employerId, 
      status: { $in: ['OPEN', 'IN_PROGRESS', 'AWAITING_FUNDING'] } 
    });
    const completedProjects = await Project.countDocuments({ 
      postedBy: employerId, 
      status: 'COMPLETED' 
    });

    // Structure response for frontend
    const profileData = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      country: user.country,
      pointsBalance: user.pointsBalance,
      employerProfile: user.employerProfile || {},
      createdAt: user.createdAt,
      stats: {
        totalProjects,
        activeProjects,
        completedProjects,
        totalHired: 1200, // You can calculate this from proposals
        rating: user.employerProfile?.rating || 4.8,
      }
    };

    return res.status(200).json({
      success: true,
      profile: profileData
    });

  } catch (error) {
    console.error("❌ Error in getEmployerProfile:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// ==================== UPDATE EMPLOYER PROFILE ====================
exports.updateEmployerProfile = async (req, res) => {
  try {
    console.log("\n🟡 ===== UPDATE EMPLOYER PROFILE STARTED =====");
    
    const employerId = req.user.id;
    console.log("👤 Employer ID:", employerId);

    const user = await User.findById(employerId);
    
    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    if (user.role !== 'employer') {
      console.log("❌ User is not an employer");
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. User is not an employer." 
      });
    }

    // Get data from request body
    const {
      companyName,
      industry,
      city,
      country,
      companySize,
      logoUrl,
      about,
      mission,
      cultureTags,
      teamMembers,
      phone,
      companyEmail,
      website,
      linkedin,
      workModel,
      isVerifiedEmployer,
      rating
    } = req.body;

    console.log("📦 Updating employer fields");

    // Update employer profile
    const updateData = {};

    if (companyName !== undefined) updateData['employerProfile.companyName'] = companyName;
    if (industry !== undefined) updateData['employerProfile.industry'] = industry;
    if (city !== undefined) updateData['employerProfile.city'] = city;
    if (country !== undefined) updateData['employerProfile.country'] = country;
    if (companySize !== undefined) updateData['employerProfile.companySize'] = companySize;
    if (logoUrl !== undefined) updateData['employerProfile.logoUrl'] = logoUrl;
    if (about !== undefined) updateData['employerProfile.about'] = about;
    if (mission !== undefined) updateData['employerProfile.mission'] = mission;
    if (workModel !== undefined) updateData['employerProfile.workModel'] = workModel;
    if (phone !== undefined) updateData['employerProfile.phone'] = phone;
    if (companyEmail !== undefined) updateData['employerProfile.companyEmail'] = companyEmail;
    if (website !== undefined) updateData['employerProfile.website'] = website;
    if (linkedin !== undefined) updateData['employerProfile.linkedin'] = linkedin;
    if (isVerifiedEmployer !== undefined) updateData['employerProfile.isVerifiedEmployer'] = isVerifiedEmployer;
    if (rating !== undefined) updateData['employerProfile.rating'] = rating;
    
    // Handle arrays
    if (cultureTags !== undefined) {
      updateData['employerProfile.cultureTags'] = Array.isArray(cultureTags) ? cultureTags : JSON.parse(cultureTags);
    }
    
    if (teamMembers !== undefined) {
      updateData['employerProfile.teamMembers'] = Array.isArray(teamMembers) ? teamMembers : JSON.parse(teamMembers);
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      employerId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    console.log("✅ Profile updated successfully");

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      profile: {
        id: updatedUser._id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        country: updatedUser.country,
        pointsBalance: updatedUser.pointsBalance,
        employerProfile: updatedUser.employerProfile || {}
      }
    });

  } catch (error) {
    console.error("❌ Error in updateEmployerProfile:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// ==================== UPLOAD COMPANY LOGO ====================
exports.uploadCompanyLogo = async (req, res) => {
  try {
    console.log("\n🟡 ===== UPLOAD COMPANY LOGO STARTED =====");
    
    const employerId = req.user.id;
    console.log("👤 Employer ID:", employerId);

    if (!req.file) {
      console.log("❌ No file uploaded");
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    console.log("📦 File received:", {
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size
    });

    // Update user with logo URL
    const updatedUser = await User.findByIdAndUpdate(
      employerId,
      { 
        $set: { 
          'employerProfile.logoUrl': req.file.path 
        } 
      },
      { new: true }
    ).select('-passwordHash');

    console.log("✅ Company logo uploaded successfully");

    return res.status(200).json({
      success: true,
      message: "Company logo uploaded successfully",
      logoUrl: req.file.path,
      profile: {
        id: updatedUser._id,
        employerProfile: updatedUser.employerProfile
      }
    });

  } catch (error) {
    console.error("❌ Error in uploadCompanyLogo:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// ==================== ADD TEAM MEMBER ====================
exports.addTeamMember = async (req, res) => {
  try {
    console.log("\n🟡 ===== ADD TEAM MEMBER STARTED =====");
    
    const employerId = req.user.id;
    const { name, role, email, avatarColor } = req.body;

    console.log("📦 Team member data:", { name, role });

    const user = await User.findById(employerId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // Initialize teamMembers if not exists
    if (!user.employerProfile.teamMembers) {
      user.employerProfile.teamMembers = [];
    }

    // Add new team member
    const newMember = {
      name,
      role,
      email,
      avatarColor: avatarColor || '#14A800',
      addedAt: new Date()
    };

    user.employerProfile.teamMembers.push(newMember);
    await user.save();

    console.log("✅ Team member added successfully");

    return res.status(201).json({
      success: true,
      message: "Team member added successfully",
      teamMember: newMember,
      teamMembers: user.employerProfile.teamMembers
    });

  } catch (error) {
    console.error("❌ Error in addTeamMember:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// ==================== REMOVE TEAM MEMBER ====================
exports.removeTeamMember = async (req, res) => {
  try {
    console.log("\n🟡 ===== REMOVE TEAM MEMBER STARTED =====");
    
    const employerId = req.user.id;
    const { memberIndex } = req.params;

    const user = await User.findById(employerId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // Remove team member by index
    if (user.employerProfile.teamMembers && 
        user.employerProfile.teamMembers[memberIndex]) {
      user.employerProfile.teamMembers.splice(memberIndex, 1);
      await user.save();
    }

    console.log("✅ Team member removed successfully");

    return res.status(200).json({
      success: true,
      message: "Team member removed successfully",
      teamMembers: user.employerProfile.teamMembers
    });

  } catch (error) {
    console.error("❌ Error in removeTeamMember:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};