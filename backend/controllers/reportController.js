const Bill = require('../models/Bill');
const mongoose = require('mongoose');

const getDailyReport = async (req, res) => {
  try {
    const { date } = req.query;
    const queryDate = date ? new Date(date) : new Date();
    
    const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));
    
    const bills = await Bill.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      isDeleted: false
    }).populate('items');
    
    const summary = {
      totalBills: bills.length,
      totalSales: 0,
      totalExchangeValue: 0,
      totalNetPayable: 0,
      totalPaid: 0,
      totalDue: 0,
      byBillType: {
        sale: 0,
        exchange: 0,
        sale_exchange: 0
      },
      byPaymentMethod: {
        cash: 0,
        card: 0,
        upi: 0,
        bank_transfer: 0
      }
    };
    
    bills.forEach(bill => {
      summary.totalSales += bill.totalAmount;
      summary.totalExchangeValue += bill.totalExchangeValue;
      summary.totalNetPayable += bill.netPayable;
      summary.totalPaid += bill.paidAmount;
      summary.totalDue += bill.dueAmount;
      
      summary.byBillType[bill.billType] = (summary.byBillType[bill.billType] || 0) + 1;
      summary.byPaymentMethod[bill.paymentMethod] = (summary.byPaymentMethod[bill.paymentMethod] || 0) + bill.netPayable;
    });
    
    res.json({
      success: true,
      date: startOfDay,
      bills,
      summary
    });
  } catch (error) {
    console.error('Get daily report error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

const getMonthlyReport = async (req, res) => {
  try {
    const { year, month } = req.query;
    const queryYear = parseInt(year) || new Date().getFullYear();
    const queryMonth = parseInt(month) || new Date().getMonth() + 1;
    
    const startDate = new Date(queryYear, queryMonth - 1, 1);
    const endDate = new Date(queryYear, queryMonth, 0, 23, 59, 59, 999);
    
    const bills = await Bill.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          isDeleted: false
        }
      },
      {
        $group: {
          _id: {
            day: { $dayOfMonth: "$date" }
          },
          count: { $sum: 1 },
          totalSales: { $sum: "$totalAmount" },
          totalNetPayable: { $sum: "$netPayable" },
          totalPaid: { $sum: "$paidAmount" },
          totalDue: { $sum: "$dueAmount" }
        }
      },
      {
        $sort: { "_id.day": 1 }
      }
    ]);
    
    const totalSummary = await Bill.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          isDeleted: false
        }
      },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          totalSales: { $sum: "$totalAmount" },
          totalExchangeValue: { $sum: "$totalExchangeValue" },
          totalNetPayable: { $sum: "$netPayable" },
          totalPaid: { $sum: "$paidAmount" },
          totalDue: { $sum: "$dueAmount" },
          avgBillValue: { $avg: "$netPayable" }
        }
      }
    ]);
    
    const billTypeSummary = await Bill.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          isDeleted: false
        }
      },
      {
        $group: {
          _id: "$billType",
          count: { $sum: 1 },
          totalValue: { $sum: "$netPayable" }
        }
      }
    ]);
    
    res.json({
      success: true,
      month: queryMonth,
      year: queryYear,
      dailyData: bills,
      summary: totalSummary[0] || {},
      billTypeSummary,
      startDate,
      endDate
    });
  } catch (error) {
    console.error('Get monthly report error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

const getCustomerReport = async (req, res) => {
  try {
    const { customerPhone, customerName } = req.query;
    
    const filter = { isDeleted: false };
    
    if (customerPhone) {
      filter.customerPhone = customerPhone;
    }
    
    if (customerName) {
      filter.customerName = { $regex: customerName, $options: 'i' };
    }
    
    const bills = await Bill.find(filter)
      .sort({ date: -1 })
      .populate('items')
      .populate('createdBy', 'username');
    
    const customerSummary = bills.reduce((acc, bill) => {
      if (!acc[bill.customerPhone]) {
        acc[bill.customerPhone] = {
          customerName: bill.customerName,
          customerPhone: bill.customerPhone,
          totalBills: 0,
          totalPurchases: 0,
          totalExchange: 0,
          totalNetPayable: 0,
          totalPaid: 0,
          totalDue: 0,
          firstPurchase: bill.date,
          lastPurchase: bill.date
        };
      }
      
      const customer = acc[bill.customerPhone];
      customer.totalBills += 1;
      customer.totalPurchases += bill.totalAmount;
      customer.totalExchange += bill.totalExchangeValue;
      customer.totalNetPayable += bill.netPayable;
      customer.totalPaid += bill.paidAmount;
      customer.totalDue += bill.dueAmount;
      
      if (bill.date < customer.firstPurchase) {
        customer.firstPurchase = bill.date;
      }
      if (bill.date > customer.lastPurchase) {
        customer.lastPurchase = bill.date;
      }
      
      return acc;
    }, {});
    
    res.json({
      success: true,
      bills,
      customerSummary: Object.values(customerSummary),
      totalCustomers: Object.keys(customerSummary).length
    });
  } catch (error) {
    console.error('Get customer report error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

const getSalesSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const filter = { isDeleted: false };
    
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const summary = await Bill.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          totalSales: { $sum: "$totalAmount" },
          totalMetalValue: { $sum: "$totalMetalValue" },
          totalMakingCharge: { $sum: "$totalMakingCharge" },
          totalTax: { $sum: "$totalTax" },
          totalExchangeValue: { $sum: "$totalExchangeValue" },
          totalNetPayable: { $sum: "$netPayable" },
          totalPaid: { $sum: "$paidAmount" },
          totalDue: { $sum: "$dueAmount" },
          avgBillValue: { $avg: "$netPayable" }
        }
      }
    ]);
    
    const billTypeBreakdown = await Bill.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$billType",
          count: { $sum: 1 },
          totalValue: { $sum: "$netPayable" },
          avgValue: { $avg: "$netPayable" }
        }
      }
    ]);
    
    const paymentMethodBreakdown = await Bill.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          totalValue: { $sum: "$netPayable" }
        }
      }
    ]);
    
    res.json({
      success: true,
      summary: summary[0] || {},
      billTypeBreakdown,
      paymentMethodBreakdown,
      dateRange: { startDate, endDate }
    });
  } catch (error) {
    console.error('Get sales summary error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

module.exports = { 
  getDailyReport, 
  getMonthlyReport, 
  getCustomerReport, 
  getSalesSummary 
};
