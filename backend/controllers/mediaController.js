const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { auth } = require('../middleware/auth');

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.env.UPLOAD_PATH, 'products');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `product_${uniqueSuffix}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

// Create upload instance
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter
});

class MediaController {
  // Upload product image
  async uploadProductImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const imageUrl = `/uploads/products/${req.file.filename}`;
      
      res.json({
        success: true,
        message: 'Image uploaded successfully',
        imageUrl
      });
    } catch (error) {
      console.error('Upload image error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Capture image from camera
  async captureImage(req, res) {
    try {
      const { imageData } = req.body;
      
      if (!imageData) {
        return res.status(400).json({ error: 'No image data provided' });
      }

      // Convert base64 to buffer
      const matches = imageData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ error: 'Invalid image data' });
      }

      const buffer = Buffer.from(matches[2], 'base64');
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const filename = `capture_${uniqueSuffix}.jpg`;
      const filepath = path.join(process.env.UPLOAD_PATH, 'products', filename);

      // Save image
      await fs.writeFile(filepath, buffer);
      
      const imageUrl = `/uploads/products/${filename}`;
      
      res.json({
        success: true,
        message: 'Image captured and saved successfully',
        imageUrl
      });
    } catch (error) {
      console.error('Capture image error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Delete image
  async deleteImage(req, res) {
    try {
      const { imageUrl } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({ error: 'Image URL is required' });
      }

      // Extract filename from URL
      const filename = path.basename(imageUrl);
      const filepath = path.join(process.env.UPLOAD_PATH, 'products', filename);

      // Check if file exists
      try {
        await fs.access(filepath);
      } catch {
        return res.status(404).json({ error: 'Image not found' });
      }

      // Delete file
      await fs.unlink(filepath);
      
      res.json({
        success: true,
        message: 'Image deleted successfully'
      });
    } catch (error) {
      console.error('Delete image error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Get all images for a product
  async getProductImages(req, res) {
    try {
      const { productId } = req.params;
      
      // In a real system, you would query the database for product images
      // For now, we'll return a mock response
      
      res.json({
        success: true,
        images: [
          {
            url: '/uploads/products/default.jpg',
            thumbnail: '/uploads/products/thumb_default.jpg',
            uploadedAt: new Date().toISOString()
          }
        ]
      });
    } catch (error) {
      console.error('Get product images error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Upload multiple images
  async uploadMultipleImages(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const images = req.files.map(file => ({
        url: `/uploads/products/${file.filename}`,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype
      }));
      
      res.json({
        success: true,
        message: 'Images uploaded successfully',
        images,
        count: images.length
      });
    } catch (error) {
      console.error('Upload multiple images error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Generate image thumbnail
  async generateThumbnail(req, res) {
    try {
      const { imageUrl } = req.body;
      
      // This would require an image processing library like sharp
      // For now, we'll return a mock response
      
      res.json({
        success: true,
        message: 'Thumbnail generated successfully',
        thumbnailUrl: imageUrl.replace('.jpg', '_thumb.jpg')
      });
    } catch (error) {
      console.error('Generate thumbnail error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Get image statistics
  async getImageStats(req, res) {
    try {
      const uploadsDir = path.join(process.env.UPLOAD_PATH, 'products');
      
      // Get directory stats
      const stats = await fs.stat(uploadsDir);
      const files = await fs.readdir(uploadsDir);
      const imageFiles = files.filter(file => 
        /\.(jpg|jpeg|png|webp|gif)$/i.test(file)
      );

      // Calculate total size
      let totalSize = 0;
      for (const file of imageFiles) {
        const filepath = path.join(uploadsDir, file);
        const fileStats = await fs.stat(filepath);
        totalSize += fileStats.size;
      }
      
      res.json({
        success: true,
        stats: {
          totalImages: imageFiles.length,
          totalSize,
          totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
          lastModified: stats.mtime,
          directory: uploadsDir
        }
      });
    } catch (error) {
      console.error('Get image stats error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

// Create controller instance
const mediaController = new MediaController();

// Export both controller and upload middleware
module.exports = {
  mediaController,
  upload,
  uploadMultiple: upload.array('productImages', 10) // Max 10 files
};
