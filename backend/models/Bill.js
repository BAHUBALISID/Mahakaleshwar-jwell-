const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema({
  productName: {
    type: String,
    required: true,
    trim: true
  },
  productImage: {
    type: String,
    required: true
  },
  unit: {
    type: String,
    enum: ['PCS', 'GM'],
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  grossWeight: {
    type: Number,
    required: true,
    min: 0
  },
  lessWeight: {
    type: Number,
    default: 0,
    min: 0
  },
  netWeight: {
    type: Number,
    required: true,
    min: 0
  },
  metalType: {
    type: String,
    required: true
  },
  purity: {
    type: String,
    required: true
  },
  rate: {
    type: Number,
    required: true,
    min: 0
  },
  makingChargeType: {
    type: String,
    enum: ['FIX', '%', 'GRM'],
    required: true
  },
  makingChargeValue: {
    type: Number,
    required: true,
    min: 0
  },
  discountOnMaking: {
    type: Number,
    default: 0,
    min: 0
  },
  huid: {
    type: String,
    trim: true
  },
  tunch: {
    type: String,
    trim: true
  },
  otherCharges: {
    type: Number,
    default: 0,
    min: 0
  },
  notes: {
    type: String,
    trim: true
  },
  publicToken: {
    type: String,
    unique: true,
    sparse: true
  },
  isExchange: {
    type: Boolean,
    default: false
  },
  exchangeDeduction: {
    type: Number,
    default: 0,
    min: 0
  }
});

const billSchema = new mongoose.Schema({
  billNumber: {
    type: String,
    required: true,
    unique: true
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  customerPhone: {
    type: String,
    required: true
  },
  customerAddress: {
    type: String,
    trim: true
  },
  items: [billItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  cgst: {
    type: Number,
    default: 0,
    min: 0
  },
  sgst: {
    type: Number,
    default: 0,
    min: 0
  },
  igst: {
    type: Number,
    default: 0,
    min: 0
  },
  totalGst: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
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
  billDate: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pdfPath: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for faster queries
billSchema.index({ billNumber: 1 });
billSchema.index({ customerPhone: 1 });
billSchema.index({ billDate: -1 });
billSchema.index({ 'items.metalType': 1 });
billSchema.index({ 'items.purity': 1 });

const Bill = mongoose.model('Bill', billSchema);

module.exports = Bill;
