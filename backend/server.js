const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/database');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Initialize Express
const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/rates', require('./routes/rateRoutes'));
app.use('/api/bills', require('./routes/billRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Jewellery Billing System API is running',
    shop: 'Shri Mahakaleshwar Jewellers, Anisabad, Patna, Bihar',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend HTML files
app.get('*', (req, res) => {
  const filePath = path.join(__dirname, '../frontend', req.path);
  if (req.path === '/' || req.path === '') {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
  } else if (req.path.endsWith('.html')) {
    res.sendFile(filePath);
  } else {
    // For API routes not found
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ 
        success: false, 
        message: 'API endpoint not found' 
      });
    }
    // For frontend files, let static middleware handle it
    res.sendFile(filePath, (err) => {
      if (err) {
        res.status(404).sendFile(path.join(__dirname, '../frontend/404.html'));
      }
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Check if it's a validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }
  
  // Check if it's a duplicate key error
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate key error',
      field: Object.keys(err.keyPattern)[0]
    });
  }
  
  // Default error
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`====================================`);
  console.log(`Jewellery Billing System Started`);
  console.log(`====================================`);
  console.log(`Shop: Shri Mahakaleshwar Jewellers`);
  console.log(`Location: Anisabad, Patna, Bihar`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`API: http://localhost:${PORT}/api`);
  console.log(`====================================`);
  console.log(`Default Admin Credentials:`);
  console.log(`Username: ${process.env.ADMIN_USERNAME}`);
  console.log(`Password: ${process.env.ADMIN_PASSWORD}`);
  console.log(`====================================`);
});
