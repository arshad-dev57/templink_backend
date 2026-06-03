const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  category: {
    type: String,
    enum: [
      'coin_purchase',      // Buying coins via Stripe
      'proposal_submission', // Spending coins on proposals
      'withdrawal',          // Withdrawing money
      'refund',              // Refund from failed proposal
      'bonus',               // Bonus coins
      'wallet_deposit',      // Direct wallet deposit (from Stripe)
      'wallet_withdrawal'    // Withdrawal from wallet
    ],
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
  // For coin transactions
  coins: {
    type: Number,
    default: 0
  },
  // For money transactions
  money: {
    type: Number,
    default: 0
  },
  // Balance after transaction
  pointsBalanceAfter: {
    type: Number,
    default: 0
  },
  walletBalanceAfter: {
    type: Number,
    default: 0
  },
  description: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  reference: {
    type: String,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  }
}, {
  timestamps: true
});

// Indexes
TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ reference: 1 });
TransactionSchema.index({ category: 1 });

module.exports = mongoose.model('Transaction', TransactionSchema);