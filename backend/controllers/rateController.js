const Rate = require('../models/Rate');
const RateHistory = require('../models/RateHistory');
const { validationResult } = require('express-validator');

class RateController {
    // Get all rates - formatted by metal type and purity
    async getRates(req, res) {
        try {
            const rates = await Rate.find({})
                .sort({ metalType: 1, purity: 1 })
                .populate('updatedBy', 'name email');

            // Format rates: metal -> purity -> rate object
            const formattedRates = {};
            rates.forEach(rate => {
                if (!formattedRates[rate.metalType]) {
                    formattedRates[rate.metalType] = {};
                }
                
                // Store entire rate object
                formattedRates[rate.metalType][rate.purity] = {
                    rate: rate.rate,
                    unit: rate.unit,
                    _id: rate._id,
                    updatedAt: rate.updatedAt,
                    effectiveDate: rate.effectiveDate
                };
            });

            // Fill in empty structure for metals without rates
            const allMetals = ['Gold', 'Silver', 'Diamond', 'Platinum', 'Others'];
            const defaultPurities = {
                'Gold': ['24K', '22K', '18K', '14K'],
                'Silver': ['999', '925', '900', '850', '800'],
                'Diamond': ['SI1', 'VS1', 'VVS1', 'IF', 'FL'],
                'Platinum': ['950', '900', '850', '999'],
                'Others': ['Standard']
            };

            allMetals.forEach(metal => {
                if (!formattedRates[metal]) {
                    formattedRates[metal] = {};
                }
                
                // Ensure all purities exist
                const purities = defaultPurities[metal] || ['Standard'];
                purities.forEach(purity => {
                    if (!formattedRates[metal][purity]) {
                        formattedRates[metal][purity] = {
                            rate: null,
                            unit: metal === 'Diamond' ? 'carat' : 'gram',
                            _id: null,
                            updatedAt: null,
                            effectiveDate: null
                        };
                    }
                });
            });

            res.json({
                success: true,
                rates: formattedRates
            });
        } catch (error) {
            console.error('Get rates error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch rates'
            });
        }
    }

    // Get all rates as array (for admin panel)
    async getAllRates(req, res) {
        try {
            const rates = await Rate.find({})
                .sort({ metalType: 1, purity: 1 })
                .populate('updatedBy', 'name email');

            res.json({
                success: true,
                rates: rates
            });
        } catch (error) {
            console.error('Get all rates error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch rates'
            });
        }
    }

    // Get specific rate by metal type and purity
    async getRate(req, res) {
        try {
            const { metalType, purity } = req.params;

            const rate = await Rate.findOne({
                metalType: metalType,
                purity: purity
            }).populate('updatedBy', 'name email');

            if (!rate) {
                return res.json({
                    success: true,
                    rate: null,
                    message: 'Rate not configured'
                });
            }

            res.json({
                success: true,
                rate: rate
            });
        } catch (error) {
            console.error('Get rate error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch rate'
            });
        }
    }

    // Add new rate (admin only)
    async addRate(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { metalType, purity, rate, unit } = req.body;

            // Check if rate already exists
            const existingRate = await Rate.findOne({ metalType, purity });
            if (existingRate) {
                return res.status(400).json({
                    success: false,
                    message: 'Rate already exists for this metal and purity'
                });
            }

            // Create new rate
            const newRate = new Rate({
                metalType,
                purity,
                rate,
                unit,
                effectiveDate: new Date(),
                updatedBy: req.user._id
            });

            await newRate.save();

            // Create rate history entry
            const rateHistory = new RateHistory({
                rateId: newRate._id,
                metalType,
                purity,
                oldRate: null,
                newRate: rate,
                unit,
                effectiveDate: newRate.effectiveDate,
                updatedBy: req.user._id
            });

            await rateHistory.save();

            res.json({
                success: true,
                rate: newRate,
                message: 'Rate added successfully'
            });
        } catch (error) {
            console.error('Add rate error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add rate'
            });
        }
    }

    // Update rate by metal type and purity (admin only)
    async updateRate(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { metalType, purity } = req.params;
            const { rate, unit } = req.body;

            // Find existing rate
            let existingRate = await Rate.findOne({ metalType, purity });

            if (!existingRate) {
                // Create new rate if doesn't exist
                existingRate = new Rate({
                    metalType,
                    purity,
                    rate,
                    unit: unit || (metalType === 'Diamond' ? 'carat' : 'gram'),
                    effectiveDate: new Date(),
                    updatedBy: req.user._id
                });

                await existingRate.save();

                // Create rate history entry
                const rateHistory = new RateHistory({
                    rateId: existingRate._id,
                    metalType,
                    purity,
                    oldRate: null,
                    newRate: rate,
                    unit: existingRate.unit,
                    effectiveDate: existingRate.effectiveDate,
                    updatedBy: req.user._id
                });

                await rateHistory.save();

                return res.json({
                    success: true,
                    rate: existingRate,
                    message: 'Rate created successfully'
                });
            }

            // Save old rate for history
            const oldRate = existingRate.rate;

            // Update rate
            existingRate.rate = rate;
            existingRate.unit = unit || existingRate.unit;
            existingRate.effectiveDate = new Date();
            existingRate.updatedBy = req.user._id;
            existingRate.updatedAt = Date.now();

            await existingRate.save();

            // Create rate history entry
            const rateHistory = new RateHistory({
                rateId: existingRate._id,
                metalType,
                purity,
                oldRate,
                newRate: rate,
                unit: existingRate.unit,
                effectiveDate: existingRate.effectiveDate,
                updatedBy: req.user._id
            });

            await rateHistory.save();

            res.json({
                success: true,
                rate: existingRate,
                message: 'Rate updated successfully'
            });
        } catch (error) {
            console.error('Update rate error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update rate'
            });
        }
    }

    // Update rate by ID (admin only)
    async updateRateById(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { id } = req.params;
            const { rate, unit } = req.body;

            // Find existing rate
            const existingRate = await Rate.findById(id);
            
            if (!existingRate) {
                return res.status(404).json({
                    success: false,
                    message: 'Rate not found'
                });
            }

            // Save old rate for history
            const oldRate = existingRate.rate;

            // Update rate
            existingRate.rate = rate;
            if (unit) existingRate.unit = unit;
            existingRate.effectiveDate = new Date();
            existingRate.updatedBy = req.user._id;
            existingRate.updatedAt = Date.now();

            await existingRate.save();

            // Create rate history entry
            const rateHistory = new RateHistory({
                rateId: existingRate._id,
                metalType: existingRate.metalType,
                purity: existingRate.purity,
                oldRate,
                newRate: rate,
                unit: existingRate.unit,
                effectiveDate: existingRate.effectiveDate,
                updatedBy: req.user._id
            });

            await rateHistory.save();

            res.json({
                success: true,
                rate: existingRate,
                message: 'Rate updated successfully'
            });
        } catch (error) {
            console.error('Update rate by ID error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update rate'
            });
        }
    }

    // Delete rate (admin only)
    async deleteRate(req, res) {
        try {
            const { id } = req.params;

            const rate = await Rate.findByIdAndDelete(id);

            if (!rate) {
                return res.status(404).json({
                    success: false,
                    message: 'Rate not found'
                });
            }

            // Also delete rate history entries
            await RateHistory.deleteMany({ rateId: id });

            res.json({
                success: true,
                message: 'Rate deleted successfully'
            });
        } catch (error) {
            console.error('Delete rate error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete rate'
            });
        }
    }

    // Get rate history for a metal type
    async getRateHistory(req, res) {
        try {
            const { metalType } = req.params;
            
            const history = await RateHistory.find({ metalType })
                .sort({ effectiveDate: -1 })
                .populate('updatedBy', 'name email')
                .limit(50);

            res.json({
                success: true,
                history: history
            });
        } catch (error) {
            console.error('Get rate history error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch rate history'
            });
        }
    }

    // Calculate item price (including making charges, GST, etc.)
    async calculateItemPrice(req, res) {
        try {
            const { metalType, purity, weight, rate, makingCharges, makingType, quantity = 1 } = req.body;

            // Get current rate if not provided
            let currentRate = rate;
            if (!currentRate) {
                const rateDoc = await Rate.findOne({ metalType, purity });
                if (!rateDoc || !rateDoc.rate) {
                    return res.status(400).json({
                        success: false,
                        message: 'Rate not configured for this metal and purity'
                    });
                }
                currentRate = rateDoc.rate;
            }

            // Convert weight if needed
            let effectiveWeight = weight;
            if (metalType === 'Diamond') {
                // Diamond is in carats
                effectiveWeight = weight;
            } else {
                // Convert to grams if in kg
                effectiveWeight = weight; // Assuming weight is in grams
            }

            // Calculate metal value
            const metalValue = effectiveWeight * currentRate * quantity;

            // Calculate making charges
            let makingValue = 0;
            switch (makingType) {
                case 'percentage':
                    makingValue = (metalValue * makingCharges) / 100;
                    break;
                case 'fixed':
                    makingValue = makingCharges * quantity;
                    break;
                case 'perGram':
                    makingValue = effectiveWeight * makingCharges * quantity;
                    break;
                default:
                    makingValue = makingCharges || 0;
            }

            // Calculate subtotal
            const subTotal = metalValue + makingValue;

            // Calculate GST (3% on metal value only) - BUSINESS RULE
            const gstRate = 3; // Fixed 3% on metal
            const gstAmount = (metalValue * gstRate) / 100;

            // Calculate total
            const total = subTotal + gstAmount;

            res.json({
                success: true,
                calculation: {
                    metalValue: metalValue,
                    makingCharges: makingValue,
                    subTotal: subTotal,
                    gstRate: gstRate,
                    gstAmount: gstAmount,
                    total: total,
                    quantity: quantity
                }
            });
        } catch (error) {
            console.error('Calculate item price error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to calculate item price'
            });
        }
    }

    // Calculate exchange price (Market Rate - 3%) - BUSINESS RULE
    async calculateExchangePrice(req, res) {
        try {
            const { metalType, purity, weight, wastage = 0, meltingCharges = 0 } = req.body;

            // Get current market rate
            const rateDoc = await Rate.findOne({ metalType, purity });
            if (!rateDoc || !rateDoc.rate) {
                return res.status(400).json({
                    success: false,
                    message: 'Rate not configured for this metal and purity'
                });
            }

            const marketRate = rateDoc.rate;
            
            // BUSINESS RULE: Exchange at Market Rate - 3%
            const exchangeRate = marketRate * 0.97;

            // Calculate effective weight after wastage deduction
            const wastageDeduction = (wastage / 100) * weight;
            const effectiveWeight = weight - wastageDeduction;

            // Calculate exchange value
            let exchangeValue = effectiveWeight * exchangeRate;
            
            // Deduct melting charges
            exchangeValue = Math.max(0, exchangeValue - meltingCharges);

            res.json({
                success: true,
                calculation: {
                    marketRate: marketRate,
                    exchangeRate: exchangeRate,
                    deductionPercentage: 3,
                    weight: weight,
                    wastage: wastage,
                    effectiveWeight: effectiveWeight,
                    meltingCharges: meltingCharges,
                    exchangeValue: exchangeValue
                }
            });
        } catch (error) {
            console.error('Calculate exchange price error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to calculate exchange price'
            });
        }
    }
}

module.exports = new RateController();
