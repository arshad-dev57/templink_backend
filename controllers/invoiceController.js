// controllers/invoiceController.js
const Invoice = require('../models/Invoice');
const Project = require('../models/project');
const User = require('../models/user_model');
const Contract = require('../models/Contract');
const mongoose = require('mongoose');

// ==================== GENERATE INVOICE ====================
exports.generateInvoice = async (projectId) => {
  try {
    console.log(`📄 Generating invoice for project: ${projectId}`);

    // Check if invoice already exists
    const existingInvoice = await Invoice.findOne({ 
      projectId: projectId,
      type: 'INVOICE'
    });

    if (existingInvoice) {
      console.log(`📄 Invoice already exists for project: ${projectId}`);
      return existingInvoice;
    }

    // Get project details
    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Get employer details
    const employer = await User.findById(project.postedBy);
    if (!employer) {
      throw new Error('Employer not found');
    }
    
    // Get contract to find employee
    const contract = await Contract.findOne({ 
      projectId: projectId,
      status: { $in: ['ACTIVE', 'COMPLETED'] }
    }).populate('employeeId');

    if (!contract) {
      throw new Error('Contract not found');
    }

    // Generate unique invoice number
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const count = await Invoice.countDocuments() + 1;
    const invoiceNumber = `INV-${year}${month}-${String(count).padStart(4, '0')}`;

    // Calculate totals
    const subtotal = project.totalPaid || 0;
    const platformFee = subtotal * 0.1; // 10% platform fee
    const total = subtotal + platformFee;

    // Create invoice for employer
    const employerInvoice = await Invoice.create({
      invoiceNumber,
      type: 'INVOICE',
      projectId: project._id,
      projectTitle: project.title,
      
      employerId: employer._id,
      employerName: `${employer.firstName} ${employer.lastName}`,
      employerCompany: employer.employerProfile?.companyName || 'N/A',
      employerEmail: employer.email,
      
      employeeId: contract.employeeId._id,
      employeeName: `${contract.employeeId.firstName} ${contract.employeeId.lastName}`,
      employeeEmail: contract.employeeId.email,
      
      contractId: contract._id,
      contractNumber: contract.contractNumber,
      
      milestones: project.milestones.map(m => ({
        milestoneId: m._id,
        title: m.title,
        amount: m.amount,
        releasedAt: m.releasedAt
      })),
      
      subtotal,
      platformFee,
      total,
      
      status: 'PAID',
      issuedAt: new Date(),
      dueDate: new Date()
    });

    // Create receipt for employee
    const receiptNumber = `RCP-${year}${month}-${String(count).padStart(4, '0')}`;
    
    const employeeReceipt = await Invoice.create({
      invoiceNumber: receiptNumber,
      type: 'RECEIPT',
      projectId: project._id,
      projectTitle: project.title,
      
      employerId: employer._id,
      employerName: `${employer.firstName} ${employer.lastName}`,
      employerCompany: employer.employerProfile?.companyName || 'N/A',
      employerEmail: employer.email,
      
      employeeId: contract.employeeId._id,
      employeeName: `${contract.employeeId.firstName} ${contract.employeeId.lastName}`,
      employeeEmail: contract.employeeId.email,
      
      contractId: contract._id,
      contractNumber: contract.contractNumber,
      
      milestones: project.milestones.map(m => ({
        milestoneId: m._id,
        title: m.title,
        amount: m.amount,
        releasedAt: m.releasedAt
      })),
      
      subtotal,
      platformFee,
      total: subtotal, // Employee gets subtotal (without fee)
      
      status: 'PAID',
      issuedAt: new Date()
    });

    console.log(`✅ Invoices generated: ${employerInvoice.invoiceNumber} (Employer), ${employeeReceipt.invoiceNumber} (Employee)`);

    return {
      employerInvoice,
      employeeReceipt
    };

  } catch (error) {
    console.error('❌ Invoice generation error:', error);
    throw error;
  }
};

// ==================== GET MY INVOICES ====================
exports.getMyInvoices = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, page = 1, limit = 20 } = req.query;

    let query = {
      $or: [
        { employerId: userId },
        { employeeId: userId }
      ]
    };

    if (type) {
      query.type = type;
    }

    const invoices = await Invoice.find(query)
      .populate('projectId', 'title')
      .sort({ issuedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments(query);

    return res.status(200).json({
      success: true,
      count: invoices.length,
      total,
      invoices
    });

  } catch (error) {
    console.error('❌ Get my invoices error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== GET INVOICE BY ID ====================
exports.getInvoiceById = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user.id;

    const invoice = await Invoice.findById(invoiceId)
      .populate('projectId')
      .populate('employerId', 'firstName lastName email employerProfile')
      .populate('employeeId', 'firstName lastName email');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Check if user is authorized
    if (invoice.employerId._id.toString() !== userId && 
        invoice.employeeId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this invoice'
      });
    }

    return res.status(200).json({
      success: true,
      invoice
    });

  } catch (error) {
    console.error('❌ Get invoice error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== DOWNLOAD INVOICE PDF ====================
exports.downloadInvoicePDF = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user.id;

    const invoice = await Invoice.findById(invoiceId)
      .populate('projectId')
      .populate('employerId')
      .populate('employeeId');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Check authorization
    if (invoice.employerId._id.toString() !== userId && 
        invoice.employeeId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // TODO: Generate PDF using a library like pdfkit
    // For now, return invoice data
    return res.status(200).json({
      success: true,
      message: 'PDF download endpoint - PDF generation will be implemented',
      invoice
    });

  } catch (error) {
    console.error('❌ Download PDF error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== GET PROJECT INVOICE ====================
exports.getProjectInvoice = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // Verify project access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Find invoice for this project
    const invoice = await Invoice.findOne({
      projectId: projectId,
      $or: [
        { employerId: userId },
        { employeeId: userId }
      ]
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'No invoice found for this project'
      });
    }

    return res.status(200).json({
      success: true,
      invoice
    });

  } catch (error) {
    console.error('❌ Get project invoice error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// ==================== GET INVOICE STATISTICS ====================
exports.getInvoiceStatistics = async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await Invoice.aggregate([
      {
        $match: {
          $or: [
            { employerId: mongoose.Types.ObjectId(userId) },
            { employeeId: mongoose.Types.ObjectId(userId) }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalAmount: { $sum: '$total' },
          avgAmount: { $avg: '$total' },
          invoicesByType: {
            $push: {
              type: '$type',
              amount: '$total'
            }
          }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      statistics: stats[0] || {
        totalInvoices: 0,
        totalAmount: 0,
        avgAmount: 0,
        invoicesByType: []
      }
    });

  } catch (error) {
    console.error('❌ Get invoice statistics error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};