const mongoose = require('mongoose');

const rateSchema = new mongoose.Schema({
  metalType: { type: String, required: true },
  purity: { type: String, required: true },
  rate: { type: Number, required: true, min: 0 },
  gstApplicable: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Rate', rateSchema);
