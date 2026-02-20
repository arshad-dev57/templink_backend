const User = require("../models/user_model");
const Proposal = require("../models/Proposal");
const Project = require("../models/project");
const PointsTransaction = require("../models/PointsTransaction");
const proposal = require("../models/Contract");
const mongoose = require("mongoose");

exports.getMyPoints = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("pointsBalance");

    res.status(200).json({
      points: user.pointsBalance,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



exports.createProposal = async (req, res) => {
  try {
    const {
      projectId,
      coverLetter,
      paymentMethod,
      fixedPrice,
      projectDuration,
      attachedFiles,
      selectedPortfolioProjects
    } = req.body;

    const employeeId = req.user.id;

    // 1️⃣ Check duplicate
    const existing = await Proposal.findOne({
      projectId,
      employeeId,
    });

    if (existing) {
      return res.status(400).json({
        message: "You already submitted proposal",
      });
    }

    // 2️⃣ Check points
    const user = await User.findById(employeeId);

    if (user.pointsBalance < 13) {
      return res.status(400).json({
        message: "Not enough points",
      });
    }

    const serviceFee = fixedPrice * 0.20;
    const youWillReceive = fixedPrice - serviceFee;

    // 3️⃣ Create Proposal
    const proposal = await Proposal.create({
      projectId,
      employeeId,
      coverLetter,
      paymentMethod,
      fixedPrice,
      projectDuration,
      serviceFee,
      youWillReceive,
      attachedFiles,
      selectedPortfolioProjects,
      pointsUsed: 13,
    });

    // 4️⃣ Deduct Points
    user.pointsBalance -= 13;
    await user.save();

    // 5️⃣ Record Transaction
    await PointsTransaction.create({
      userId: employeeId,
      type: "DEBIT",
      amount: 13,
      reason: "Proposal Submission",
      relatedProposalId: proposal._id,
    });

    // 6️⃣ Increment project proposal count
    await Project.findByIdAndUpdate(projectId, {
      $inc: { proposalsCount: 1 },
    });

    res.status(201).json({
      message: "Proposal submitted successfully",
      remainingPoints: user.pointsBalance,
      proposal,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.getMyProposals = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { status, search } = req.query;

    let filter = { employeeId };

    if (status && status !== "all") {
      filter.status = status;
    }

    // ✅ FIX: Populate both project and contract
    const proposals = await Proposal.find(filter)
      .populate({
        path: "projectId",
        select: "title minBudget maxBudget duration employerSnapshot proposalsCount status",
      })
      .populate({  // 👈 Add this to populate contract
        path: "contractId",
        model: "Contract",
        select: "status contractNumber signatures",
      })
      .sort({ createdAt: -1 });
    const transformedProposals = proposals.map(proposal => {
      const proposalObj = proposal.toObject();
      
      // Add contract data if exists
      if (proposal.contractId) {
        proposalObj.contract = {
          _id: proposal.contractId._id,
          status: proposal.contractId.status,
          contractNumber: proposal.contractId.contractNumber,
          signatures: proposal.contractId.signatures
        };
      }
      
      return proposalObj;
    });

    let result = transformedProposals;

    if (search) {
      const q = search.toLowerCase();
      result = transformedProposals.filter(p =>
        p.projectId?.title?.toLowerCase().includes(q)
      );
    }

    res.status(200).json({
      total: result.length,
      proposals: result,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const Contract = require('../models/Contract'); // Add this import
exports.acceptProposal = async (req, res) => {
  try {
    console.log("\n🟡 ===== ACCEPT PROPOSAL STARTED =====");
    console.log("📝 Request params:", req.params);
    console.log("👤 User ID:", req.user.id);
    
    const employerId = req.user.id;
    const { proposalId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(proposalId)) {
      console.log("❌ Invalid proposal ID format");
      return res.status(400).json({ message: "Invalid proposal ID" });
    }

    console.log("🔍 Finding proposal with ID:", proposalId);
    const proposal = await Proposal.findById(proposalId)
      .populate('employeeId', 'firstName lastName email');

    if (!proposal) {
      console.log("❌ Proposal not found in database");
      return res.status(404).json({ message: "Proposal not found" });
    }
    console.log("✅ Proposal found:", {
      id: proposal._id,
      employeeId: proposal.employeeId?._id,
      fixedPrice: proposal.fixedPrice
    });

    console.log("🔍 Finding project with ID:", proposal.projectId);
    const project = await Project.findById(proposal.projectId);

    if (!project) {
      console.log("❌ Project not found");
      return res.status(404).json({ message: "Project not found" });
    }
    console.log("✅ Project found:", {
      id: project._id,
      title: project.title,
      postedBy: project.postedBy,
      milestonesCount: project.milestones?.length || 0
    });

    console.log("🔍 Checking authorization...");
    console.log("Project postedBy:", project.postedBy.toString());
    console.log("Employer ID:", employerId);
    
    if (project.postedBy.toString() !== employerId) {
      console.log("❌ Unauthorized - Employer doesn't own this project");
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (project.status !== "OPEN") {
      console.log("❌ Project is not OPEN. Current status:", project.status);
      return res.status(400).json({
        message: "Project is not open for accepting proposals",
      });
    }

    // 1️⃣ Accept selected proposal
    console.log("📝 Updating proposal status to ACCEPTED...");
    proposal.status = "ACCEPTED";
    await proposal.save();
    console.log("✅ Proposal status updated");

    // 2️⃣ Reject all other proposals
    console.log("📝 Rejecting other proposals...");
    const rejectResult = await Proposal.updateMany(
      {
        projectId: project._id,
        _id: { $ne: proposalId },
        status: { $in: ["PENDING", "INTERVIEW"] }
      },
      { $set: { status: "REJECTED" } }
    );
    console.log(`✅ ${rejectResult.modifiedCount} other proposals rejected`);

    // 3️⃣ Update project with accepted proposal
    console.log("📝 Updating project with accepted proposal...");
    project.acceptedProposal = {
      proposalId: proposal._id,
      employeeId: proposal.employeeId._id,
      acceptedAt: new Date(),
      fixedPrice: proposal.fixedPrice,
      projectDuration: proposal.projectDuration
    };
    project.status = "AWAITING_FUNDING";
    await project.save();
    console.log("✅ Project updated");

    // 🆕 4️⃣ GENERATE CONTRACT
    console.log("\n📄 ===== CONTRACT GENERATION STARTED =====");
    
    const Contract = require('../models/Contract');

    const year = new Date().getFullYear();
    const timestamp = Date.now();
    const contractNumber = `CONT-${year}-${timestamp}`;
    console.log("📋 Generated contract number:", contractNumber);

    const contractData = {
      contractNumber: contractNumber,
      projectId: project._id,
      proposalId: proposal._id,
      employerId: employerId,
      employeeId: proposal.employeeId._id,
      
      projectSnapshot: {
        title: project.title,
        description: project.description,
        category: project.category,
        duration: project.duration,
        experienceLevel: project.experienceLevel,
        budgetType: project.budgetType,
        minBudget: project.minBudget,
        maxBudget: project.maxBudget,
        skills: project.skills,
        deliverables: project.deliverables
      },
      
      milestones: project.milestones.map((m, index) => ({
        title: m.title,
        description: m.description,
        amount: m.amount,
        dueDate: m.dueDate,
        sequence: index
      })),
      
      terms: {
        startDate: new Date(),
        endDate: new Date(Date.now() + (proposal.projectDuration || 30) * 24 * 60 * 60 * 1000),
        revisionCount: 2,
        intellectualProperty: 'TRANSFER_ON_FINAL_PAYMENT'
      },
      
      financialSummary: {
        totalAmount: proposal.fixedPrice || project.maxBudget,
        milestoneCount: project.milestones.length
      },
      
      status: 'DRAFT'
    };

    console.log("💾 Saving contract to database...");
    const contract = new Contract(contractData);
    await contract.save();
    console.log("✅ Contract saved successfully!");
    console.log("📄 Contract ID:", contract._id);

    // 🆕 5️⃣ UPDATE PROPOSAL WITH CONTRACT ID
    proposal.contractId = contract._id;
    await proposal.save();
    console.log("✅ Proposal updated with contract ID");

    console.log("\n🟢 ===== ACCEPT PROPOSAL COMPLETED =====");
    console.log("📤 Sending response to frontend...");

    res.status(200).json({
      success: true,
      message: "Proposal accepted. Contract generated.",
      data: {
        proposal,
        project,
        contract: {
          id: contract._id,
          contractNumber: contract.contractNumber,
          status: contract.status
        }
      }
    });

  } catch (error) {
    console.error("\n❌ ===== ERROR IN ACCEPT PROPOSAL =====");
    console.error("❌ Error name:", error.name);
    console.error("❌ Error message:", error.message);
    console.error("❌ Error stack:", error.stack);
    
    return res.status(500).json({
      message: "Failed to accept proposal",
      error: error.message,
    });
  }
};