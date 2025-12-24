// backend/models/Rate.js
const mongoose = require('mongoose');

const RateSchema = new mongoose.Schema({
  metalType: {
    type: String,
    required: true,
    enum: ['Gold', 'Silver', 'Diamond', 'Platinum', 'Others']
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
  unit: {
    type: String,
    required: true,
    enum: ['gram', 'kg', 'carat']
  },
  effectiveDate: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound index for metal type and purity
RateSchema.index({ metalType: 1, purity: 1 }, { unique: true });

module.exports = mongoose.model('Rate', RateSchema);
