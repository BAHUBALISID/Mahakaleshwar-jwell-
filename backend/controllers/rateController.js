// Replace the existing rateController.js with this

const Rate = require('../models/Rate');
const { validationResult } = require('express-validator');

class RateController {
    // Get all rates - returns EMPTY rates initially (Business Rule)
    async getRates(req, res) {
        try {
            const rates = await Rate.find({});
            
            // Business Rule: Initially all rate fields are EMPTY
            // If no rates exist, return empty structure
            if (!rates || rates.length === 0) {
                return res.json({
                    success: true,
                    rates: this.getEmptyRateStructure()
                });
            }
            
            // Format rates: metal -> purity -> rate
            const formattedRates = {};
            rates.forEach(rate => {
                if (!formattedRates[rate.metalType]) {
                    formattedRates[rate.metalType] = {};
                }
                formattedRates[rate.metalType][rate.purity] = rate.rate || ''; // Empty string if no rate
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
    
    // Business Rule: Empty rate structure
    getEmptyRateStructure() {
        return {
            'Gold': {
                '24K': '',
                '22K': '',
                '18K': '',
                '14K': ''
            },
            'Silver': {
                '999': '',
                '925': '',
                '900': '',
                '850': '',
                '800': ''
            },
            'Diamond': {
                'SI1': '',
                'VS1': '',
                'VVS1': '',
                'IF': '',
                'FL': ''
            },
            'Platinum': {
                '950': '',
                '900': '',
                '850': '',
                '999': ''
            },
            'Others': {
                'Standard': ''
            }
        };
    }
    
    // Save rates - Admin manually enters each rate
    async saveRates(req, res) {
        try {
            const { metal, rates } = req.body;
            
            // Validate admin
            if (!req.user || !req.user.isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }
            
            // Delete existing rates for this metal
            await Rate.deleteMany({ metalType: metal });
            
            // Insert new rates
            const rateDocs = [];
            for (const [purity, rate] of Object.entries(rates)) {
                // Allow empty rates (Business Rule: initially empty)
                if (rate !== null && rate !== undefined && rate !== '') {
                    rateDocs.push({
                        metalType: metal,
                        purity: purity,
                        rate: parseFloat(rate),
                        updatedBy: req.user._id,
                        updatedAt: new Date()
                    });
                }
            }
            
            if (rateDocs.length > 0) {
                await Rate.insertMany(rateDocs);
            }
            
            res.json({
                success: true,
                message: `${metal} rates saved successfully`
            });
        } catch (error) {
            console.error('Save rates error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to save rates'
            });
        }
    }
    
    // Get specific rate
    async getRate(req, res) {
        try {
            const { metal, purity } = req.params;
            
            const rate = await Rate.findOne({
                metalType: metal,
                purity: purity
            });
            
            // Business Rule: Return null if rate not set
            if (!rate) {
                return res.json({
                    success: true,
                    rate: null
                });
            }
            
            res.json({
                success: true,
                rate: rate.rate
            });
        } catch (error) {
            console.error('Get rate error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch rate'
            });
        }
    }
    
    // BUSINESS RULE: Exchange rate = Market Rate - 3%
    async getExchangeRate(req, res) {
        try {
            const { metal, purity } = req.params;
            
            const rate = await Rate.findOne({
                metalType: metal,
                purity: purity
            });
            
            if (!rate || !rate.rate) {
                return res.status(404).json({
                    success: false,
                    message: 'Rate not configured for this metal/purity'
                });
            }
            
            // CRITICAL BUSINESS RULE: Exchange at Market Rate - 3%
            const exchangeRate = rate.rate * 0.97; // Fixed 3% deduction
            
            res.json({
                success: true,
                marketRate: rate.rate,
                exchangeRate: exchangeRate,
                deduction: 3 // Fixed percentage
            });
        } catch (error) {
            console.error('Get exchange rate error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to calculate exchange rate'
            });
        }
    }
    
    // Update single rate
    async updateRate(req, res) {
        try {
            const { metalType } = req.params;
            const { rate, purity } = req.body;
            
            if (!req.user.isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }
            
            let rateDoc = await Rate.findOne({ metalType, purity });
            
            if (!rateDoc) {
                rateDoc = new Rate({
                    metalType,
                    purity,
                    rate: rate,
                    updatedBy: req.user._id
                });
            } else {
                rateDoc.rate = rate;
                rateDoc.updatedBy = req.user._id;
                rateDoc.updatedAt = Date.now();
            }
            
            await rateDoc.save();
            
            res.json({
                success: true,
                rate: rateDoc,
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
}

module.exports = new RateController();
