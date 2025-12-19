const mongoose = require('mongoose');

const rateSchema = new mongoose.Schema({
  metalType: {
    type: String,
    required: true,
    enum: ['Gold', 'Silver', 'Diamond', 'Platinum', 'Antique / Polki', 'Others'],
    unique: true
  },
  rate: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    enum: ['kg', 'carat', 'piece'],
    default: 'kg'
  },
  purityLevels: [{
    type: String,
    default: ['22K', '18K', '14K']
  }],
  makingChargesDefault: {
    type: Number,
    default: 10
  },
  makingChargesType: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  gstRate: {
    type: Number,
    default: 3,
    min: 0,
    max: 100
  },
  gstOnMaking: {
    type: Number,
    default: 5,
    min: 0,
    max: 100
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
rateSchema.index({ metalType: 1, active: 1 });

const Rate = mongoose.model('Rate', rateSchema);

module.exports = Rate;
