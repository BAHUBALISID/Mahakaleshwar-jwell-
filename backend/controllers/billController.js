const Bill = require('../models/Bill');
const Rate = require('../models/Rate');
const { generateBillNumber } = require('../utils/billNumberGenerator');
const { 
  numberToWords, 
  calculateItemAmount, 
  calculateExchangeValue,
  calculateGST,
  calculateMetalValue,
  calculateMakingCharges,
  calculateNetWeight
} = require('../utils/calculations');
const qr = require('qr-image');
const { validationResult } = require('express-validator');

// ========== CREATE BILL ==========
// Matches billing.js frontend structure
exports.createBill = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array().map(err => ({ 
          field: err.path, 
          message: err.msg 
        }))
      });
    }

    const {
      customer,
      items = [],
      exchangeItems = [],
      gstType = 'intra',
      paymentMode = 'cash',
      discount = 0
    } = req.body;

    console.log('Creating bill with data:', { 
      customerName: customer?.name,
      itemCount: items?.length,
      exchangeCount: exchangeItems?.length,
      gstType,
      paymentMode,
      discount 
    });

    // ========== VALIDATION ==========
    // Customer validation
    if (!customer || !customer.name || !customer.mobile) {
      return res.status(400).json({
        success: false,
        message: 'Customer name and mobile are required'
      });
    }

    // Items validation
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required'
      });
    }

    // Validate all items have required fields
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (!item.metalType || !item.purity) {
        return res.status(400).json({
          success: false,
          message: `Item ${i + 1}: Metal type and purity are required`
        });
      }
      
      if (!item.rate || item.rate <= 0) {
        return res.status(400).json({
          success: false,
          message: `Item ${i + 1}: Rate is required and must be greater than 0`
        });
      }
      
      const ntWt = item.ntWt || calculateNetWeight(item.grWt || 0, item.less || 0);
      if (ntWt <= 0) {
        return res.status(400).json({
          success: false,
          message: `Item ${i + 1}: Net weight must be greater than 0`
        });
      }
    }

    // Validate exchange items if any
    for (let i = 0; i < exchangeItems.length; i++) {
      const item = exchangeItems[i];
      
      if (!item.metalType || !item.purity) {
        return res.status(400).json({
          success: false,
          message: `Exchange Item ${i + 1}: Metal type and purity are required`
        });
      }
      
      if (!item.rate || item.rate <= 0) {
        return res.status(400).json({
          success: false,
          message: `Exchange Item ${i + 1}: Current rate is required and must be greater than 0`
        });
      }
    }

    // ========== GENERATE BILL NUMBER ==========
    const billNumber = await generateBillNumber();
    const billDate = new Date();

    // ========== PROCESS ITEMS ==========
    // BUSINESS RULE: Frontend sends all calculations, backend verifies
    let totalMetalValue = 0;
    let totalMakingCharges = 0;
    let totalHUIDCharges = 0;
    const processedItems = [];

    // Process regular items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Calculate net weight if not provided
      const netWeight = item.ntWt || calculateNetWeight(item.grWt || 0, item.less || 0);
      
      // Calculate metal value
      const metalValue = calculateMetalValue(
        netWeight,
        item.rate || 0,
        item.qty || 1
      );
      
      // Calculate making charges based on mk type
      const makingCharges = calculateMakingCharges(
        item.mk || 'FIX',
        item.mkCrg || 0,
        metalValue,
        netWeight,
        item.qty || 1,
        item.disMk || 0
      );
      
      // Calculate HUID charges
      const huidCharges = (item.huCrg || 0) * (item.qty || 1);
      
      // Item total (without GST)
      const itemTotal = metalValue + makingCharges + huidCharges;
      
      // Add to totals
      totalMetalValue += metalValue;
      totalMakingCharges += makingCharges;
      totalHUIDCharges += huidCharges;
      
      // Store processed item
      processedItems.push({
        product: item.product || '',
        unit: item.unit || '',
        num: item.num || '',
        stmp: item.stmp || '',
        qty: item.qty || 1,
        grWt: item.grWt || 0,
        less: item.less || 0,
        ntWt: netWeight,
        tnch: item.tnch || '',
        huid: item.huid || '',
        huCrg: item.huCrg || 0,
        mk: item.mk || 'FIX',
        mkCrg: item.mkCrg || 0,
        rate: item.rate || 0,
        disMk: item.disMk || 0,
        metalType: item.metalType,
        purity: item.purity,
        isExchange: false,
        
        // Calculated values
        metalValue: metalValue,
        makingCharges: makingCharges,
        huidCharges: huidCharges,
        totalValue: itemTotal
      });
    }

    // ========== PROCESS EXCHANGE ITEMS ==========
    let totalExchangeValue = 0;
    const processedExchangeItems = [];

    for (let i = 0; i < exchangeItems.length; i++) {
      const item = exchangeItems[i];
      
      // Calculate net weight
      const netWeight = item.ntWt || calculateNetWeight(item.grWt || 0, item.less || 0);
      
      // BUSINESS RULE: Exchange at Market Rate - 3%
      const exchangeRate = (item.rate || 0) * 0.97;
      
      // Apply wastage deduction
      const wastageDeduction = (item.wastage || 0) / 100 * netWeight;
      const effectiveWeight = netWeight - wastageDeduction;
      
      // Calculate exchange value
      const exchangeValue = effectiveWeight * exchangeRate * (item.qty || 1);
      
      // Deduct melting charges
      const finalExchangeValue = Math.max(0, exchangeValue - (item.meltingCharges || 0));
      
      // Add to total
      totalExchangeValue += finalExchangeValue;
      
      // Store processed exchange item
      processedExchangeItems.push({
        product: item.product || '',
        metalType: item.metalType,
        purity: item.purity,
        qty: item.qty || 1,
        grWt: item.grWt || 0,
        less: item.less || 0,
        ntWt: netWeight,
        wastage: item.wastage || 0,
        meltingCharges: item.meltingCharges || 0,
        rate: item.rate || 0,
        isExchange: true,
        
        // Calculated values
        exchangeRate: exchangeRate,
        effectiveWeight: effectiveWeight,
        totalValue: finalExchangeValue
      });
    }

    // ========== CALCULATE TOTALS ==========
    // Subtotal (metal + making + HUID)
    const subTotal = totalMetalValue + totalMakingCharges + totalHUIDCharges;
    
    // Apply discount
    const totalAfterDiscount = Math.max(0, subTotal - discount);
    
    // BUSINESS RULE: GST is 3% on metal value only
    const gstRate = 3;
    const gstAmount = (totalMetalValue * gstRate) / 100;
    
    // Calculate GST split based on gstType
    let gstDetails = {};
    if (gstType === 'intra') {
      // CGST + SGST (1.5% each)
      gstDetails = {
        cgst: gstAmount / 2,
        sgst: gstAmount / 2,
        igst: 0
      };
    } else {
      // IGST (3%)
      gstDetails = {
        cgst: 0,
        sgst: 0,
        igst: gstAmount
      };
    }
    
    // Grand total (after discount + GST)
    const grandTotal = totalAfterDiscount + gstAmount;

    // ========== CALCULATE BALANCE FOR EXCHANGE ==========
    let balancePayable = 0;
    let balanceRefundable = 0;
    
    if (exchangeItems.length > 0) {
      if (grandTotal > totalExchangeValue) {
        balancePayable = grandTotal - totalExchangeValue;
      } else {
        balanceRefundable = totalExchangeValue - grandTotal;
      }
    } else {
      balancePayable = grandTotal;
    }

    // ========== GENERATE QR CODE ==========
    const qrData = {
      shop: 'Shri Mahakaleshwar Jewellers',
      billNumber: billNumber,
      date: billDate.toISOString().split('T')[0],
      customer: customer.name,
      amount: grandTotal.toFixed(2),
      mobile: customer.mobile
    };
    
    const qrImage = qr.imageSync(JSON.stringify(qrData), { type: 'png' });
    const qrCodeBase64 = qrImage.toString('base64');

    // ========== CREATE BILL DOCUMENT ==========
    const billData = {
      billNumber,
      billDate,
      customer: {
        name: customer.name,
        mobile: customer.mobile,
        address: customer.address || '',
        dob: customer.dob || '',
        pan: customer.pan || '',
        aadhaar: customer.aadhaar || ''
      },
      items: [...processedItems, ...processedExchangeItems],
      summary: {
        metalValue: totalMetalValue,
        makingCharges: totalMakingCharges,
        huidCharges: totalHUIDCharges,
        subTotal: subTotal,
        discount: discount,
        gst: {
          rate: gstRate,
          amount: gstAmount,
          type: gstType,
          details: gstDetails
        },
        grandTotal: grandTotal,
        exchangeValue: totalExchangeValue,
        balancePayable: balancePayable,
        balanceRefundable: balanceRefundable
      },
      paymentMode,
      paymentStatus: 'paid',
      gstType,
      discount,
      qrCode: qrCodeBase64,
      createdBy: req.user._id,
      amountInWords: numberToWords(grandTotal)
    };

    const bill = await Bill.create(billData);

    console.log('Bill created successfully:', billNumber);

    res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      bill: {
        ...bill.toObject(),
        // Format for frontend preview
        items: bill.items.filter(item => !item.isExchange),
        exchangeItems: bill.items.filter(item => item.isExchange),
        summary: {
          metalValue: totalMetalValue,
          makingValue: totalMakingCharges,
          subTotal: subTotal,
          gst: {
            gstAmount: gstAmount
          },
          grandTotal: grandTotal,
          exchangeValue: totalExchangeValue,
          balancePayable: balancePayable,
          balanceRefundable: balanceRefundable
        }
      }
    });

  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create bill'
    });
  }
};

// ========== GET BILL ==========
exports.getBill = async (req, res) => {
  try {
    const { id } = req.params;
    
    const bill = await Bill.findById(id)
      .populate('createdBy', 'name email')
      .lean();

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    // Format for frontend
    const formattedBill = {
      ...bill,
      items: bill.items.filter(item => !item.isExchange),
      exchangeItems: bill.items.filter(item => item.isExchange)
    };

    res.json({
      success: true,
      bill: formattedBill
    });

  } catch (error) {
    console.error('Get bill error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bill'
    });
  }
};

// ========== GET BILL BY NUMBER ==========
exports.getBillByNumber = async (req, res) => {
  try {
    const { billNumber } = req.params;
    
    const bill = await Bill.findOne({ billNumber })
      .populate('createdBy', 'name email')
      .lean();

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    // Format for frontend
    const formattedBill = {
      ...bill,
      items: bill.items.filter(item => !item.isExchange),
      exchangeItems: bill.items.filter(item => item.isExchange)
    };

    res.json({
      success: true,
      bill: formattedBill
    });

  } catch (error) {
    console.error('Get bill by number error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bill'
    });
  }
};

// ========== GET ALL BILLS ==========
exports.getAllBills = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      startDate, 
      endDate,
      search,
      metalType,
      paymentStatus 
    } = req.query;

    const query = {};

    // Date filter
    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) query.billDate.$gte = new Date(startDate);
      if (endDate) query.billDate.$lte = new Date(endDate);
    }

    // Search filter
    if (search) {
      query.$or = [
        { billNumber: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.mobile': { $regex: search, $options: 'i' } }
      ];
    }

    // Metal type filter
    if (metalType) {
      query['items.metalType'] = metalType;
    }

    // Payment status filter
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    const bills = await Bill.find(query)
      .populate('createdBy', 'name email')
      .sort({ billDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Bill.countDocuments(query);

    // Format each bill
    const formattedBills = bills.map(bill => ({
      ...bill,
      items: bill.items.filter(item => !item.isExchange),
      exchangeItems: bill.items.filter(item => item.isExchange)
    }));

    res.json({
      success: true,
      bills: formattedBills,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get all bills error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bills'
    });
  }
};

// ========== UPDATE BILL ==========
exports.updateBill = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const bill = await Bill.findById(id);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    // Don't allow updating certain fields
    delete updateData.billNumber;
    delete updateData.createdBy;
    delete updateData.createdAt;

    const updatedBill = await Bill.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    res.json({
      success: true,
      bill: updatedBill,
      message: 'Bill updated successfully'
    });

  } catch (error) {
    console.error('Update bill error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update bill'
    });
  }
};

// ========== DELETE BILL ==========
exports.deleteBill = async (req, res) => {
  try {
    const { id } = req.params;

    const bill = await Bill.findById(id);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    // Soft delete
    bill.isActive = false;
    await bill.save();

    res.json({
      success: true,
      message: 'Bill deleted successfully'
    });

  } catch (error) {
    console.error('Delete bill error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete bill'
    });
  }
};

// ========== GET RECENT BILLS ==========
exports.getRecentBills = async (req, res) => {
  try {
    const bills = await Bill.find({})
      .populate('createdBy', 'name email')
      .sort({ billDate: -1 })
      .limit(10)
      .lean();

    // Format for frontend
    const formattedBills = bills.map(bill => ({
      _id: bill._id,
      billNumber: bill.billNumber,
      customer: bill.customer,
      grandTotal: bill.summary?.grandTotal || 0,
      date: bill.billDate,
      paymentMode: bill.paymentMode,
      status: bill.paymentStatus,
      summary: bill.summary
    }));

    res.json({
      success: true,
      bills: formattedBills
    });

  } catch (error) {
    console.error('Get recent bills error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent bills'
    });
  }
};

// ========== SEARCH BY CUSTOMER MOBILE ==========
exports.searchByCustomerMobile = async (req, res) => {
  try {
    const { mobile } = req.params;

    const bills = await Bill.find({
      'customer.mobile': mobile
    })
    .populate('createdBy', 'name email')
    .sort({ billDate: -1 })
    .lean();

    res.json({
      success: true,
      bills: bills
    });

  } catch (error) {
    console.error('Search by mobile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search bills'
    });
  }
};

// ========== GET BILLS BY DATE RANGE ==========
exports.getBillsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const bills = await Bill.find({
      billDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    })
    .populate('createdBy', 'name email')
    .sort({ billDate: -1 })
    .lean();

    res.json({
      success: true,
      bills: bills,
      count: bills.length
    });

  } catch (error) {
    console.error('Get bills by date range error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bills'
    });
  }
};

// ========== ADVANCE SEARCH ==========
exports.advanceSearch = async (req, res) => {
  try {
    const { 
      customerName,
      customerMobile,
      billNumber,
      metalType,
      minAmount,
      maxAmount,
      startDate,
      endDate 
    } = req.query;

    const query = {};

    if (customerName) {
      query['customer.name'] = { $regex: customerName, $options: 'i' };
    }

    if (customerMobile) {
      query['customer.mobile'] = customerMobile;
    }

    if (billNumber) {
      query.billNumber = billNumber;
    }

    if (metalType) {
      query['items.metalType'] = metalType;
    }

    if (minAmount || maxAmount) {
      query['summary.grandTotal'] = {};
      if (minAmount) query['summary.grandTotal'].$gte = parseFloat(minAmount);
      if (maxAmount) query['summary.grandTotal'].$lte = parseFloat(maxAmount);
    }

    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) query.billDate.$gte = new Date(startDate);
      if (endDate) query.billDate.$lte = new Date(endDate);
    }

    const bills = await Bill.find(query)
      .populate('createdBy', 'name email')
      .sort({ billDate: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      bills: bills,
      count: bills.length
    });

  } catch (error) {
    console.error('Advance search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search bills'
    });
  }
};

// ========== GET DAILY REPORT ==========
exports.getDailyReport = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const bills = await Bill.find({
      billDate: { $gte: startOfDay, $lte: endOfDay }
    }).lean();

    const report = {
      date: startOfDay,
      totalBills: bills.length,
      totalSales: bills.reduce((sum, bill) => sum + (bill.summary?.grandTotal || 0), 0),
      cashSales: 0,
      cardSales: 0,
      upiSales: 0,
      bankTransferSales: 0,
      metalWiseTotal: {},
      exchangeBills: 0,
      totalExchangeValue: 0
    };

    bills.forEach(bill => {
      // Payment mode breakdown
      switch (bill.paymentMode) {
        case 'cash': report.cashSales += bill.summary?.grandTotal || 0; break;
        case 'card': report.cardSales += bill.summary?.grandTotal || 0; break;
        case 'upi': report.upiSales += bill.summary?.grandTotal || 0; break;
        case 'bank_transfer': report.bankTransferSales += bill.summary?.grandTotal || 0; break;
      }

      // Metal-wise sales
      bill.items?.forEach(item => {
        if (!item.isExchange) {
          if (!report.metalWiseTotal[item.metalType]) {
            report.metalWiseTotal[item.metalType] = {
              count: 0,
              amount: 0
            };
          }
          report.metalWiseTotal[item.metalType].count += item.qty || 1;
          report.metalWiseTotal[item.metalType].amount += item.totalValue || 0;
        }
      });

      // Exchange summary
      const exchangeItems = bill.items?.filter(item => item.isExchange) || [];
      if (exchangeItems.length > 0) {
        report.exchangeBills += 1;
        report.totalExchangeValue += exchangeItems.reduce((sum, item) => sum + (item.totalValue || 0), 0);
      }
    });

    res.json({
      success: true,
      report: report
    });

  } catch (error) {
    console.error('Daily report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate daily report'
    });
  }
};

// ========== GET MONTHLY REPORT ==========
exports.getMonthlyReport = async (req, res) => {
  try {
    const { year, month } = req.query;
    const targetDate = new Date(year || new Date().getFullYear(), (month || new Date().getMonth()) - 1, 1);
    
    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const bills = await Bill.find({
      billDate: { $gte: startOfMonth, $lte: endOfMonth }
    }).lean();

    // Generate daily breakdown
    const dailyData = {};
    for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      dailyData[dateStr] = {
        date: dateStr,
        totalSales: 0,
        totalBills: 0
      };
    }

    const monthlySummary = {
      month: startOfMonth.toLocaleString('default', { month: 'long', year: 'numeric' }),
      totalBills: bills.length,
      totalSales: 0,
      totalMetalValue: 0,
      totalMakingCharges: 0,
      totalGST: 0,
      metalWiseTotal: {},
      paymentModeDistribution: {}
    };

    bills.forEach(bill => {
      const dateStr = new Date(bill.billDate).toISOString().split('T')[0];
      if (dailyData[dateStr]) {
        dailyData[dateStr].totalSales += bill.summary?.grandTotal || 0;
        dailyData[dateStr].totalBills += 1;
      }

      monthlySummary.totalSales += bill.summary?.grandTotal || 0;
      monthlySummary.totalMetalValue += bill.summary?.metalValue || 0;
      monthlySummary.totalMakingCharges += bill.summary?.makingCharges || 0;
      monthlySummary.totalGST += bill.summary?.gst?.amount || 0;

      // Payment mode distribution
      monthlySummary.paymentModeDistribution[bill.paymentMode] = 
        (monthlySummary.paymentModeDistribution[bill.paymentMode] || 0) + 1;

      // Metal-wise total
      bill.items?.forEach(item => {
        if (!item.isExchange) {
          if (!monthlySummary.metalWiseTotal[item.metalType]) {
            monthlySummary.metalWiseTotal[item.metalType] = {
              count: 0,
              amount: 0
            };
          }
          monthlySummary.metalWiseTotal[item.metalType].count += item.qty || 1;
          monthlySummary.metalWiseTotal[item.metalType].amount += item.totalValue || 0;
        }
      });
    });

    res.json({
      success: true,
      report: {
        monthlySummary,
        dailyData: Object.values(dailyData),
        startDate: startOfMonth,
        endDate: endOfMonth
      }
    });

  } catch (error) {
    console.error('Monthly report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate monthly report'
    });
  }
};

// ========== GET CUSTOMER BILL HISTORY ==========
exports.getCustomerBillHistory = async (req, res) => {
  try {
    const { customerId } = req.params;

    const bills = await Bill.find({
      $or: [
        { 'customer.mobile': customerId },
        { 'customer._id': customerId }
      ]
    })
    .populate('createdBy', 'name email')
    .sort({ billDate: -1 })
    .lean();

    const customerInfo = bills.length > 0 ? bills[0].customer : null;
    const totalPurchase = bills.reduce((sum, bill) => sum + (bill.summary?.grandTotal || 0), 0);
    const totalBills = bills.length;

    res.json({
      success: true,
      customer: customerInfo,
      bills: bills,
      summary: {
        totalPurchase,
        totalBills,
        averageBill: totalBills > 0 ? totalPurchase / totalBills : 0,
        lastPurchase: bills.length > 0 ? bills[0].billDate : null
      }
    });

  } catch (error) {
    console.error('Get customer bill history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer history'
    });
  }
};

// ========== REGENERATE QR ==========
exports.regenerateQR = async (req, res) => {
  try {
    const { id } = req.params;
    
    const bill = await Bill.findById(id);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    const qrData = {
      shop: 'Shri Mahakaleshwar Jewellers',
      billNumber: bill.billNumber,
      date: bill.billDate.toISOString().split('T')[0],
      customer: bill.customer.name,
      amount: bill.summary?.grandTotal || 0,
      mobile: bill.customer.mobile
    };
    
    const qrImage = qr.imageSync(JSON.stringify(qrData), { type: 'png' });
    bill.qrCode = qrImage.toString('base64');
    
    await bill.save();

    res.json({
      success: true,
      message: 'QR code regenerated successfully',
      qrCode: bill.qrCode
    });

  } catch (error) {
    console.error('Regenerate QR error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to regenerate QR code'
    });
  }
};

// ========== CALCULATE BILL ==========
// Real-time calculation for frontend preview
exports.calculateBill = async (req, res) => {
  try {
    const {
      items = [],
      exchangeItems = [],
      discount = 0,
      gstType = 'intra'
    } = req.body;

    // BUSINESS RULE: Frontend should not calculate GST, but we'll verify calculations

    let totalMetalValue = 0;
    let totalMakingCharges = 0;
    let totalHUIDCharges = 0;

    // Calculate regular items
    items.forEach(item => {
      const netWeight = item.ntWt || calculateNetWeight(item.grWt || 0, item.less || 0);
      const metalValue = calculateMetalValue(netWeight, item.rate || 0, item.qty || 1);
      const makingCharges = calculateMakingCharges(
        item.mk || 'FIX',
        item.mkCrg || 0,
        metalValue,
        netWeight,
        item.qty || 1,
        item.disMk || 0
      );
      const huidCharges = (item.huCrg || 0) * (item.qty || 1);

      totalMetalValue += metalValue;
      totalMakingCharges += makingCharges;
      totalHUIDCharges += huidCharges;
    });

    // Calculate exchange items
    let totalExchangeValue = 0;
    exchangeItems.forEach(item => {
      const netWeight = item.ntWt || calculateNetWeight(item.grWt || 0, item.less || 0);
      const exchangeRate = (item.rate || 0) * 0.97; // 3% deduction
      const wastageDeduction = (item.wastage || 0) / 100 * netWeight;
      const effectiveWeight = netWeight - wastageDeduction;
      const exchangeValue = effectiveWeight * exchangeRate * (item.qty || 1);
      const finalExchangeValue = Math.max(0, exchangeValue - (item.meltingCharges || 0));

      totalExchangeValue += finalExchangeValue;
    });

    // Calculate totals
    const subTotal = totalMetalValue + totalMakingCharges + totalHUIDCharges;
    const totalAfterDiscount = Math.max(0, subTotal - discount);
    
    // GST calculation (3% on metal value)
    const gstRate = 3;
    const gstAmount = (totalMetalValue * gstRate) / 100;
    
    const grandTotal = totalAfterDiscount + gstAmount;

    // Calculate balances
    let balancePayable = 0;
    let balanceRefundable = 0;
    
    if (exchangeItems.length > 0) {
      if (grandTotal > totalExchangeValue) {
        balancePayable = grandTotal - totalExchangeValue;
      } else {
        balanceRefundable = totalExchangeValue - grandTotal;
      }
    } else {
      balancePayable = grandTotal;
    }

    res.json({
      success: true,
      calculation: {
        metalValue: totalMetalValue,
        makingCharges: totalMakingCharges,
        huidCharges: totalHUIDCharges,
        subTotal: subTotal,
        discount: discount,
        gst: {
          rate: gstRate,
          amount: gstAmount,
          type: gstType
        },
        grandTotal: grandTotal,
        exchangeValue: totalExchangeValue,
        balancePayable: balancePayable,
        balanceRefundable: balanceRefundable
      }
    });

  } catch (error) {
    console.error('Calculate bill error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate bill'
    });
  }
};

// ========== GENERATE PRINT HTML ==========
exports.generatePrintHTML = async (req, res) => {
  try {
    const { id } = req.params;
    
    const bill = await Bill.findById(id).lean();
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    const regularItems = bill.items.filter(item => !item.isExchange);
    const exchangeItems = bill.items.filter(item => item.isExchange);

    // Generate HTML for printing (similar to billing.js generatePrintHTML)
    const printHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bill ${bill.billNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .invoice-container { max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #D4AF37; padding-bottom: 20px; }
          .bill-info { display: flex; justify-content: space-between; margin: 20px 0; }
          .customer-info { margin: 20px 0; padding: 15px; background: #f8f9fa; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          .summary { background: #f8f9fa; padding: 20px; border-radius: 5px; }
          .total-row { font-weight: bold; color: #D4AF37; }
          .signature { margin-top: 50px; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <h2>Shri Mahakaleshwar Jewellers</h2>
            <p>Anisabad, Patna, Bihar - 800002</p>
            <p>Mobile: +91 9876543210 | GSTIN: 10ABCDE1234F1Z5</p>
          </div>
          
          <div class="bill-info">
            <div>
              <div><strong>Bill No:</strong> ${bill.billNumber}</div>
              <div><strong>Date:</strong> ${new Date(bill.billDate).toLocaleDateString()}</div>
            </div>
            <div>
              <div><strong>Payment Mode:</strong> ${bill.paymentMode.toUpperCase()}</div>
              <div><strong>GST Type:</strong> ${bill.gstType === 'intra' ? 'CGST+SGST' : 'IGST'}</div>
            </div>
          </div>
          
          <div class="customer-info">
            <h4>Customer Details</h4>
            <p><strong>Name:</strong> ${bill.customer.name}</p>
            <p><strong>Mobile:</strong> ${bill.customer.mobile}</p>
            <p><strong>Address:</strong> ${bill.customer.address || 'N/A'}</p>
          </div>
          
          <h4>Items</h4>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Metal & Purity</th>
                <th>Weight</th>
                <th>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${regularItems.map(item => `
                <tr>
                  <td>${item.product || 'Item'}</td>
                  <td>${item.metalType} ${item.purity}</td>
                  <td>${item.ntWt?.toFixed(3) || '0.000'} g</td>
                  <td>₹${item.totalValue?.toFixed(2) || '0.00'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          ${exchangeItems.length > 0 ? `
            <h4>Exchange Items</h4>
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Metal & Purity</th>
                  <th>Weight</th>
                  <th>Value (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${exchangeItems.map(item => `
                  <tr>
                    <td>${item.product || 'Old Item'}</td>
                    <td>${item.metalType} ${item.purity}</td>
                    <td>${item.ntWt?.toFixed(3) || '0.000'} g</td>
                    <td>₹${item.totalValue?.toFixed(2) || '0.00'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
          
          <div class="summary">
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd;">
              <span>Metal Value:</span>
              <span>₹${bill.summary?.metalValue?.toFixed(2) || '0.00'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd;">
              <span>Making Charges:</span>
              <span>₹${bill.summary?.makingCharges?.toFixed(2) || '0.00'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd;">
              <span>Sub Total:</span>
              <span>₹${bill.summary?.subTotal?.toFixed(2) || '0.00'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd;">
              <span>Discount:</span>
              <span>-₹${(bill.discount || 0).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd;">
              <span>GST on Metal (3%):</span>
              <span>₹${bill.summary?.gst?.amount?.toFixed(2) || '0.00'}</span>
            </div>
            ${exchangeItems.length > 0 ? `
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd;">
                <span>Old Items Value:</span>
                <span>₹${bill.summary?.exchangeValue?.toFixed(2) || '0.00'}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 2px solid #D4AF37;">
                <span>Balance:</span>
                <span>₹${bill.summary?.balancePayable > 0 ? bill.summary.balancePayable.toFixed(2) + ' Payable' : bill.summary.balanceRefundable.toFixed(2) + ' Refundable'}</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; padding: 8px 0; font-weight: bold; color: #D4AF37; border-bottom: 2px solid #D4AF37;">
              <span>${exchangeItems.length > 0 ? 'Balance ' : 'Grand '}Total:</span>
              <span>₹${bill.summary?.grandTotal?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
          
          <div style="margin: 20px 0; padding: 15px; background: white; border: 1px solid #eee;">
            <p><strong>Amount in Words:</strong> ${bill.amountInWords || 'Zero Rupees Only'}</p>
          </div>
          
          <div class="signature">
            <div style="text-align: center;">
              <div style="border-top: 1px solid #333; width: 200px; margin-bottom: 10px;"></div>
              <p>Customer Signature</p>
            </div>
            <div style="text-align: center;">
              <div style="border-top: 1px solid #333; width: 200px; margin-bottom: 10px;"></div>
              <p>Authorized Signature</p>
              <p>For Shri Mahakaleshwar Jewellers</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    res.json({
      success: true,
      html: printHTML,
      billNumber: bill.billNumber
    });

  } catch (error) {
    console.error('Generate print HTML error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate print HTML'
    });
  }
};

// ========== DOWNLOAD BILL PDF ==========
exports.downloadBillPDF = async (req, res) => {
  try {
    const { billNumber } = req.params;
    
    const bill = await Bill.findOne({ billNumber }).lean();
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    // In a real implementation, you would use a PDF library like pdfkit
    // For now, return the bill data for frontend to handle PDF generation
    res.json({
      success: true,
      bill: bill,
      message: 'PDF generation would be implemented here'
    });

  } catch (error) {
    console.error('Download bill PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download bill PDF'
    });
  }
};
