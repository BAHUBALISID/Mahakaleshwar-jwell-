const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  productImage: String,
  publicToken: { type: String, unique: true },
  unit: { type: String, enum: ['PCS', 'GM'], required: true },
  quantity: { type: Number, required: true, min: 0 },
  grossWeight: { type: Number, required: true, min: 0 },
  lessWeight: { type: Number, default: 0, min: 0 },
  netWeight: { type: Number, required: true, min: 0 },
  metalType: { type: String, required: true },
  purity: { type: String, required: true },
  rate: { type: Number, required: true, min: 0 },
  makingChargeType: { type: String, enum: ['FIX', '%', 'GRM'], required: true },
  makingChargesValue: { type: Number, required: true, min: 0 },
  discountOnMaking: { type: Number, default: 0, min: 0 },
  huid: String,
  tunch: String,
  otherCharges: { type: Number, default: 0, min: 0 },
  notes: String
});

module.exports = mongoose.model('Item', itemSchema);
