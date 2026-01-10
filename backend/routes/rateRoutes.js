const express = require('express');
const router = express.Router();
const rateController = require('../controllers/rateController');
const { auth, adminAuth } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Get all rates
router.get('/', rateController.getRates);

// Get active rates for dropdowns
router.get('/active', rateController.getActiveRates);

// Get rate history
router.get('/history', rateController.getRateHistory);

// Admin only routes
router.use(adminAuth);

// Create or update rate
router.post('/', rateController.upsertRate);

// Toggle rate status
router.put('/:id/status', rateController.toggleRateStatus);

// Delete rate
router.delete('/:id', rateController.deleteRate);

module.exports = router;
