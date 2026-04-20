const Project = require("../models/project");
const User = require("../models/user_model");
const JobApplication = require('../models/JobApplication');
const JobPost = require('../models/jobpost');
const mongoose = require("mongoose");

// ==================== GET EMPLOYER PROFILE WITH TEAM MEMBERS ====================
exports.getEmployerProfile = async (req, res) => {
  try {
    console.log("\n🟡 ===== GET EMPLOYER PROFILE STARTED =====");
    
    const employerId = req.user.id;
    console.log("👤 Employer ID:", employerId);

    // Get employer with populated team members
    const user = await User.findById(employerId)
      .select('-passwordHash')
      .populate({
        path: 'employerProfile.teamMembers.employeeId',
        select: 'firstName lastName email employeeProfile.photoUrl employeeProfile.title employeeProfile.rating employeeProfile.skills employeeProfile.hourlyRate'
      })
      .populate({
        path: 'employerProfile.teamMembers.jobId',
        select: 'title location type'
      });
    
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
    const totalProjects = await JobPost.countDocuments({ postedBy: employerId });
    const activeProjects = await JobPost.countDocuments({ 
      postedBy: employerId, 
      status: { $in: ['OPEN', 'IN_PROGRESS'] } 
    });
    const completedProjects = await JobPost.countDocuments({ 
      postedBy: employerId, 
      status: 'COMPLETED' 
    });

    // Get hiring stats
    const totalHired = await JobApplication.countDocuments({ 
      employerId: employerId, 
      status: 'hired' 
    });
    
    const activeHired = await JobApplication.countDocuments({ 
      employerId: employerId, 
      status: 'hired',
      employmentStatus: 'active'
    });

    // Process team members for response
    const teamMembers = user.employerProfile?.teamMembers || [];
    
    // Separate active and past members
    const activeMembers = teamMembers
      .filter(m => m.status === 'active')
      .map(member => ({
        id: member._id,
        employee: {
          id: member.employeeId?._id,
          name: member.employeeId ? `${member.employeeId.firstName} ${member.employeeId.lastName}` : 'Unknown',
          photoUrl: member.employeeId?.employeeProfile?.photoUrl || '',
          title: member.employeeId?.employeeProfile?.title || member.jobTitle,
          rating: member.employeeId?.employeeProfile?.rating || 0,
          skills: member.employeeId?.employeeProfile?.skills || [],
          hourlyRate: member.employeeId?.employeeProfile?.hourlyRate || ''
        },
        job: {
          id: member.jobId?._id,
          title: member.jobTitle,
          location: member.jobId?.location,
          type: member.jobId?.type
        },
        hiredAt: member.hiredAt,
        commissionPaid: member.commissionPaid,
        isFreeHire: member.isFreeHire
      }));

    const pastMembers = teamMembers
      .filter(m => m.status === 'left' || m.status === 'terminated')
      .map(member => ({
        id: member._id,
        employee: {
          id: member.employeeId?._id,
          name: member.employeeId ? `${member.employeeId.firstName} ${member.employeeId.lastName}` : 'Unknown',
          photoUrl: member.employeeId?.employeeProfile?.photoUrl || ''
        },
        job: {
          title: member.jobTitle
        },
        hiredAt: member.hiredAt,
        leftAt: member.leftAt,
        leftReason: member.leftReason,
        status: member.status
      }));

    // Structure response for frontend
    const profileData = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      country: user.country,
      pointsBalance: user.pointsBalance,
      employerProfile: {
        ...user.employerProfile,
        // Override team members with processed data
        teamMembers: activeMembers, // Send only active members in main team list
        pastMembers: pastMembers,
        stats: {
          totalHires: user.employerProfile?.totalHires || 0,
          activeEmployees: user.employerProfile?.activeEmployees || 0,
          pastEmployees: pastMembers.length
        }
      },
      createdAt: user.createdAt,
      stats: {
        totalProjects,
        activeProjects,
        completedProjects,
        totalHired: totalHired,
        activeHired: activeHired,
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

// ==================== GET TEAM MEMBERS ONLY ====================
exports.getTeamMembers = async (req, res) => {
  try {
    const employerId = req.user.id;

    const employer = await User.findById(employerId)
      .populate({
        path: 'employerProfile.teamMembers.employeeId',
        select: 'firstName lastName email employeeProfile.photoUrl employeeProfile.title employeeProfile.rating employeeProfile.skills employeeProfile.hourlyRate'
      })
      .populate({
        path: 'employerProfile.teamMembers.jobId',
        select: 'title location type salaryAmount'
      });

    if (!employer || employer.role !== 'employer') {
      return res.status(403).json({
        success: false,
        message: 'Only employers can access'
      });
    }

    const teamMembers = employer.employerProfile?.teamMembers || [];
    
    // Separate active and past members
    const activeMembers = teamMembers.filter(m => m.status === 'active');
    const pastMembers = teamMembers.filter(m => m.status === 'left' || m.status === 'terminated');

    // Format response
    const formattedActive = activeMembers.map(member => ({
      id: member._id,
      employee: {
        id: member.employeeId?._id,
        name: member.employeeId ? `${member.employeeId.firstName} ${member.employeeId.lastName}` : 'Unknown',
        photoUrl: member.employeeId?.employeeProfile?.photoUrl || '',
        title: member.employeeId?.employeeProfile?.title || member.jobTitle,
        rating: member.employeeId?.employeeProfile?.rating || 0,
        skills: member.employeeId?.employeeProfile?.skills || [],
        hourlyRate: member.employeeId?.employeeProfile?.hourlyRate || '',
        email: member.employeeId?.email
      },
      job: {
        id: member.jobId?._id,
        title: member.jobTitle,
        location: member.jobId?.location,
        type: member.jobId?.type,
        salaryAmount: member.jobId?.salaryAmount
      },
      hiredAt: member.hiredAt,
      commissionPaid: member.commissionPaid,
      isFreeHire: member.isFreeHire
    }));

    const formattedPast = pastMembers.map(member => ({
      id: member._id,
      employee: {
        id: member.employeeId?._id,
        name: member.employeeId ? `${member.employeeId.firstName} ${member.employeeId.lastName}` : 'Unknown',
        photoUrl: member.employeeId?.employeeProfile?.photoUrl || ''
      },
      job: {
        title: member.jobTitle
      },
      hiredAt: member.hiredAt,
      leftAt: member.leftAt,
      leftReason: member.leftReason,
      status: member.status
    }));

    res.json({
      success: true,
      stats: {
        total: teamMembers.length,
        active: activeMembers.length,
        past: pastMembers.length
      },
      activeMembers: formattedActive,
      pastMembers: formattedPast
    });

  } catch (error) {
    console.error('Error getting team members:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
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