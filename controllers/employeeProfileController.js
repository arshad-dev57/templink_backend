const User = require("../models/user_model");
const mongoose = require("mongoose");

// ==================== GET EMPLOYEE PROFILE ====================
exports.getEmployeeProfile = async (req, res) => {
  try {
    console.log("\n🟡 ===== GET EMPLOYEE PROFILE STARTED =====");
    
    const employeeId = req.user.id;
    console.log("👤 Employee ID:", employeeId);

    const user = await User.findById(employeeId).select('-passwordHash');
    
    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    if (user.role !== 'employee') {
      console.log("❌ User is not an employee");
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. User is not an employee." 
      });
    }

    console.log("✅ Employee profile fetched successfully");
    
    // Structure response for frontend
    const profileData = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      country: user.country,
      pointsBalance: user.pointsBalance,
      employeeProfile: user.employeeProfile || {},
      createdAt: user.createdAt
    };

    return res.status(200).json({
      success: true,
      profile: profileData
    });

  } catch (error) {
    console.error("❌ Error in getEmployeeProfile:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// ==================== UPDATE EMPLOYEE PROFILE ====================
exports.updateEmployeeProfile = async (req, res) => {
  try {
    console.log("\n🟡 ===== UPDATE EMPLOYEE PROFILE STARTED =====");
    
    const employeeId = req.user.id;
    console.log("👤 Employee ID:", employeeId);

    const user = await User.findById(employeeId);
    
    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    if (user.role !== 'employee') {
      console.log("❌ User is not an employee");
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. User is not an employee." 
      });
    }

    // Get data from request body
    const {
      title,
      bio,
      hourlyRate,
      skills,
      experienceLevel,
      category,
      workExperiences,
      educations,
      portfolioProjects
    } = req.body;

    console.log("📦 Updating fields:", {
      title: title || 'not provided',
      hourlyRate: hourlyRate || 'not provided',
      skillsCount: skills?.length || 0
    });

    // Update employee profile
    const updateData = {};

    if (title !== undefined) updateData['employeeProfile.title'] = title;
    if (bio !== undefined) updateData['employeeProfile.bio'] = bio;
    if (hourlyRate !== undefined) updateData['employeeProfile.hourlyRate'] = hourlyRate;
    if (experienceLevel !== undefined) updateData['employeeProfile.experienceLevel'] = experienceLevel;
    if (category !== undefined) updateData['employeeProfile.category'] = category;
    
    // Handle arrays
    if (skills !== undefined) {
      updateData['employeeProfile.skills'] = Array.isArray(skills) ? skills : JSON.parse(skills);
    }
    
    if (workExperiences !== undefined) {
      updateData['employeeProfile.workExperiences'] = Array.isArray(workExperiences) 
        ? workExperiences 
        : JSON.parse(workExperiences);
    }
    
    if (educations !== undefined) {
      updateData['employeeProfile.educations'] = Array.isArray(educations) 
        ? educations 
        : JSON.parse(educations);
    }
    
    if (portfolioProjects !== undefined) {
      updateData['employeeProfile.portfolioProjects'] = Array.isArray(portfolioProjects) 
        ? portfolioProjects 
        : JSON.parse(portfolioProjects);
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      employeeId,
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
        employeeProfile: updatedUser.employeeProfile || {}
      }
    });

  } catch (error) {
    console.error("❌ Error in updateEmployeeProfile:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// ==================== UPLOAD PROFILE PICTURE ====================
exports.uploadProfilePicture = async (req, res) => {
  try {
    console.log("\n🟡 ===== UPLOAD PROFILE PICTURE STARTED =====");
    
    const employeeId = req.user.id;
    console.log("👤 Employee ID:", employeeId);

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

    // Update user with photo URL
    const updatedUser = await User.findByIdAndUpdate(
      employeeId,
      { 
        $set: { 
          'employeeProfile.photoUrl': req.file.path 
        } 
      },
      { new: true }
    ).select('-passwordHash');

    console.log("✅ Profile picture uploaded successfully");

    return res.status(200).json({
      success: true,
      message: "Profile picture uploaded successfully",
      photoUrl: req.file.path,
      profile: {
        id: updatedUser._id,
        employeeProfile: updatedUser.employeeProfile
      }
    });

  } catch (error) {
    console.error("❌ Error in uploadProfilePicture:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// ==================== ADD WORK EXPERIENCE ====================
exports.addWorkExperience = async (req, res) => {
  try {
    console.log("\n🟡 ===== ADD WORK EXPERIENCE STARTED =====");
    
    const employeeId = req.user.id;
    const {
      title,
      company,
      location,
      country,
      startYear,
      endYear,
      currentlyWorking,
      description
    } = req.body;

    console.log("📦 Work experience data:", { title, company, currentlyWorking });

    const user = await User.findById(employeeId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // Initialize workExperiences if not exists
    if (!user.employeeProfile.workExperiences) {
      user.employeeProfile.workExperiences = [];
    }

    // Add new experience
    const newExperience = {
      title,
      company,
      location,
      country,
      startYear,
      endYear: currentlyWorking ? null : endYear,
      currentlyWorking: currentlyWorking || false,
      description
    };

    user.employeeProfile.workExperiences.push(newExperience);
    await user.save();

    console.log("✅ Work experience added successfully");

    return res.status(201).json({
      success: true,
      message: "Work experience added successfully",
      workExperience: newExperience,
      workExperiences: user.employeeProfile.workExperiences
    });

  } catch (error) {
    console.error("❌ Error in addWorkExperience:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// ==================== UPDATE WORK EXPERIENCE ====================
exports.updateWorkExperience = async (req, res) => {
  try {
    console.log("\n🟡 ===== UPDATE WORK EXPERIENCE STARTED =====");
    
    const employeeId = req.user.id;
    const { experienceId } = req.params;
    const updateData = req.body;

    const user = await User.findById(employeeId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // Find experience index
    const expIndex = user.employeeProfile.workExperiences.findIndex(
      exp => exp._id.toString() === experienceId
    );

    if (expIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Work experience not found"
      });
    }

    // Update experience
    user.employeeProfile.workExperiences[expIndex] = {
      ...user.employeeProfile.workExperiences[expIndex].toObject(),
      ...updateData
    };

    await user.save();

    console.log("✅ Work experience updated successfully");

    return res.status(200).json({
      success: true,
      message: "Work experience updated successfully",
      workExperience: user.employeeProfile.workExperiences[expIndex]
    });

  } catch (error) {
    console.error("❌ Error in updateWorkExperience:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};

// ==================== DELETE WORK EXPERIENCE ====================
exports.deleteWorkExperience = async (req, res) => {
  try {
    console.log("\n🟡 ===== DELETE WORK EXPERIENCE STARTED =====");
    
    const employeeId = req.user.id;
    const { experienceId } = req.params;

    const user = await User.findById(employeeId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // Filter out the experience
    user.employeeProfile.workExperiences = user.employeeProfile.workExperiences.filter(
      exp => exp._id.toString() !== experienceId
    );

    await user.save();

    console.log("✅ Work experience deleted successfully");

    return res.status(200).json({
      success: true,
      message: "Work experience deleted successfully"
    });

  } catch (error) {
    console.error("❌ Error in deleteWorkExperience:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error"
    });
  }
};