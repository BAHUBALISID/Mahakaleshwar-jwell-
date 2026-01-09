const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Ring', 'Necklace', 'Earring', 'Bangle', 'Chain', 'Bracelet', 'Pendant', 'Other']
  },
  defaultMetalType: {
    type: String,
    required: true
  },
  defaultPurity: {
    type: String,
    required: true
  },
  defaultMakingChargeType: {
    type: String,
    enum: ['FIX', '%', 'GRM'],
    default: '%'
  },
  defaultMakingChargeValue: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    trim: true
  },
  image: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

const Item = mongoose.model('Item', itemSchema);

module.exports = Item;
