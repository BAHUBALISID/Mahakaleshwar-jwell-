const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  metalType: { type: String, required: true },
  purity: { type: String, required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, enum: ['PCS', 'GM'], required: true },
  costPrice: { type: Number, required: true, min: 0 },
  sellingPrice: { type: Number, required: true, min: 0 },
  notes: String,
  isActive: { type: Boolean, default: true },
  lowStockThreshold: { type: Number, default: 5 },
  lastUpdated: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('Stock', stockSchema);
