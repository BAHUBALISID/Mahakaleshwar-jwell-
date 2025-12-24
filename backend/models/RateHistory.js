const mongoose = require('mongoose');

const RateHistorySchema = new mongoose.Schema({
    rateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Rate',
        required: true
    },
    metalType: {
        type: String,
        required: true,
        enum: ['Gold', 'Silver', 'Diamond', 'Platinum', 'Others']
    },
    purity: {
        type: String,
        required: true
    },
    oldRate: {
        type: Number,
        default: null
    },
    newRate: {
        type: Number,
        required: true
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
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('RateHistory', RateHistorySchema);
