const Bill = require('../models/Bill');
const Rate = require('../models/Rate');
const { generateBillNumber } = require('../utils/billNumberGenerator');
const { 
  numberToWords, 
  calculateItemAmount, 
  calculateExchangeValue,
  calculateGST 
} = require('../utils/calculations');
const qr = require('qr-image');
const { validationResult } = require('express-validator');

exports.createBill = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      customer,
      items,
      discount = 0,
      paymentMode = 'cash',
      paymentStatus = 'paid',
      exchangeItems = []
    } = req.body;

    // Generate bill number
    const billNumber = await generateBillNumber();

    // Get current rates
    const rates = await Rate.find({ active: true });
    const rateMap = {};
    rates.forEach(rate => {
      rateMap[rate.metalType] = rate;
    });

    // Calculate items
    let subTotal = 0;
    const calculatedItems = [];
    const exchangeDetails = {
      hasExchange: exchangeItems.length > 0,
      oldItemsTotal: 0,
      newItemsTotal: 0,
      balancePayable: 0,
      balanceRefundable: 0
    };

    // Process new items
    for (const item of items) {
      const rateInfo = rateMap[item.metalType];
      if (!rateInfo) {
        return res.status(400).json({
          success: false,
          message: `Rate not found for ${item.metalType}`
        });
      }

      const itemCalc = calculateItemAmount(item, rateInfo.perGramRate);
      
      calculatedItems.push({
        ...item,
        rate: rateInfo.perGramRate,
        makingChargesAmount: itemCalc.makingCharges,
        amount: itemCalc.total
      });

      subTotal += itemCalc.total;
    }

    // Process exchange items
    if (exchangeItems.length > 0) {
      for (const oldItem of exchangeItems) {
        const rateInfo = rateMap[oldItem.metalType];
        if (!rateInfo) {
          return res.status(400).json({
            success: false,
            message: `Rate not found for exchange item ${oldItem.metalType}`
          });
        }

        const exchangeValue = calculateExchangeValue(oldItem, rateInfo.perGramRate);
        exchangeDetails.oldItemsTotal += exchangeValue;

        calculatedItems.push({
          description: oldItem.description || 'Old Item Exchange',
          metalType: oldItem.metalType,
          purity: oldItem.purity,
          weight: oldItem.weight,
          rate: rateInfo.perGramRate,
          makingChargesType: 'fixed',
          makingCharges: 0,
          makingChargesAmount: 0,
          amount: -exchangeValue, // Negative amount for exchange
          isExchangeItem: true,
          exchangeDetails: {
            oldItemWeight: oldItem.weight,
            oldItemRate: rateInfo.perGramRate,
            wastageDeduction: oldItem.wastageDeduction || 0,
            meltingCharges: oldItem.meltingCharges || 0,
            netValue: exchangeValue
          }
        });
      }
    }

    // Apply discount
    const totalAfterDiscount = subTotal - discount;

    // Calculate GST (assuming 3% for jewellery)
    const gst = calculateGST(totalAfterDiscount);

    // Calculate grand total
    const grandTotal = totalAfterDiscount + gst;

    // Calculate exchange balances
    if (exchangeDetails.hasExchange) {
      exchangeDetails.newItemsTotal = subTotal;
      const balance = exchangeDetails.oldItemsTotal - subTotal;
      
      if (balance > 0) {
        exchangeDetails.balanceRefundable = balance;
      } else {
        exchangeDetails.balancePayable = Math.abs(balance);
      }
    }

    // Generate amount in words
    const amountInWords = numberToWords(grandTotal);

    // Generate QR codes
    const billQRData = {
      shop: 'Shri Mahakaleshwar Jewellers',
      billNumber,
      customerName: customer.name,
      totalAmount: grandTotal,
      date: new Date().toISOString().split('T')[0],
      address: 'Anisabad, Patna, Bihar'
    };

    const qrCodes = {
      billQR: qr.imageSync(JSON.stringify(billQRData), { type: 'png' }).toString('base64'),
      itemProofQR: '' // Will be generated after image upload
    };

    // Create bill
    const bill = await Bill.create({
      billNumber,
      customer,
      items: calculatedItems,
      subTotal,
      discount,
      gst,
      grandTotal,
      amountInWords,
      paymentMode,
      paymentStatus,
      exchangeDetails,
      qrCodes,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      bill,
      message: 'Bill created successfully'
    });

  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.getBill = async (req, res) => {
  try {
    const { id } = req.params;
    
    const bill = await Bill.findById(id)
      .populate('createdBy', 'name')
      .lean();

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    res.json({
      success: true,
      bill
    });

  } catch (error) {
    console.error('Get bill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.getBillByNumber = async (req, res) => {
  try {
    const { billNumber } = req.params;
    
    const bill = await Bill.findOne({ billNumber })
      .populate('createdBy', 'name')
      .lean();

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    res.json({
      success: true,
      bill
    });

  } catch (error) {
    console.error('Get bill by number error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

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

    const query = { isActive: true };

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
      .populate('createdBy', 'name')
      .sort({ billDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Bill.countDocuments(query);

    res.json({
      success: true,
      bills,
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
      message: 'Server error'
    });
  }
};

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
    ).populate('createdBy', 'name');

    res.json({
      success: true,
      bill: updatedBill,
      message: 'Bill updated successfully'
    });

  } catch (error) {
    console.error('Update bill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

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
      message: 'Server error'
    });
  }
};

exports.getDailyReport = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const bills = await Bill.find({
      billDate: { $gte: startOfDay, $lte: endOfDay },
      isActive: true
    }).lean();

    const report = {
      date: startOfDay,
      totalBills: bills.length,
      totalSales: bills.reduce((sum, bill) => sum + bill.grandTotal, 0),
      cashSales: 0,
      cardSales: 0,
      upiSales: 0,
      metalWise: {},
      exchangeSummary: {
        totalExchanges: 0,
        totalExchangeValue: 0
      }
    };

    bills.forEach(bill => {
      // Payment mode breakdown
      if (bill.paymentMode === 'cash') report.cashSales += bill.grandTotal;
      if (bill.paymentMode === 'card') report.cardSales += bill.grandTotal;
      if (bill.paymentMode === 'upi') report.upiSales += bill.grandTotal;

      // Metal-wise sales
      bill.items.forEach(item => {
        if (!item.isExchangeItem) {
          report.metalWise[item.metalType] = report.metalWise[item.metalType] || {
            count: 0,
            amount: 0
          };
          report.metalWise[item.metalType].count += 1;
          report.metalWise[item.metalType].amount += item.amount;
        }
      });

      // Exchange summary
      if (bill.exchangeDetails?.hasExchange) {
        report.exchangeSummary.totalExchanges += 1;
        report.exchangeSummary.totalExchangeValue += bill.exchangeDetails.oldItemsTotal;
      }
    });

    res.json({
      success: true,
      report
    });

  } catch (error) {
    console.error('Daily report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

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

    // Regenerate bill QR
    const billQRData = {
      shop: 'Shri Mahakaleshwar Jewellers',
      billNumber: bill.billNumber,
      customerName: bill.customer.name,
      totalAmount: bill.grandTotal,
      date: bill.billDate.toISOString().split('T')[0],
      address: 'Anisabad, Patna, Bihar'
    };

    const qrImage = qr.imageSync(JSON.stringify(billQRData), { type: 'png' });
    bill.qrCodes.billQR = qrImage.toString('base64');
    
    await bill.save();

    res.json({
      success: true,
      message: 'QR code regenerated',
      qrCode: bill.qrCodes.billQR
    });

  } catch (error) {
    console.error('Regenerate QR error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
