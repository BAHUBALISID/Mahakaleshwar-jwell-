const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  billId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
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
  grossWeight: {
    type: Number,
    required: true,
    min: 0
  },
  netWeight: {
    type: Number,
    required: true,
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
  makingChargeType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  makingChargeValue: {
    type: Number,
    required: true,
    min: 0
  },
  makingChargeAmount: {
    type: Number,
    required: true,
    min: 0
  },
  totalBeforeTax: {
    type: Number,
    required: true,
    min: 0
  },
  cgst: {
    type: Number,
    required: true,
    min: 0
  },
  sgst: {
    type: Number,
    required: true,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Item', itemSchema);
