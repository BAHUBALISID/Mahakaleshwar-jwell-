const mongoose = require('mongoose');

const stockTransactionSchema = new mongoose.Schema({
  transactionType: {
    type: String,
    enum: ['in', 'out', 'adjustment'],
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  weight: {
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
  productName: {
    type: String,
    trim: true
  },
  costPrice: {
    type: Number,
    min: 0
  },
  sellingPrice: {
    type: Number,
    min: 0
  },
  billNumber: {
    type: String
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

const stockSchema = new mongoose.Schema({
  metalType: {
    type: String,
    required: true,
    trim: true
  },
  purity: {
    type: String,
    required: true,
    trim: true
  },
  productName: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    default: 0,
    min: 0
  },
  weight: {
    type: Number,
    default: 0,
    min: 0
  },
  costPrice: {
    type: Number,
    min: 0
  },
  sellingReferencePrice: {
    type: Number,
    min: 0
  },
  lowStockThreshold: {
    type: Number,
    default: 5
  },
  isLowStock: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  transactions: [stockTransactionSchema]
}, {
  timestamps: true
});

// Compound unique index
stockSchema.index({ metalType: 1, purity: 1, productName: 1 }, { unique: true });

// Pre-save hook to check low stock
stockSchema.pre('save', function(next) {
  this.isLowStock = this.quantity <= this.lowStockThreshold;
  next();
});

const Stock = mongoose.model('Stock', stockSchema);

module.exports = Stock;
