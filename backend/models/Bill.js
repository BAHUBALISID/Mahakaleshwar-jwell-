const mongoose = require('mongoose');

const gstSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  type: { type: String, enum: ['CGST_SGST', 'IGST', 'NONE'], default: 'NONE' },
  cgstAmount: { type: Number, default: 0, min: 0 },
  sgstAmount: { type: Number, default: 0, min: 0 },
  igstAmount: { type: Number, default: 0, min: 0 },
  totalGST: { type: Number, default: 0, min: 0 }
});

const billSchema = new mongoose.Schema({
  billNumber: { type: String, required: true, unique: true },
  billDate: { type: Date, default: Date.now },
  customerName: String,
  customerPhone: String,
  customerAddress: String,
  items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
  subTotal: { type: Number, required: true, min: 0 },
  exchangeDeduction: { type: Number, default: 0, min: 0 },
  exchangeDeductionPercent: { type: Number, default: 3, min: 0 },
  gst: gstSchema,
  grandTotal: { type: Number, required: true, min: 0 },
  paymentMode: { type: String, enum: ['CASH', 'CARD', 'UPI', 'BANK'], default: 'CASH' },
  paymentStatus: { type: String, enum: ['PAID', 'PENDING', 'PARTIAL'], default: 'PAID' },
  notes: String,
  biller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isExchange: { type: Boolean, default: false },
  exchangeDetails: {
    oldItems: [{
      description: String,
      weight: Number,
      metalType: String,
      purity: String,
      marketValue: Number
    }],
    totalMarketValue: Number,
    finalExchangeValue: Number
  },
  pdfPath: String,
  qrCodeUrl: String,
  publicToken: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Bill', billSchema);
