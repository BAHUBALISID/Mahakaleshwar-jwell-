const mongoose = require('mongoose');

const RateSchema = new mongoose.Schema({
  metalType: {
    type: String,
    required: true,
    enum: ['Gold', 'Silver', 'Diamond', 'Platinum', 'Antique / Polki', 'Others']
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
  gstApplicable: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  unit: {
    type: String,
    default: 'per gram',
    enum: ['per gram', 'per kg', 'per carat', 'per piece']
  },
  lastUpdated: {
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

// Compound index for unique metal+purity combination
RateSchema.index({ metalType: 1, purity: 1 }, { unique: true });

RateSchema.methods.toJSON = function() {
  const rate = this.toObject();
  delete rate.__v;
  return rate;
};

module.exports = mongoose.model('Rate', RateSchema);
