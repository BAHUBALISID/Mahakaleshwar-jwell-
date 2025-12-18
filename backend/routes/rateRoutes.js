const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { getCurrentRates, updateRates, getRateHistory } = require('../controllers/rateController');
const { auth, isAdmin } = require('../middleware/auth');

// @route   GET /api/rates/current
// @desc    Get current rates
// @access  Public (for billing), Private for admin
router.get('/current', auth, getCurrentRates);

// @route   POST /api/rates
// @desc    Update rates
// @access  Private (Admin only)
router.post('/', [auth, isAdmin], [
  body('gold24K').isNumeric().withMessage('Gold 24K rate is required'),
  body('gold22K').isNumeric().withMessage('Gold 22K rate is required'),
  body('gold18K').isNumeric().withMessage('Gold 18K rate is required'),
  body('silver999').isNumeric().withMessage('Silver 999 rate is required'),
  body('silver925').isNumeric().withMessage('Silver 925 rate is required')
], updateRates);

// @route   GET /api/rates/history
// @desc    Get rate history
// @access  Private
router.get('/history', auth, getRateHistory);

module.exports = router;
