const mongoose = require('mongoose');

const BillSchema = new mongoose.Schema({
    billNumber: { type: String, unique: true, required: true },
    billDate: { type: Date, default: Date.now },
    
    // Customer info
    customer: {
        name: String,
        mobile: String,
        address: String,
        dob: Date,
        pan: String,
        aadhaar: String
    },
    
    // Items
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
    
    // Calculations (backend-calculated)
    calculations: {
        metalValue: Number,
        makingCharges: Number,
        gstAmount: Number, // 3% on metal value only
        discount: Number,
        exchangeValue: Number,
        grandTotal: Number,
        balancePayable: Number,
        balanceRefundable: Number
    },
    
    // Payment info
    paymentMode: { type: String, enum: ['cash', 'card', 'upi', 'bank_transfer', 'credit'], default: 'cash' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'partial'], default: 'paid' },
    
    // GST info
    isIntraState: { type: Boolean, default: true },
    gstOnMetal: { type: Number, default: 3 }, // Fixed 3%
    gstOnMaking: { type: Number, default: 0 }, // Fixed 0%
    
    // Exchange details
    exchangeDetails: {
        hasExchange: { type: Boolean, default: false },
        oldItemsTotal: Number,
        balancePayable: Number,
        balanceRefundable: Number
    },
    
    // QR Codes
    qrCodes: {
        billQR: String, // Base64 encoded QR
        paymentQR: String
    },
    
    // Audit trail
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Generate bill number before save
BillSchema.pre('save', async function(next) {
    if (!this.billNumber) {
        const lastBill = await this.constructor.findOne().sort({ createdAt: -1 });
        const lastNumber = lastBill ? parseInt(lastBill.billNumber.split('-')[1]) : 0;
        this.billNumber = `SMJ-${String(lastNumber + 1).padStart(5, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Bill', BillSchema);
