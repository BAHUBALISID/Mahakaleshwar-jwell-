const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');
const path = require('path');

// Set view engine for public pages
router.set('views', path.join(__dirname, '../../frontend'));
router.set('view engine', 'html');
router.engine('html', require('ejs').renderFile);

// Public product view via QR code
router.get('/p/:token', publicController.getProductByToken);

// Public bill view
router.get('/b/:id', publicController.getBillById);

// Download PDF invoice
router.get('/invoice/:id/download', publicController.downloadInvoice);

// View QR code
router.get('/qr/:token', publicController.viewQRCode);

// Verify product authenticity
router.get('/verify', publicController.verifyProduct);

// Get shop information
router.get('/shop-info', publicController.getShopInfo);

module.exports = router;
