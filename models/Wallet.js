 // models/Wallet.js
const mongoose = require('mongoose');

const WalletTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['CREDIT', 'DEBIT'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  balance: {
    type: Number,
    required: true // Balance after transaction
  },
  description: {
    type: String,
    required: true
  },
  reference: {
    type: String, // Payment intent ID, project ID, etc.
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'COMPLETED'
  }
}, { timestamps: true });

const WalletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastTransactionAt: Date
}, { timestamps: true });

// Indexes
WalletSchema.index({ userId: 1 });
WalletTransactionSchema.index({ userId: 1, createdAt: -1 });
WalletTransactionSchema.index({ reference: 1 });

module.exports = {
  Wallet: mongoose.model('Wallet', WalletSchema),
  WalletTransaction: mongoose.model('WalletTransaction', WalletTransactionSchema)
};