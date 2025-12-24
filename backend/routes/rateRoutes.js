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
  body('metalType').isIn(['Gold', 'Silver', 'Diamond', 'Platinum', 'Others']).withMessage('Valid metal type is required'),
  body('purity').trim().notEmpty().withMessage('Purity is required'),
  body('rate').isFloat({ min: 0 }).withMessage('Rate must be a positive number'),
  body('unit').isIn(['gram', 'kg', 'carat']).withMessage('Valid unit is required')
];

// Public routes
router.get('/', rateController.getRates);
router.get('/all', rateController.getAllRates); // Get all rates for admin panel
router.get('/:metalType/:purity', rateController.getRate);

// Calculate price
router.post('/calculate', rateController.calculateItemPrice);
router.post('/calculate-exchange', rateController.calculateExchangePrice);

// Protected routes (admin only)
router.use(auth);
router.use(adminOnly);

router.post('/', addRateValidation, rateController.addRate);
router.put('/:metalType/:purity', updateRateValidation, rateController.updateRate);
router.put('/:id', updateRateValidation, rateController.updateRateById);
router.delete('/:id', rateController.deleteRate);
router.get('/history/:metalType', rateController.getRateHistory);

module.exports = router;
