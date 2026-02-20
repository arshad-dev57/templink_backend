// models/Payment.js
const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  paymentIntentId: {
    type: String,
    required: true,
    unique: true
  },
  clientSecret: String,
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'usd'
  },
  status: {
    type: String,
    enum: [
      'requires_payment_method',
      'requires_confirmation',
      'requires_action',
      'processing',
      'succeeded',
      'canceled'
    ],
    default: 'requires_payment_method'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  milestoneId: {
    type: mongoose.Schema.Types.ObjectId
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'google_pay', 'apple_pay', 'wallet']
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  receiptUrl: String,
  refunded: {
    type: Boolean,
    default: false
  },
  refundAmount: Number,
  refundReason: String
}, { timestamps: true });

// Indexes
PaymentSchema.index({ paymentIntentId: 1 });
PaymentSchema.index({ userId: 1, createdAt: -1 });
PaymentSchema.index({ projectId: 1 });

module.exports = mongoose.model('Payment', PaymentSchema);