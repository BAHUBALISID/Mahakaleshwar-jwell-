const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const billController = require('../controllers/billController');
const { auth, staffOrAdmin } = require('../middleware/auth');

// Validation rules - Updated to match billing.js frontend
const createBillValidation = [
  // Customer validation
  body('customer.name').trim().notEmpty().withMessage('Customer name is required'),
  body('customer.mobile').trim().notEmpty().withMessage('Customer mobile is required'),
  body('customer.address').optional({ nullable: true, checkFalsy: true }).trim(),
  body('customer.dob').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Valid date format required'),
  body('customer.pan').optional({ nullable: true, checkFalsy: true }).trim(),
  body('customer.aadhaar').optional({ nullable: true, checkFalsy: true }).trim(),
  
  // Items validation (regular items)
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').optional({ nullable: true }).trim(),
  body('items.*.unit').optional({ nullable: true }).trim(),
  body('items.*.num').optional({ nullable: true }).trim(),
  body('items.*.stmp').optional({ nullable: true }).trim(),
  body('items.*.qty').isFloat({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.grWt').isFloat({ min: 0 }).withMessage('Gross weight must be positive'),
  body('items.*.less').isFloat({ min: 0 }).withMessage('Less must be positive'),
  body('items.*.ntWt').isFloat({ min: 0.001 }).withMessage('Net weight must be at least 0.001'),
  body('items.*.tnch').optional({ nullable: true }).trim(),
  body('items.*.huid').optional({ nullable: true }).trim(),
  body('items.*.huCrg').isFloat({ min: 0 }).withMessage('HU charges must be positive'),
  body('items.*.mk').isIn(['FIX', '%', 'GRM']).withMessage('Valid making type required'),
  body('items.*.mkCrg').isFloat({ min: 0 }).withMessage('Making charges must be positive'),
  body('items.*.rate').isFloat({ min: 0.01 }).withMessage('Rate must be greater than 0'),
  body('items.*.disMk').isFloat({ min: 0, max: 100 }).withMessage('Discount on making must be 0-100'),
  body('items.*.metalType').isIn(['Gold', 'Silver', 'Diamond', 'Platinum', 'Antique / Polki', 'Others'])
    .withMessage('Valid metal type is required'),
  body('items.*.purity').trim().notEmpty().withMessage('Purity is required'),
  body('items.*.isExchange').optional().isBoolean().withMessage('isExchange must be boolean'),
  
  // Exchange items validation
  body('exchangeItems').optional().isArray(),
  body('exchangeItems.*.product').optional({ nullable: true }).trim(),
  body('exchangeItems.*.metalType').isIn(['Gold', 'Silver', 'Diamond', 'Platinum', 'Antique / Polki', 'Others'])
    .withMessage('Valid metal type is required for exchange items'),
  body('exchangeItems.*.purity').trim().notEmpty().withMessage('Purity is required for exchange items'),
  body('exchangeItems.*.qty').isFloat({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('exchangeItems.*.grWt').isFloat({ min: 0 }).withMessage('Gross weight must be positive'),
  body('exchangeItems.*.less').isFloat({ min: 0 }).withMessage('Less must be positive'),
  body('exchangeItems.*.ntWt').isFloat({ min: 0.001 }).withMessage('Net weight must be at least 0.001'),
  body('exchangeItems.*.wastage').isFloat({ min: 0, max: 100 }).withMessage('Wastage must be 0-100'),
  body('exchangeItems.*.meltingCharges').isFloat({ min: 0 }).withMessage('Melting charges must be positive'),
  body('exchangeItems.*.rate').isFloat({ min: 0.01 }).withMessage('Rate must be greater than 0'),
  body('exchangeItems.*.isExchange').optional().isBoolean().withMessage('isExchange must be boolean'),
  
  // Bill settings
  body('gstType').isIn(['intra', 'inter']).withMessage('GST type must be intra or inter'),
  body('paymentMode').isIn(['cash', 'card', 'upi', 'bank_transfer']).withMessage('Valid payment mode is required'),
  body('discount').isFloat({ min: 0 }).withMessage('Discount must be positive')
];

// Validation for calculation only (no customer required)
const calculateBillValidation = [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.ntWt').isFloat({ min: 0.001 }).withMessage('Net weight must be at least 0.001'),
  body('items.*.rate').isFloat({ min: 0.01 }).withMessage('Rate must be greater than 0'),
  body('items.*.metalType').isIn(['Gold', 'Silver', 'Diamond', 'Platinum', 'Antique / Polki', 'Others'])
    .withMessage('Valid metal type is required'),
  body('items.*.purity').trim().notEmpty().withMessage('Purity is required'),
  body('exchangeItems').optional().isArray(),
  body('gstType').isIn(['intra', 'inter']).withMessage('GST type must be intra or inter'),
  body('discount').optional().isFloat({ min: 0 }).withMessage('Discount must be positive')
];

// Public routes
router.get('/recent', billController.getRecentBills); // For admin dashboard
router.get('/:billNumber/download', billController.downloadBillPDF); // For bill download

// Protected routes (staff and admin)
router.use(auth);
router.use(staffOrAdmin);

// Bill CRUD operations
router.post('/create', createBillValidation, billController.createBill);
router.get('/', billController.getAllBills);
router.get('/:id', billController.getBill);
router.get('/number/:billNumber', billController.getBillByNumber);
router.put('/:id', billController.updateBill);
router.delete('/:id', billController.deleteBill);

// Search and filter
router.get('/search/customer/:mobile', billController.searchByCustomerMobile);
router.get('/search/date-range', billController.getBillsByDateRange);
router.get('/search/advance', billController.advanceSearch);

// Reports
router.get('/report/daily', billController.getDailyReport);
router.get('/report/monthly', billController.getMonthlyReport);
router.get('/report/customer/:customerId', billController.getCustomerBillHistory);

// QR operations
router.post('/:id/regenerate-qr', billController.regenerateQR);

// Real-time calculation
router.post('/calculate', calculateBillValidation, billController.calculateBill);

// Print operations
router.get('/:id/print', billController.generatePrintHTML);

module.exports = router;
