// backend/models/Bill.js
const mongoose = require('mongoose');

const BillItemSchema = new mongoose.Schema({
  // Display/Record only fields (NO CALCULATION)
  product: { type: String, required: true },
  unit: { type: String, default: 'PCS' },
  num: { type: String },
  stmp: { type: String },
  tnch: { type: String }, // Tunch percentage as string (e.g., "91.6%")
  huid: { type: String }, // HUID number
  
  // Calculation fields
  qty: { type: Number, required: true, min: 1, default: 1 },
  grWt: { type: Number, required: true, min: 0 }, // Gross Weight
  less: { type: Number, default: 0, min: 0 }, // Less weight
  ntWt: { type: Number, required: true, min: 0 }, // Net Weight (Gr.Wt - Less)
  huCrg: { type: Number, default: 0, min: 0 }, // HUID Charge
  mk: { type: String, default: 'FIX' }, // Making type
  mkCrg: { type: Number, default: 0, min: 0 }, // Making Charge
  rate: { type: Number, required: true, min: 0 }, // Rate per unit (manual rate)
  disMk: { type: Number, default: 0, min: 0, max: 100 }, // Discount on Making (%)
  
  // Metal information
  metalType: { 
    type: String, 
    required: true, 
    enum: ['Gold', 'Silver', 'Diamond', 'Platinum', 'Antique / Polki', 'Others'] 
  },
  purity: { type: String, required: true },
  
  // Exchange specific fields
  isExchange: { type: Boolean, default: false },
  wastage: { type: Number, default: 0, min: 0 }, // For exchange items only
  meltingCharges: { type: Number, default: 0, min: 0 }, // For exchange items only
  
  // Calculated values (populated by backend)
  metalValue: { type: Number, default: 0 },
  makingValue: { type: Number, default: 0 },
  huidCharge: { type: Number, default: 0 },
  totalValue: { type: Number, default: 0 },
  
  // For exchange items
  exchangeValue: { type: Number, default: 0 } // For exchange items, this is the exchange value
});

const BillSchema = new mongoose.Schema({
  billNumber: { 
    type: String, 
    unique: true, 
    required: true 
  },
  billDate: { 
    type: Date, 
    default: Date.now 
  },
  
  // Customer info (from billing.html)
  customer: {
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    address: { type: String },
    dob: { type: Date },
    pan: { type: String },
    aadhaar: { type: String }
  },
  
  // Items (embedded documents)
  items: [BillItemSchema],
  
  // Summary calculations (backend-calculated)
  summary: {
    metalValue: { type: Number, default: 0 },
    makingValue: { type: Number, default: 0 },
    exchangeValue: { type: Number, default: 0 },
    subTotal: { type: Number, default: 0 },
    gst: {
      taxableValue: { type: Number, default: 0 },
      gstAmount: { type: Number, default: 0 }, // 3% on metal value only
      cgst: { type: Number, default: 0 },
      sgst: { type: Number, default: 0 }
    },
    discount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    balancePayable: { type: Number, default: 0 },
    balanceRefundable: { type: Number, default: 0 }
  },
  
  // Payment info (from billing.html)
  paymentMode: { 
    type: String, 
    enum: ['cash', 'card', 'upi', 'bank_transfer', 'credit'], 
    default: 'cash' 
  },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'paid', 'partial'], 
    default: 'paid' 
  },
  
  // GST info (from billing.html)
  gstType: { 
    type: String, 
    enum: ['intra', 'inter'], 
    default: 'intra' 
  },
  
  // Business rules constants
  gstOnMetal: { type: Number, default: 3 }, // Fixed 3% (BUSINESS RULE)
  gstOnMaking: { type: Number, default: 0 }, // Fixed 0% (BUSINESS RULE)
  
  // Exchange details
  exchangeDetails: {
    hasExchange: { type: Boolean, default: false },
    oldItemsCount: { type: Number, default: 0 },
    newItemsCount: { type: Number, default: 0 }
  },
  
  // QR Codes
  qrCodes: {
    billQR: { type: String }, // Base64 encoded QR
    paymentQR: { type: String }
  },
  
  // Audit trail
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

// Generate bill number before save
BillSchema.pre('save', async function(next) {
  if (!this.billNumber) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    
    // Find the last bill of this month
    const lastBill = await this.constructor.findOne({
      billNumber: new RegExp(`SMJ-${year}${month}-\\d+`)
    }).sort({ billNumber: -1 });
    
    let newNumber = 1;
    if (lastBill && lastBill.billNumber) {
      const lastNumber = parseInt(lastBill.billNumber.split('-')[2]);
      newNumber = lastNumber + 1;
    }
    
    this.billNumber = `SMJ-${year}${month}-${String(newNumber).padStart(4, '0')}`;
  }
  
  // Set exchange details
  if (this.items && this.items.length > 0) {
    const exchangeItems = this.items.filter(item => item.isExchange);
    const newItems = this.items.filter(item => !item.isExchange);
    
    this.exchangeDetails = {
      hasExchange: exchangeItems.length > 0,
      oldItemsCount: exchangeItems.length,
      newItemsCount: newItems.length
    };
  }
  
  next();
});

// Update timestamp on update
BillSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

module.exports = mongoose.model('Bill', BillSchema);
