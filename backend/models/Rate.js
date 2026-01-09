const mongoose = require('mongoose');

const rateSchema = new mongoose.Schema({
  metalType: {
    type: String,
    required: true,
    trim: true,
    enum: ['Gold', 'Silver', 'Diamond', 'Platinum', 'Other']
  },
  purity: {
    type: String,
    required: true,
    trim: true
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
  gstPercentage: {
    type: Number,
    default: 3,
    min: 0,
    max: 100
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Compound unique index for metalType and purity
rateSchema.index({ metalType: 1, purity: 1 }, { unique: true });

const Rate = mongoose.model('Rate', rateSchema);

module.exports = Rate;
