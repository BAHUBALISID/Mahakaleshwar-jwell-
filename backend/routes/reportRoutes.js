const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { auth } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Dashboard overview
router.get('/overview', reportController.getDashboardOverview);

// Sales report
router.get('/sales', reportController.getSalesReport);

// Stock report
router.get('/stock', reportController.getStockReport);

// GST report
router.get('/gst', reportController.getGSTReport);

// Exchange report
router.get('/exchange', reportController.getExchangeReport);

// Export reports
router.get('/export', reportController.exportReport);

module.exports = router;
