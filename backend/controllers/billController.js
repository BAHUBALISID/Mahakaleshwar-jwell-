const Bill = require('../models/Bill');
const Rate = require('../models/Rate');
const { generateBillNumber } = require('../utils/billNumberGenerator');
const { generateBillQRCode } = require('../utils/qrGenerator');
const { numberToWords } = require('../utils/calculations');
const { validationResult } = require('express-validator');

// @desc    Create new bill
// @route   POST /api/bills/create
// @access  Private
exports.createBill = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  
  try {
    const {
      customer,
      items,
      exchangeItems = [],
      paymentMode,
      discount = 0,
      gst = {}
    } = req.body;
    
    // Validate customer
    if (!customer || !customer.name || !customer.mobile) {
      return res.status(400).json({
        success: false,
        message: 'Customer name and mobile are required'
      });
    }
    
    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required'
      });
    }
    
    // Generate bill number
    const billNumberResult = await generateBillNumber();
    if (!billNumberResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate bill number'
      });
    }
    
    // Process items
    const processedItems = [];
    let itemSequence = 1;
    
    // Process regular items
    for (const item of items) {
      // Calculate net weight
      const netWeight = Math.max(0, (item.grWt || 0) - (item.less || 0));
      
      // Get rate from database for validation
      const rateDoc = await Rate.findOne({
        metalType: item.metalType,
        purity: item.purity,
        isActive: true
      });
      
      if (!rateDoc) {
        return res.status(400).json({
          success: false,
          message: `Rate not found for ${item.metalType} ${item.purity}`
        });
      }
      
      // Calculate metal value
      const metalValue = netWeight * (item.rate || rateDoc.rate) * (item.qty || 1);
      
      // Calculate making charges
      let makingCharges = 0;
      const mkType = item.mk || 'FIX';
      const mkCrg = item.mkCrg || 0;
      const disMk = item.disMk || 0;
      
      switch (mkType) {
        case 'FIX':
          makingCharges = mkCrg * (item.qty || 1);
          break;
        case '%':
          makingCharges = (metalValue * mkCrg) / 100;
          break;
        case 'GRM':
          makingCharges = netWeight * mkCrg * (item.qty || 1);
          break;
      }
      
      // Apply discount on making
      if (disMk > 0) {
        makingCharges = makingCharges - (makingCharges * disMk / 100);
      }
      
      // Add HUID charges if applicable
      if (item.huCrg) {
        makingCharges += (item.huCrg || 0) * (item.qty || 1);
      }
      
      makingCharges = Math.max(0, makingCharges);
      
      processedItems.push({
        ...item,
        ntWt: netWeight,
        metalValue,
        makingCharges,
        totalValue: metalValue + makingCharges,
        isExchange: false,
        sequence: itemSequence++
      });
    }
    
    // Process exchange items
    for (const item of exchangeItems) {
      const netWeight = Math.max(0, (item.grWt || 0) - (item.less || 0));
      
      // Exchange rate = Current rate - 3% (business rule)
      const exchangeRate = (item.rate || 0) * 0.97;
      
      // Apply wastage deduction
      const wastageDeduction = (item.wastage || 0) / 100 * netWeight;
      const effectiveWeight = netWeight - wastageDeduction;
      
      // Calculate exchange value
      let exchangeValue = effectiveWeight * exchangeRate * (item.qty || 1);
      exchangeValue -= (item.meltingCharges || 0);
      exchangeValue = Math.max(0, exchangeValue);
      
      processedItems.push({
        ...item,
        ntWt: netWeight,
        metalValue: exchangeValue,
        makingCharges: 0,
        totalValue: exchangeValue,
        isExchange: true,
        sequence: itemSequence++
      });
    }
    
    // Validate GST
    const gstData = {
      enabled: gst.enabled || false,
      type: gst.type || 'NONE',
      cgstAmount: gst.cgstAmount || 0,
      sgstAmount: gst.sgstAmount || 0,
      igstAmount: gst.igstAmount || 0,
      totalGST: gst.totalGST || 0
    };
    
    // If GST is enabled but type is NONE, disable it
    if (gstData.enabled && gstData.type === 'NONE') {
      gstData.enabled = false;
    }
    
    // Verify GST amounts match type
    if (gstData.enabled) {
      if (gstData.type === 'CGST_SGST') {
        gstData.totalGST = (gstData.cgstAmount || 0) + (gstData.sgstAmount || 0);
      } else if (gstData.type === 'IGST') {
        gstData.totalGST = gstData.igstAmount || 0;
      }
    }
    
    // Create bill
    const bill = new Bill({
      billNumber: billNumberResult.billNumber,
      customer: {
        name: customer.name.trim(),
        mobile: customer.mobile,
        address: customer.address || '',
        dob: customer.dob || null,
        pan: customer.pan || '',
        aadhaar: customer.aadhaar || '',
        gstin: customer.gstin || ''
      },
      items: processedItems,
      paymentMode: paymentMode || 'cash',
      discount: discount || 0,
      gst: gstData,
      createdBy: req.user.id
    });
    
    // Save bill
    await bill.save();
    
    // Generate QR code
    const qrCode = await generateBillQRCode(bill);
    bill.qrCode = qrCode;
    await bill.save();
    
    // Prepare response
    const billResponse = bill.toJSON();
    billResponse.amountInWords = numberToWords(bill.summary.grandTotal);
    
    res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      bill: billResponse
    });
    
  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get all bills
// @route   GET /api/bills
// @access  Private
exports.getAllBills = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, startDate, endDate } = req.query;
    
    const query = { isDeleted: false };
    
    // Search by customer name or mobile
    if (search) {
      query['$or'] = [
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.mobile': { $regex: search, $options: 'i' } },
        { billNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Date filter
    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) {
        query.billDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.billDate.$lte = new Date(endDate);
      }
    }
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { billDate: -1 },
      populate: 'createdBy',
      select: 'billNumber billDate customer summary grandTotal paymentMode createdBy'
    };
    
    const bills = await Bill.paginate(query, options);
    
    res.json({
      success: true,
      ...bills
    });
  } catch (error) {
    console.error('Get bills error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single bill
// @route   GET /api/bills/:id
// @access  Private
exports.getBill = async (req, res) => {
  try {
    const bill = await Bill.findOne({
      _id: req.params.id,
      isDeleted: false
    }).populate('createdBy', 'name email');
    
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }
    
    const billResponse = bill.toJSON();
    billResponse.amountInWords = numberToWords(bill.summary.grandTotal);
    
    res.json({
      success: true,
      bill: billResponse
    });
  } catch (error) {
    console.error('Get bill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update bill
// @route   PUT /api/bills/:id
// @access  Private/Admin
exports.updateBill = async (req, res) => {
  try {
    const bill = await Bill.findOne({
      _id: req.params.id,
      isDeleted: false
    });
    
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }
    
    // Only allow updates on same day
    const billDate = new Date(bill.billDate);
    const today = new Date();
    const isSameDay = billDate.toDateString() === today.toDateString();
    
    if (!isSameDay) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update bills from previous days'
      });
    }
    
    // Update allowed fields
    const allowedUpdates = ['paymentMode', 'discount', 'gst'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        bill[field] = req.body[field];
      }
    });
    
    await bill.save();
    
    // Regenerate QR code if needed
    if (req.body.gst || req.body.discount) {
      const qrCode = await generateBillQRCode(bill);
      bill.qrCode = qrCode;
      await bill.save();
    }
    
    const billResponse = bill.toJSON();
    billResponse.amountInWords = numberToWords(bill.summary.grandTotal);
    
    res.json({
      success: true,
      message: 'Bill updated successfully',
      bill: billResponse
    });
  } catch (error) {
    console.error('Update bill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete bill (soft delete)
// @route   DELETE /api/bills/:id
// @access  Private/Admin
exports.deleteBill = async (req, res) => {
  try {
    const bill = await Bill.findOne({
      _id: req.params.id,
      isDeleted: false
    });
    
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }
    
    // Only allow deletion on same day
    const billDate = new Date(bill.billDate);
    const today = new Date();
    const isSameDay = billDate.toDateString() === today.toDateString();
    
    if (!isSameDay) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete bills from previous days'
      });
    }
    
    bill.isDeleted = true;
    bill.deletedAt = new Date();
    bill.deletedBy = req.user.id;
    
    await bill.save();
    
    res.json({
      success: true,
      message: 'Bill deleted successfully'
    });
  } catch (error) {
    console.error('Delete bill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get bills by date range for reports
// @route   GET /api/bills/report/range
// @access  Private
exports.getBillsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const bills = await Bill.find({
      billDate: {
        $gte: start,
        $lte: end
      },
      isDeleted: false
    })
    .select('billNumber billDate customer summary paymentMode gst')
    .sort({ billDate: 1 });
    
    // Calculate totals
    const totals = bills.reduce((acc, bill) => {
      acc.totalBills += 1;
      acc.totalSales += bill.summary.grandTotal;
      acc.totalMetalValue += bill.summary.metalValue;
      acc.totalMakingCharges += bill.summary.makingValue;
      acc.totalGST += bill.gst.totalGST || 0;
      acc.totalDiscount += bill.discount || 0;
      
      // Count by payment mode
      acc.paymentModes[bill.paymentMode] = (acc.paymentModes[bill.paymentMode] || 0) + 1;
      
      return acc;
    }, {
      totalBills: 0,
      totalSales: 0,
      totalMetalValue: 0,
      totalMakingCharges: 0,
      totalGST: 0,
      totalDiscount: 0,
      paymentModes: {}
    });
    
    res.json({
      success: true,
      count: bills.length,
      bills,
      totals
    });
  } catch (error) {
    console.error('Get bills by range error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get today's bills
// @route   GET /api/bills/today
// @access  Private
exports.getTodayBills = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    const bills = await Bill.find({
      billDate: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      isDeleted: false
    })
    .select('billNumber billDate customer summary paymentMode')
    .sort({ billDate: -1 })
    .limit(50);
    
    // Calculate today's total
    const todayTotal = bills.reduce((sum, bill) => sum + bill.summary.grandTotal, 0);
    
    res.json({
      success: true,
      count: bills.length,
      todayTotal,
      bills
    });
  } catch (error) {
    console.error('Get today bills error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
