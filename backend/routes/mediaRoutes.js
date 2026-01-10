const express = require('express');
const router = express.Router();
const { mediaController, upload, uploadMultiple } = require('../controllers/mediaController');
const { auth } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Upload single product image
router.post('/upload', upload.single('productImage'), mediaController.uploadProductImage);

// Capture image from camera
router.post('/capture', mediaController.captureImage);

// Upload multiple images
router.post('/upload-multiple', uploadMultiple, mediaController.uploadMultipleImages);

// Delete image
router.delete('/delete', mediaController.deleteImage);

// Get product images
router.get('/product/:productId', mediaController.getProductImages);

// Generate thumbnail
router.post('/thumbnail', mediaController.generateThumbnail);

// Get image statistics
router.get('/stats', mediaController.getImageStats);

module.exports = router;
