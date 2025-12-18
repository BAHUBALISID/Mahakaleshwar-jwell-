const mongoose = require('mongoose');

const exchangeItemSchema = new mongoose.Schema({
  metalType: {
    type: String,
    enum: ['gold', 'silver'],
    required: true
  },
  purity: {
    type: String,
    enum: ['24K', '22K', '18K', '999', '925'],
    required: true
  },
  weight: {
    type: Number,
    required: true,
    min: 0
  },
  wastageDeduction: {
    type: Number,
    default: 0,
    min: 0
  },
  ratePerKg: {
    type: Number,
    required: true,
    min: 0
  },
  ratePerGram: {
    type: Number,
    required: true,
    min: 0
  },
  metalValue: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    trim: true
  }
});

const billSchema = new mongoose.Schema({
  billNumber: {
    type: String,
    required: true,
    unique: true
  },
  billType: {
    type: String,
    enum: ['sale', 'exchange', 'sale_exchange'],
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  customerPhone: {
    type: String,
    trim: true
  },
  customerAddress: {
    type: String,
    trim: true
  },
  // Sale items
  items: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item'
  }],
  // Exchange items (old items)
  exchangeItems: [exchangeItemSchema],
  
  // Totals
  totalMetalValue: {
    type: Number,
    required: true,
    min: 0
  },
  totalMakingCharge: {
    type: Number,
    required: true,
    min: 0
  },
  totalBeforeTax: {
    type: Number,
    required: true,
    min: 0
  },
  cgstAmount: {
    type: Number,
    required: true,
    min: 0
  },
  sgstAmount: {
    type: Number,
    required: true,
    min: 0
  },
  totalTax: {
    type: Number,
    required: true,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  totalExchangeValue: {
    type: Number,
    default: 0,
    min: 0
  },
  netPayable: {
    type: Number,
    required: true
  },
  balanceType: {
    type: String,
    enum: ['payable', 'refundable', 'zero'],
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'bank_transfer'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'pending', 'partial'],
    default: 'paid'
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  dueAmount: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for faster queries
billSchema.index({ billNumber: 1 });
billSchema.index({ date: -1 });
billSchema.index({ customerName: 1 });
billSchema.index({ customerPhone: 1 });

module.exports = mongoose.model('Bill', billSchema);
