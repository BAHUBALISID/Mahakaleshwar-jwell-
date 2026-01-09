const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const rateController = require('../controllers/rateController');
const auth = require('../middleware/auth');
const { isAdmin } = require('../middleware/role');

// Validation rules
const rateValidationRules = [
  body('metalType')
    .notEmpty().withMessage('Metal type is required')
    .isIn(['Gold', 'Silver', 'Diamond', 'Platinum', 'Antique / Polki', 'Others']),
  body('purity')
    .notEmpty().withMessage('Purity is required')
    .trim(),
  body('rate')
    .isFloat({ min: 0 }).withMessage('Rate must be a positive number'),
  body('gstApplicable')
    .optional()
    .isBoolean().withMessage('GST applicable must be true or false'),
  body('unit')
    .optional()
    .isIn(['per gram', 'per kg', 'per carat', 'per piece'])
];

// All routes are protected
router.use(auth);

// @route   GET /api/rates/active
// @desc    Get active rates for billing dropdowns
// @access  Private (Staff+)
router.get('/active', rateController.getActiveRates);

// Admin only routes
router.use(isAdmin);

// @route   GET /api/rates
// @desc    Get all rates (admin only)
// @access  Private/Admin
router.get('/', rateController.getAllRates);

// @route   POST /api/rates
// @desc    Create new rate
// @access  Private/Admin
router.post('/', rateValidationRules, rateController.createRate);

// @route   PUT /api/rates/:id
// @desc    Update rate
// @access  Private/Admin
router.put('/:id', rateValidationRules, rateController.updateRate);

// @route   DELETE /api/rates/:id
// @desc    Delete rate
// @access  Private/Admin
router.delete('/:id', rateController.deleteRate);

// @route   PUT /api/rates/bulk/update
// @desc    Bulk update rates
// @access  Private/Admin
router.put('/bulk/update', [
  body('rates')
    .isArray().withMessage('Rates must be an array')
    .notEmpty().withMessage('Rates array cannot be empty')
], rateController.bulkUpdateRates);

// @route   GET /api/rates/:id/history
// @desc    Get rate history
// @access  Private/Admin
router.get('/:id/history', rateController.getRateHistory);

module.exports = router;
