const Contract = require('../models/Contract');
const Project = require('../models/project');

// ==================== GET CONTRACT DETAILS ====================
exports.getContract = async (req, res) => {
  try {
    const { contractId } = req.params;
    const userId = req.user.id;

    const contract = await Contract.findById(contractId)
      .populate('employerId', 'firstName lastName email companyName employerProfile')
      .populate('employeeId', 'firstName lastName email employeeProfile'); // 👈 employee

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    // Check if user is part of this contract
    if (contract.employerId._id.toString() !== userId && 
        contract.employeeId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this contract'
      });
    }

    return res.status(200).json({
      success: true,
      contract
    });

  } catch (error) {
    console.error('Get contract error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== EMPLOYER SIGN CONTRACT ====================
exports.employerSignContract = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { signature } = req.body;
    const employerId = req.user.id;

    const contract = await Contract.findById(contractId);

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    // Verify employer
    if (contract.employerId.toString() !== employerId) {
      return res.status(403).json({
        success: false,
        message: 'Only employer can sign this contract'
      });
    }

    // Check current status
    if (contract.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: `Contract cannot be signed. Current status: ${contract.status}`
      });
    }

    // Update employer signature
    contract.signatures.employer = {
      signed: true,
      signedAt: new Date(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      signature: signature
    };

    // Update status - waiting for employee
    contract.status = 'PENDING_EMPLOYEE_SIGN';
    await contract.save();

    return res.status(200).json({
      success: true,
      message: 'Contract signed by employer. Waiting for employee signature.',
      contract
    });

  } catch (error) {
    console.error('Employer sign contract error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== EMPLOYEE SIGN CONTRACT ====================
exports.employeeSignContract = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { signature } = req.body;
    const employeeId = req.user.id;

    const contract = await Contract.findById(contractId);

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    // Verify employee
    if (contract.employeeId.toString() !== employeeId) {
      return res.status(403).json({
        success: false,
        message: 'Only assigned employee can sign this contract'
      });
    }

    // Check current status
    if (contract.status !== 'PENDING_EMPLOYEE_SIGN') {
      return res.status(400).json({
        success: false,
        message: `Contract cannot be signed. Current status: ${contract.status}`
      });
    }

    // Check if employer already signed
    if (!contract.signatures.employer.signed) {
      return res.status(400).json({
        success: false,
        message: 'Employer has not signed the contract yet'
      });
    }

    // Update employee signature
    contract.signatures.employee = {
      signed: true,
      signedAt: new Date(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      signature: signature
    };

    // Both signed, contract becomes ACTIVE
    contract.status = 'ACTIVE';
    contract.signedAt = new Date();

    // Update project
    await Project.findByIdAndUpdate(contract.projectId, {
      status: 'IN_PROGRESS',
      'acceptedProposal.contractSigned': true,
      'acceptedProposal.contractSignedAt': new Date(),
      $set: { 'milestones.0.isLocked': false } // First milestone unlocked
    });

    await contract.save();

    return res.status(200).json({
      success: true,
      message: 'Contract signed successfully! Project is now active.',
      contract
    });

  } catch (error) {
    console.error('Employee sign contract error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== GET USER CONTRACTS ====================
exports.getUserContracts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, role } = req.query;

    let query = {};
    
    if (role === 'employer') {
      query.employerId = userId;
    } else if (role === 'employee') {
      query.employeeId = userId;
    } else {
      // Both roles
      query = {
        $or: [
          { employerId: userId },
          { employeeId: userId }
        ]
      };
    }

    if (status) {
      query.status = status;
    }

    const contracts = await Contract.find(query)
      .populate('employerId', 'firstName lastName employerProfile.companyName')
      .populate('employeeId', 'firstName lastName employeeProfile.title')
      .populate('projectId', 'title category maxBudget')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: contracts.length,
      contracts
    });

  } catch (error) {
    console.error('Get user contracts error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== GET CONTRACT BY PROJECT ====================
exports.getContractByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    const contract = await Contract.findOne({ projectId })
      .populate('employerId', 'firstName lastName companyName')
      .populate('employeeId', 'firstName lastName employeeProfile');

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'No contract found for this project'
      });
    }

    // Check authorization
    if (contract.employerId._id.toString() !== userId && 
        contract.employeeId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    return res.status(200).json({
      success: true,
      contract
    });

  } catch (error) {
    console.error('Get contract by project error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== DOWNLOAD CONTRACT PDF ====================
exports.downloadContractPDF = async (req, res) => {
  try {
    const { contractId } = req.params;
    const userId = req.user.id;

    console.log(`🟡 Downloading contract PDF: ${contractId} for user: ${userId}`);

    const contract = await Contract.findById(contractId)
      .populate('employerId', 'firstName lastName employerProfile')
      .populate('employeeId', 'firstName lastName employeeProfile')
      .populate('projectId', 'title');

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    // Check authorization
    if (contract.employerId._id.toString() !== userId && 
        contract.employeeId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to download this contract'
      });
    }

    // For now, return contract data
    return res.status(200).json({
      success: true,
      message: 'PDF download endpoint - In production, this will return PDF file',
      contract: contract
    });

  } catch (error) {
    console.error('Download PDF error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};