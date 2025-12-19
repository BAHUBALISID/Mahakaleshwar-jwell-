const mongoose = require('mongoose');

const rateSchema = new mongoose.Schema({
  metalType: {
    type: String,
    required: true,
    unique: true,
    enum: ['Gold', 'Silver', 'Diamond', 'Platinum', 'Antique / Polki', 'Others']
  },
  rate: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    enum: ['kg', 'carat', 'piece']
  },
  purityLevels: [{
    type: String,
    required: true
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
    default: 3
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
});

// Calculate per gram rate for Gold/Silver/Platinum
rateSchema.virtual('perGramRate').get(function() {
  if (this.unit === 'kg') {
    return this.rate / 1000;
  }
  return this.rate;
});

// Calculate per piece rate for diamond based on weight
rateSchema.methods.calculateItemRate = function(purity, weight) {
  let baseRate = this.rate;
  
  // Apply purity multipliers
  if (this.metalType === 'Gold') {
    if (purity === '24K') baseRate = baseRate;
    else if (purity === '22K') baseRate = baseRate * 0.9167;
    else if (purity === '18K') baseRate = baseRate * 0.75;
    else if (purity === '14K') baseRate = baseRate * 0.5833;
  }
  
  if (this.unit === 'kg') {
    return (baseRate / 1000) * weight;
  } else if (this.unit === 'carat') {
    return baseRate * weight;
  }
  
  return baseRate;
};

const Rate = mongoose.model('Rate', rateSchema);

module.exports = Rate;
