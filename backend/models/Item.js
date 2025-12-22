const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
    // Core fields from UI
    description: String,
    metalType: String,
    purity: String,
    weight: Number, // In grams or carats
    
    // Making charges (for new items only)
    makingCharges: Number,
    makingChargesType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    
    // Exchange fields (for exchange items only)
    wastageDeduction: Number,
    meltingCharges: Number,
    
    // ALL BOX FIELDS - stored as-is
    boxFields: {
        // Calculation boxes
        quantity: Number,
        grossWeight: Number,
        lessWeight: Number,
        netWeight: Number,
        rate: Number, // Read-only from admin rates
        makingType: String,
        makingChargesAmount: Number,
        discountMakingPercent: Number,
        hallmarkingCharges: Number,
        
        // Record/Display boxes
        productName: String,
        unit: String,
        itemNumber: String,
        stamp: String,
        touchPercent: Number,
        hallmarkId: String,
        
        // Calculated by backend
        metalValue: Number,
        gstAmount: Number,
        exchangeValue: Number,
        taxAmount: Number
    },
    
    // Type identifier
    isExchangeItem: { type: Boolean, default: false },
    
    // References
    bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' },
    
    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Auto-calculate net weight before save
ItemSchema.pre('save', function(next) {
    if (this.boxFields && this.boxFields.grossWeight && this.boxFields.lessWeight) {
        this.boxFields.netWeight = Math.max(0, 
            this.boxFields.grossWeight - this.boxFields.lessWeight
        );
    }
    next();
});

module.exports = mongoose.model('Item', ItemSchema);
