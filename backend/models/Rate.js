const mongoose = require('mongoose');

const rateSchema = new mongoose.Schema({
  gold24K: {
    type: Number,
    required: true,
    min: 0
  },
  gold22K: {
    type: Number,
    required: true,
    min: 0
  },
  gold18K: {
    type: Number,
    required: true,
    min: 0
  },
  silver999: {
    type: Number,
    required: true,
    min: 0
  },
  silver925: {
    type: Number,
    required: true,
    min: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Virtual for per gram rates
rateSchema.virtual('gold24KPerGram').get(function() {
  return this.gold24K / 1000;
});

rateSchema.virtual('gold22KPerGram').get(function() {
  return this.gold22K / 1000;
});

rateSchema.virtual('gold18KPerGram').get(function() {
  return this.gold18K / 1000;
});

rateSchema.virtual('silver999PerGram').get(function() {
  return this.silver999 / 1000;
});

rateSchema.virtual('silver925PerGram').get(function() {
  return this.silver925 / 1000;
});

module.exports = mongoose.model('Rate', rateSchema);
