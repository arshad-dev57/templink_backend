// models/Invoice.js
const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  
  type: {
    type: String,
    enum: ['INVOICE', 'RECEIPT'],
    required: true
  },
  
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  projectTitle: String,
  
  employerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  employerName: String,
  employerCompany: String,
  employerEmail: String,
  
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  employeeName: String,
  employeeEmail: String,
  
  contractId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract'
  },
  contractNumber: String,
  
  milestones: [{
    milestoneId: mongoose.Schema.Types.ObjectId,
    title: String,
    amount: Number,
    releasedAt: Date
  }],
  
  subtotal: Number,
  platformFee: Number,
  total: Number,
  
  status: {
    type: String,
    enum: ['PAID', 'PENDING', 'CANCELLED'],
    default: 'PAID'
  },
  
  issuedAt: Date,
  dueDate: Date,
  paidAt: Date
  
}, { timestamps: true });

InvoiceSchema.index({ projectId: 1 });
InvoiceSchema.index({ employerId: 1 });
InvoiceSchema.index({ employeeId: 1 });
InvoiceSchema.index({ invoiceNumber: 1 });

module.exports = mongoose.model('Invoice', InvoiceSchema);