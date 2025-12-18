const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { login, getProfile, updateShopDetails } = require('../controllers/authController');
const { auth } = require('../middleware/auth');

// @route   POST /api/auth/login
// @desc    Admin login
// @access  Public
router.post('/login', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], login);

// @route   GET /api/auth/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, getProfile);

// @route   PUT /api/auth/shop-details
// @desc    Update shop details
// @access  Private
router.put('/shop-details', auth, [
  body('shopName').notEmpty().withMessage('Shop name is required'),
  body('address').notEmpty().withMessage('Address is required'),
  body('gstin').notEmpty().withMessage('GSTIN is required')
], updateShopDetails);

module.exports = router;
