// backend/models/Item.js
const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  // Display/Record only fields (NO CALCULATION)
  product: {
    type: String,
    required: true
  },
  unit: {
    type: String,
    default: 'PCS'
  },
  num: {
    type: String
  },
  stmp: {
    type: String
  },
  tnch: {
    type: String // Tunch percentage as string (e.g., "91.6%")
  },
  huid: {
    type: String // HUID number
  },
  
  // Calculation fields
  qty: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  grWt: { // Gross Weight
    type: Number,
    required: true,
    min: 0
  },
  less: { // Less weight
    type: Number,
    default: 0,
    min: 0
  },
  ntWt: { // Net Weight (calculated as Gr.Wt - Less)
    type: Number,
    required: true,
    min: 0
  },
  huCrg: { // HUID Charge
    type: Number,
    default: 0,
    min: 0
  },
  mk: { // Making
    type: String,
    default: 'FIX'
  },
  mkCrg: { // Making Charge
    type: Number,
    default: 0,
    min: 0
  },
  rate: { // Rate per unit (from admin manual rate)
    type: Number,
    required: true,
    min: 0
  },
  disMk: { // Discount on Making (%)
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Metal information
  metalType: {
    type: String,
    required: true,
    enum: ['Gold', 'Silver', 'Diamond', 'Platinum', 'Antique / Polki', 'Others']
  },
  purity: {
    type: String,
    required: true
  },
  
  // Exchange specific fields
  isExchange: {
    type: Boolean,
    default: false
  },
  wastage: { // For exchange items only
    type: Number,
    default: 0,
    min: 0
  },
  meltingCharges: { // For exchange items only
    type: Number,
    default: 0,
    min: 0
  },
  
  // Calculated values
  metalValue: {
    type: Number,
    default: 0
  },
  makingValue: {
    type: Number,
    default: 0
  },
  totalValue: {
    type: Number,
    default: 0
  },
  
  // Bill reference
  billId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Item', ItemSchema);
