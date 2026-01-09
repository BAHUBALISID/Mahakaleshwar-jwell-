const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const billController = require('../controllers/billController');
const auth = require('../middleware/auth');
const { isAdmin, isStaff } = require('../middleware/role');

// Validation rules for bill creation
const billValidationRules = [
  body('customer.name')
    .notEmpty().withMessage('Customer name is required')
    .trim(),
  body('customer.mobile')
    .notEmpty().withMessage('Customer mobile is required')
    .matches(/^[0-9]{10}$/).withMessage('Invalid mobile number'),
  body('items')
    .isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.metalType')
    .notEmpty().withMessage('Metal type is required'),
  body('items.*.purity')
    .notEmpty().withMessage('Purity is required'),
  body('items.*.rate')
    .isFloat({ min: 0 }).withMessage('Rate must be a positive number'),
  body('discount')
    .optional()
    .isFloat({ min: 0 }).withMessage('Discount must be a positive number'),
  body('gst.enabled')
    .optional()
    .isBoolean(),
  body('gst.type')
    .optional()
    .isIn(['CGST_SGST', 'IGST', 'NONE']),
  body('gst.cgstAmount')
    .optional()
    .isFloat({ min: 0 }),
  body('gst.sgstAmount')
    .optional()
    .isFloat({ min: 0 }),
  body('gst.igstAmount')
    .optional()
    .isFloat({ min: 0 }),
  body('gst.totalGST')
    .optional()
    .isFloat({ min: 0 })
];

// All routes are protected
router.use(auth);

// @route   POST /api/bills/create
// @desc    Create new bill
// @access  Private (Staff+)
router.post('/create', isStaff, billValidationRules, billController.createBill);

// @route   GET /api/bills
// @desc    Get all bills
// @access  Private (Staff+)
router.get('/', isStaff, billController.getAllBills);

// @route   GET /api/bills/today
// @desc    Get today's bills
// @access  Private (Staff+)
router.get('/today', isStaff, billController.getTodayBills);

// @route   GET /api/bills/report/range
// @desc    Get bills by date range
// @access  Private (Staff+)
router.get('/report/range', isStaff, billController.getBillsByDateRange);

// @route   GET /api/bills/:id
// @desc    Get single bill
// @access  Private (Staff+)
router.get('/:id', isStaff, billController.getBill);

// Admin only routes
router.use(isAdmin);

// @route   PUT /api/bills/:id
// @desc    Update bill
// @access  Private/Admin
router.put('/:id', billController.updateBill);

// @route   DELETE /api/bills/:id
// @desc    Delete bill
// @access  Private/Admin
router.delete('/:id', billController.deleteBill);

module.exports = router;
