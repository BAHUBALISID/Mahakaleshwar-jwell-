const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');
const { auth } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Get all stock items
router.get('/', stockController.getAllStock);

// Get stock valuation
router.get('/valuation', stockController.getStockValuation);

// Get low stock alerts
router.get('/alerts', stockController.getLowStockAlerts);

// Export stock data
router.get('/export', stockController.exportStock);

// Get single stock item
router.get('/:id', stockController.getStockItem);

// Create new stock item
router.post('/', stockController.createStockItem);

// Update stock item
router.put('/:id', stockController.updateStockItem);

// Delete stock item
router.delete('/:id', stockController.deleteStockItem);

// Adjust stock
router.post('/:id/adjust', stockController.adjustStock);

// Get stock history
router.get('/:id/history', stockController.getStockHistory);

// Reconcile stock
router.post('/:id/reconcile', stockController.reconcileStock);

// Bulk update stock
router.post('/bulk-update', stockController.bulkUpdateStock);

module.exports = router;
