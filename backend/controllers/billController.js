const Bill = require('../models/Bill');
const Stock = require('../models/Stock');
const Rate = require('../models/Rate');
const { generateBillNumber } = require('../utils/billNumberGenerator');
const { calculateBillTotals, validateNetWeight } = require('../utils/calculations');
const PDFGenerator = require('../utils/pdfGenerator');
const QRGenerator = require('../utils/qrGenerator');
const WhatsAppSender = require('../utils/whatsappSender');
const path = require('path');
const fs = require('fs').promises;

class BillController {
  // Create new bill
  async createBill(req, res) {
    try {
      const {
        customerName,
        customerPhone,
        customerAddress,
        items,
        cgst,
        sgst,
        igst,
        paymentMethod,
        paymentStatus,
        notes
      } = req.body;

      // Validate items
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'At least one item is required' });
      }

      // Generate bill number
      const billNumber = await generateBillNumber();

      // Process each item
      const processedItems = await Promise.all(items.map(async (item) => {
        // Validate net weight
        const netWeight = validateNetWeight(item.grossWeight, item.lessWeight);
        
        // Get current rate for metal and purity
        const rateDoc = await Rate.findOne({
          metalType: item.metalType,
          purity: item.purity,
          isActive: true
        });

        if (!rateDoc) {
          throw new Error(`Rate not found for ${item.metalType} ${item.purity}`);
        }

        // Generate public token for QR
        const publicToken = QRGenerator.generatePublicToken();

        return {
          ...item,
          netWeight,
          rate: rateDoc.rate,
          publicToken,
          exchangeDeduction: item.isExchange ? (item.netWeight * item.rate * 0.03) : 0
        };
      }));

      // Calculate totals
      const totals = calculateBillTotals(processedItems, { cgst, sgst, igst });

      // Create bill
      const bill = new Bill({
        billNumber,
        customerName,
        customerPhone,
        customerAddress,
        items: processedItems,
        subtotal: totals.subtotal,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        totalGst: totals.totalGst,
        totalAmount: totals.totalAmount,
        paymentMethod,
        paymentStatus,
        notes,
        createdBy: req.user._id
      });

      await bill.save();

      // Update stock
      await this.updateStockForBill(bill, req.user._id);

      // Generate PDF
      const pdfGenerator = new PDFGenerator();
      const pdfFileName = `invoice_${billNumber.replace(/\//g, '_')}.pdf`;
      const pdfPath = path.join(process.env.UPLOAD_PATH, 'invoices', pdfFileName);
      
      await fs.mkdir(path.dirname(pdfPath), { recursive: true });
      await pdfGenerator.generateInvoice(bill.toObject(), pdfPath);

      bill.pdfPath = `/uploads/invoices/${pdfFileName}`;
      await bill.save();

      // Send WhatsApp message
      const whatsappSender = new WhatsAppSender();
      await whatsappSender.sendBill(bill.toObject(), customerPhone, pdfPath);

      res.status(201).json({
        success: true,
        message: 'Bill created successfully',
        bill: {
          _id: bill._id,
          billNumber: bill.billNumber,
          totalAmount: bill.totalAmount,
          pdfUrl: bill.pdfPath,
          items: bill.items.map(item => ({
            productName: item.productName,
            publicToken: item.publicToken,
            qrUrl: QRGenerator.getProductQRUrl(item.publicToken)
          }))
        }
      });

    } catch (error) {
      console.error('Bill creation error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Get all bills with filters
  async getBills(req, res) {
    try {
      const {
        startDate,
        endDate,
        customerPhone,
        metalType,
        page = 1,
        limit = 50
      } = req.query;

      const filter = {};

      // Date filter
      if (startDate || endDate) {
        filter.billDate = {};
        if (startDate) filter.billDate.$gte = new Date(startDate);
        if (endDate) filter.billDate.$lte = new Date(endDate);
      }

      // Customer filter
      if (customerPhone) {
        filter.customerPhone = { $regex: customerPhone, $options: 'i' };
      }

      // Metal type filter
      if (metalType) {
        filter['items.metalType'] = metalType;
      }

      const skip = (page - 1) * limit;

      const bills = await Bill.find(filter)
        .populate('createdBy', 'name email')
        .sort({ billDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const total = await Bill.countDocuments(filter);

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
      console.error('Get bills error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Get single bill
  async getBill(req, res) {
    try {
      const bill = await Bill.findById(req.params.id)
        .populate('createdBy', 'name email')
        .lean();

      if (!bill) {
        return res.status(404).json({ error: 'Bill not found' });
      }

      res.json({
        success: true,
        bill
      });

    } catch (error) {
      console.error('Get bill error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Update bill
  async updateBill(req, res) {
    try {
      const bill = await Bill.findById(req.params.id);

      if (!bill) {
        return res.status(404).json({ error: 'Bill not found' });
      }

      // Revert stock from old bill
      await this.revertStockForBill(bill, req.user._id);

      // Update bill
      Object.assign(bill, req.body);
      
      // Recalculate totals
      const totals = calculateBillTotals(bill.items, {
        cgst: bill.cgst,
        sgst: bill.sgst,
        igst: bill.igst
      });

      bill.subtotal = totals.subtotal;
      bill.totalGst = totals.totalGst;
      bill.totalAmount = totals.totalAmount;

      await bill.save();

      // Update stock with new values
      await this.updateStockForBill(bill, req.user._id);

      res.json({
        success: true,
        message: 'Bill updated successfully',
        bill
      });

    } catch (error) {
      console.error('Update bill error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Delete bill
  async deleteBill(req, res) {
    try {
      const bill = await Bill.findById(req.params.id);

      if (!bill) {
        return res.status(404).json({ error: 'Bill not found' });
      }

      // Revert stock
      await this.revertStockForBill(bill, req.user._id);

      // Delete PDF file if exists
      if (bill.pdfPath) {
        const pdfPath = path.join(__dirname, '..', bill.pdfPath);
        try {
          await fs.unlink(pdfPath);
        } catch (error) {
          console.error('Error deleting PDF:', error);
        }
      }

      await bill.deleteOne();

      res.json({
        success: true,
        message: 'Bill deleted successfully'
      });

    } catch (error) {
      console.error('Delete bill error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Update stock for bill
  async updateStockForBill(bill, userId) {
    for (const item of bill.items) {
      const stockFilter = {
        metalType: item.metalType,
        purity: item.purity,
        productName: item.productName
      };

      let stock = await Stock.findOne(stockFilter);

      if (!stock) {
        stock = new Stock({
          ...stockFilter,
          quantity: 0,
          weight: 0,
          sellingReferencePrice: item.rate * 1.1, // 10% markup as reference
          createdBy: userId
        });
      }

      if (item.isExchange) {
        // Exchange adds to stock
        stock.quantity += item.quantity;
        stock.weight += item.netWeight;
        
        stock.transactions.push({
          transactionType: 'in',
          quantity: item.quantity,
          weight: item.netWeight,
          metalType: item.metalType,
          purity: item.purity,
          productName: item.productName,
          billNumber: bill.billNumber,
          notes: 'Exchange item',
          createdBy: userId
        });
      } else {
        // Sale reduces stock
        stock.quantity = Math.max(0, stock.quantity - item.quantity);
        stock.weight = Math.max(0, stock.weight - item.netWeight);
        
        stock.transactions.push({
          transactionType: 'out',
          quantity: item.quantity,
          weight: item.netWeight,
          metalType: item.metalType,
          purity: item.purity,
          productName: item.productName,
          billNumber: bill.billNumber,
          notes: 'Sold item',
          createdBy: userId
        });
      }

      await stock.save();
    }
  }

  // Revert stock for bill
  async revertStockForBill(bill, userId) {
    for (const item of bill.items) {
      const stock = await Stock.findOne({
        metalType: item.metalType,
        purity: item.purity,
        productName: item.productName
      });

      if (stock) {
        if (item.isExchange) {
          // Revert exchange (remove from stock)
          stock.quantity = Math.max(0, stock.quantity - item.quantity);
          stock.weight = Math.max(0, stock.weight - item.netWeight);
        } else {
          // Revert sale (add back to stock)
          stock.quantity += item.quantity;
          stock.weight += item.netWeight;
        }

        await stock.save();
      }
    }
  }

  // Get bill statistics
  async getStatistics(req, res) {
    try {
      const { startDate, endDate } = req.query;

      const filter = {};
      if (startDate || endDate) {
        filter.billDate = {};
        if (startDate) filter.billDate.$gte = new Date(startDate);
        if (endDate) filter.billDate.$lte = new Date(endDate);
      }

      const stats = await Bill.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalBills: { $sum: 1 },
            totalSales: { $sum: '$totalAmount' },
            totalGST: { $sum: '$totalGst' },
            avgBillValue: { $avg: '$totalAmount' },
            maxBillValue: { $max: '$totalAmount' },
            minBillValue: { $min: '$totalAmount' }
          }
        },
        {
          $project: {
            _id: 0,
            totalBills: 1,
            totalSales: { $round: ['$totalSales', 2] },
            totalGST: { $round: ['$totalGST', 2] },
            avgBillValue: { $round: ['$avgBillValue', 2] },
            maxBillValue: { $round: ['$maxBillValue', 2] },
            minBillValue: { $round: ['$minBillValue', 2] }
          }
        }
      ]);

      // Get daily sales trend
      const dailyTrend = await Bill.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$billDate' } },
            dailySales: { $sum: '$totalAmount' },
            billCount: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            date: '$_id',
            dailySales: { $round: ['$dailySales', 2] },
            billCount: 1,
            _id: 0
          }
        }
      ]);

      // Get metal-wise sales
      const metalSales = await Bill.aggregate([
        { $match: filter },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.metalType',
            totalWeight: { $sum: '$items.netWeight' },
            totalValue: { $sum: { $multiply: ['$items.netWeight', '$items.rate'] } },
            itemCount: { $sum: 1 }
          }
        },
        { $sort: { totalValue: -1 } },
        {
          $project: {
            metalType: '$_id',
            totalWeight: { $round: ['$totalWeight', 3] },
            totalValue: { $round: ['$totalValue', 2] },
            itemCount: 1,
            _id: 0
          }
        }
      ]);

      res.json({
        success: true,
        statistics: stats[0] || {},
        dailyTrend,
        metalSales
      });

    } catch (error) {
      console.error('Get statistics error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new BillController();
