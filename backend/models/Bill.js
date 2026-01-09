const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  // Basic item info
  product: String,
  unit: String,
  num: String,
  stmp: String,
  qty: {
    type: Number,
    default: 1,
    min: 1
  },
  
  // Weight details
  grWt: Number,
  less: Number,
  ntWt: Number,
  
  // Metal details
  metalType: String,
  purity: String,
  tnch: String,
  huid: String,
  huCrg: Number,
  
  // Making charges
  mk: {
    type: String,
    enum: ['FIX', '%', 'GRM']
  },
  mkCrg: Number,
  disMk: Number,
  
  // Rate and value
  rate: Number,
  metalValue: Number,
  makingCharges: Number,
  totalValue: Number,
  
  // Exchange specific fields
  isExchange: {
    type: Boolean,
    default: false
  },
  wastage: Number,
  meltingCharges: Number,
  
  // Metadata
  sequence: Number
});

const GSTSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    enum: ['CGST_SGST', 'IGST', 'NONE'],
    default: 'NONE'
  },
  cgstAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  sgstAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  igstAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalGST: {
    type: Number,
    default: 0,
    min: 0
  }
});

const BillSchema = new mongoose.Schema({
  // Bill identification
  billNumber: {
    type: String,
    required: true,
    unique: true
  },
  billDate: {
    type: Date,
    default: Date.now
  },
  
  // Customer details
  customer: {
    name: {
      type: String,
      required: true
    },
    mobile: {
      type: String,
      required: true
    },
    address: String,
    dob: Date,
    pan: String,
    aadhaar: String,
    gstin: String
  },
  
  // Items
  items: [ItemSchema],
  
  // Payment details
  paymentMode: {
    type: String,
    enum: ['cash', 'card', 'upi', 'bank_transfer', 'credit'],
    default: 'cash'
  },
  
  // GST
  gst: GSTSchema,
  
  // Discount
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Summary
  summary: {
    metalValue: {
      type: Number,
      default: 0
    },
    makingValue: {
      type: Number,
      default: 0
    },
    subTotal: {
      type: Number,
      default: 0
    },
    exchangeValue: {
      type: Number,
      default: 0
    },
    balancePayable: {
      type: Number,
      default: 0
    },
    balanceRefundable: {
      type: Number,
      default: 0
    },
    grandTotal: {
      type: Number,
      default: 0
    }
  },
  
  // QR Code
  qrCode: String,
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
BillSchema.index({ billNumber: 1 });
BillSchema.index({ 'customer.mobile': 1 });
BillSchema.index({ billDate: -1 });
BillSchema.index({ 'customer.name': 'text' });

// Virtual for formatted bill number
BillSchema.virtual('formattedBillNumber').get(function() {
  return `B${this.billNumber.toString().padStart(6, '0')}`;
});

// Pre-save middleware to calculate totals
BillSchema.pre('save', function(next) {
  // Calculate totals from items
  let metalValue = 0;
  let makingValue = 0;
  let exchangeValue = 0;
  
  this.items.forEach(item => {
    if (!item.isExchange) {
      metalValue += item.metalValue || 0;
      makingValue += item.makingCharges || 0;
    } else {
      exchangeValue += item.totalValue || 0;
    }
  });
  
  const subTotal = metalValue + makingValue;
  const afterDiscount = subTotal - this.discount;
  
  // Add GST if enabled
  let totalWithGST = afterDiscount;
  if (this.gst.enabled) {
    totalWithGST += this.gst.totalGST;
  }
  
  // Calculate balance
  let balancePayable = 0;
  let balanceRefundable = 0;
  
  if (exchangeValue > 0) {
    if (totalWithGST > exchangeValue) {
      balancePayable = totalWithGST - exchangeValue;
    } else {
      balanceRefundable = exchangeValue - totalWithGST;
    }
  } else {
    balancePayable = totalWithGST;
  }
  
  // Update summary
  this.summary = {
    metalValue,
    makingValue,
    subTotal,
    exchangeValue,
    balancePayable,
    balanceRefundable,
    grandTotal: exchangeValue > 0 ? (totalWithGST > exchangeValue ? balancePayable : -balanceRefundable) : totalWithGST
  };
  
  next();
});

BillSchema.methods.toJSON = function() {
  const bill = this.toObject();
  bill.formattedBillNumber = this.formattedBillNumber;
  delete bill.__v;
  delete bill.isDeleted;
  return bill;
};

module.exports = mongoose.model('Bill', BillSchema);
