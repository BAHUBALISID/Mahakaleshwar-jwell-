const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const rateController = require('../controllers/rateController');
const { auth, adminOnly } = require('../middleware/auth');

// Validation rules
const updateRateValidation = [
  body('rate').isFloat({ min: 0 }).withMessage('Rate must be a positive number'),
  body('purity').notEmpty().withMessage('Purity is required'),
  body('unit').optional().isIn(['gram', 'kg', 'carat']).withMessage('Invalid unit')
];

const addRateValidation = [
  body('metalType').isIn(['Gold', 'Silver', 'Diamond', 'Platinum', 'Antique / Polki', 'Others'])
    .withMessage('Valid metal type is required'),
  body('purity').trim().notEmpty().withMessage('Purity is required'),
  body('rate').isFloat({ min: 0 }).withMessage('Rate must be a positive number'),
  body('unit').isIn(['gram', 'kg', 'carat']).withMessage('Valid unit is required')
];

// ========== PUBLIC ROUTES ==========
// Get all rates in billing format (for billing.js and exchange.js)
router.get('/', rateController.getRatesForBilling);

// Get all rates in admin format (array format for admin panel)
router.get('/all', rateController.getAllRates);

// Get specific rate
router.get('/:metalType/:purity', rateController.getRate);

// Calculate price for billing
router.post('/calculate', rateController.calculateItemPrice);

// Calculate exchange value (Market Rate - 3%)
router.post('/calculate-exchange', rateController.calculateExchangePrice);

// Get exchange rate (Market Rate - 3%) - specific endpoint for exchange.js
router.get('/exchange-rate/:metalType/:purity', rateController.getExchangeRate);

// ========== PROTECTED ROUTES (ADMIN ONLY) ==========
router.use(auth);

// Add new rate (admin only)
router.post('/', adminOnly, addRateValidation, rateController.addRate);

// Update rate by metal type and purity (admin only)
router.put('/:metalType/:purity', adminOnly, updateRateValidation, rateController.updateRateByMetal);

// Update rate by ID (admin only)
router.put('/update/:id', adminOnly, updateRateValidation, rateController.updateRateById);

// Bulk update rates (admin only)
router.post('/bulk-update', adminOnly, rateController.bulkUpdateRates);

// Delete rate (admin only)
router.delete('/:id', adminOnly, rateController.deleteRate);

// Get rate history (admin only)
router.get('/history/:metalType', adminOnly, rateController.getRateHistory);

// Get all rate history (admin only)
router.get('/history', adminOnly, rateController.getAllRateHistory);

module.exports = router;
