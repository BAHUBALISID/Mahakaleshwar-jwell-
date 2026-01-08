const Bill = require('../models/Bill');
const Rate = require('../models/Rate');
const AIAnalyzer = require('../utils/aiAnalyzer');
const ExcelJS = require('exceljs');
const moment = require('moment');
const mongoose = require('mongoose');

// Initialize AI Analyzer with error handling
let aiAnalyzer;
try {
  aiAnalyzer = new AIAnalyzer();
} catch (error) {
  console.warn('Failed to initialize AI Analyzer:', error.message);
  aiAnalyzer = null;
}

// Helper function to validate date range
function validateDateRange(startDate, endDate) {
  if (startDate && endDate) {
    const start = moment(startDate);
    const end = moment(endDate);
    
    if (end.isBefore(start)) {
      return {
        valid: false,
        error: 'End date must be after start date'
      };
    }
    
    // Limit to 1 year maximum for performance
    const diffMonths = end.diff(start, 'months');
    if (diffMonths > 12) {
      return {
        valid: false,
        error: 'Date range cannot exceed 12 months'
      };
    }
  }
  
  return { valid: true };
}

// Helper function to format response data
function formatResponse(data, success = true, message = null) {
  return {
    success,
    data,
    message,
    timestamp: new Date().toISOString()
  };
}

// Generate pagination metadata
function getPaginationMetadata(page, limit, total) {
  const totalPages = Math.ceil(total / limit);
  return {
    page: parseInt(page),
    limit: parseInt(limit),
    total,
    totalPages,
    hasNext: parseInt(page) < totalPages,
    hasPrev: parseInt(page) > 1
  };
}

exports.getSalesReport = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      metalType, 
      groupBy = 'day',
      format = 'json',
      page = 1,
      limit = 100,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    // Validate date range
    const dateValidation = validateDateRange(startDate, endDate);
    if (!dateValidation.valid) {
      return res.status(400).json(formatResponse(null, false, dateValidation.error));
    }

    const query = { isActive: true };

    // Date filter
    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) query.billDate.$gte = new Date(startDate);
      if (endDate) query.billDate.$lte = new Date(endDate);
    }

    // Metal type filter
    if (metalType) {
      query['items.metalType'] = metalType;
    }

    // Calculate skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total count for pagination
    const totalBills = await Bill.countDocuments(query);

    // Get bills with pagination
    const bills = await Bill.find(query)
      .sort({ billDate: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'name')
      .lean();

    // Group data
    const groupedData = {};
    const dateFormat = groupBy === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM';

    bills.forEach(bill => {
      const dateKey = moment(bill.billDate).format(dateFormat);
      
      if (!groupedData[dateKey]) {
        groupedData[dateKey] = {
          date: dateKey,
          displayDate: moment(bill.billDate).format(groupBy === 'day' ? 'DD MMM YYYY' : 'MMM YYYY'),
          totalBills: 0,
          totalSales: 0,
          totalItems: 0,
          newItemsValue: 0,
          exchangeValue: 0,
          metalWise: {},
          paymentMode: {},
          topItems: []
        };
      }

      groupedData[dateKey].totalBills += 1;
      groupedData[dateKey].totalSales += bill.grandTotal || 0;

      // Count items
      const newItems = bill.items?.filter(item => !item.isExchange) || [];
      const exchangeItems = bill.items?.filter(item => item.isExchange) || [];
      
      groupedData[dateKey].totalItems += newItems.length;
      groupedData[dateKey].newItemsValue += newItems.reduce((sum, item) => sum + (item.totalValue || item.amount || 0), 0);
      groupedData[dateKey].exchangeValue += exchangeItems.reduce((sum, item) => sum + (item.totalValue || item.amount || 0), 0);

      // Metal-wise data
      newItems.forEach(item => {
        const metal = item.metalType || 'Other';
        if (!groupedData[dateKey].metalWise[metal]) {
          groupedData[dateKey].metalWise[metal] = {
            count: 0,
            amount: 0,
            purity: {}
          };
        }
        groupedData[dateKey].metalWise[metal].count += 1;
        groupedData[dateKey].metalWise[metal].amount += item.totalValue || item.amount || 0;
        
        // Track purity distribution
        const purity = item.purity || 'Standard';
        if (!groupedData[dateKey].metalWise[metal].purity[purity]) {
          groupedData[dateKey].metalWise[metal].purity[purity] = 0;
        }
        groupedData[dateKey].metalWise[metal].purity[purity] += 1;
      });

      // Payment mode
      const paymentMode = bill.paymentMode || 'Cash';
      if (!groupedData[dateKey].paymentMode[paymentMode]) {
        groupedData[dateKey].paymentMode[paymentMode] = 0;
      }
      groupedData[dateKey].paymentMode[paymentMode] += bill.grandTotal || 0;

      // Track top items (simplified - just for demo)
      if (newItems.length > 0) {
        const topItem = newItems.reduce((max, item) => 
          (item.totalValue || item.amount || 0) > (max.totalValue || max.amount || 0) ? item : max
        );
        groupedData[dateKey].topItems.push({
          description: topItem.product || 'Item',
          value: topItem.totalValue || topItem.amount || 0
        });
      }
    });

    // Convert to array and sort
    let result = Object.values(groupedData);
    
    // Apply sorting
    if (sortBy === 'sales') {
      result.sort((a, b) => {
        return sortOrder === 'asc' ? a.totalSales - b.totalSales : b.totalSales - a.totalSales;
      });
    } else {
      // Default sort by date
      result.sort((a, b) => {
        return sortOrder === 'asc' ? 
          moment(a.date).diff(moment(b.date)) : 
          moment(b.date).diff(moment(a.date));
      });
    }

    // Calculate comprehensive summary
    const summary = {
      period: {
        startDate: startDate || result.length > 0 ? result[0].date : null,
        endDate: endDate || result.length > 0 ? result[result.length - 1].date : null
      },
      totalPeriodBills: result.reduce((sum, day) => sum + day.totalBills, 0),
      totalPeriodSales: result.reduce((sum, day) => sum + day.totalSales, 0),
      totalPeriodItems: result.reduce((sum, day) => sum + day.totalItems, 0),
      newItemsValue: result.reduce((sum, day) => sum + day.newItemsValue, 0),
      exchangeValue: result.reduce((sum, day) => sum + day.exchangeValue, 0),
      averageDailySales: result.length > 0 ? 
        result.reduce((sum, day) => sum + day.totalSales, 0) / result.length : 0,
      averageBillValue: result.reduce((sum, day) => sum + day.totalBills, 0) > 0 ?
        result.reduce((sum, day) => sum + day.totalSales, 0) / 
        result.reduce((sum, day) => sum + day.totalBills, 0) : 0,
      highestSaleDay: result.length > 0 ? 
        result.reduce((max, day) => day.totalSales > max.totalSales ? day : max) : null,
      lowestSaleDay: result.length > 0 ? 
        result.reduce((min, day) => day.totalSales < min.totalSales ? day : min) : null,
      metalWiseTotal: {},
      paymentModeTotal: {},
      dailyAverageItems: result.length > 0 ? 
        result.reduce((sum, day) => sum + day.totalItems, 0) / result.length : 0
    };

    // Calculate metal-wise totals
    result.forEach(day => {
      Object.keys(day.metalWise).forEach(metal => {
        if (!summary.metalWiseTotal[metal]) {
          summary.metalWiseTotal[metal] = {
            count: 0,
            amount: 0,
            percentage: 0
          };
        }
        summary.metalWiseTotal[metal].count += day.metalWise[metal].count;
        summary.metalWiseTotal[metal].amount += day.metalWise[metal].amount;
      });
      
      Object.keys(day.paymentMode).forEach(mode => {
        if (!summary.paymentModeTotal[mode]) {
          summary.paymentModeTotal[mode] = 0;
        }
        summary.paymentModeTotal[mode] += day.paymentMode[mode];
      });
    });

    // Calculate percentages
    const totalMetalAmount = Object.values(summary.metalWiseTotal).reduce((sum, metal) => sum + metal.amount, 0);
    Object.keys(summary.metalWiseTotal).forEach(metal => {
      summary.metalWiseTotal[metal].percentage = totalMetalAmount > 0 ? 
        (summary.metalWiseTotal[metal].amount / totalMetalAmount) * 100 : 0;
    });

    if (format === 'excel') {
      return await generateExcelReport(res, result, summary, startDate, endDate);
    }

    const pagination = getPaginationMetadata(page, limit, totalBills);

    res.json(formatResponse({
      report: {
        period: { startDate, endDate },
        summary,
        data: result,
        pagination
      }
    }));

  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json(formatResponse(null, false, 'Failed to generate sales report'));
  }
};

exports.getAIAnalysis = async (req, res) => {
  try {
    if (!aiAnalyzer) {
      return res.status(503).json(formatResponse(null, false, 'AI analysis service is not available'));
    }

    const { 
      timeFilter = 'current_month',
      startDate,
      endDate,
      metalType,
      paymentStatus,
      includeMetrics = true 
    } = req.query;

    const filter = {
      timeFilter,
      startDate,
      endDate,
      metalType,
      paymentStatus
    };

    const analysis = await aiAnalyzer.analyzeSalesData(filter);

    if (!analysis.success) {
      return res.status(500).json(formatResponse(analysis, false, 'AI analysis failed'));
    }

    const responseData = {
      analysis: analysis.insights,
      summary: analysis.summary,
      generatedAt: analysis.generatedAt
    };

    if (includeMetrics === 'true' && analysis.metrics) {
      responseData.metrics = analysis.metrics;
    }

    res.json(formatResponse(responseData));

  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json(formatResponse(null, false, 'Failed to generate AI analysis'));
  }
};

exports.getCustomerReport = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate,
      minPurchase = 0,
      maxPurchase,
      minBills = 0,
      customerType = 'all', // 'all', 'new', 'regular', 'premium'
      search,
      page = 1,
      limit = 50,
      sortBy = 'totalPurchase',
      sortOrder = 'desc'
    } = req.query;

    // Validate date range
    const dateValidation = validateDateRange(startDate, endDate);
    if (!dateValidation.valid) {
      return res.status(400).json(formatResponse(null, false, dateValidation.error));
    }

    const query = { isActive: true };

    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) query.billDate.$gte = new Date(startDate);
      if (endDate) query.billDate.$lte = new Date(endDate);
    }

    // Build aggregation pipeline
    const aggregationPipeline = [];

    // Match stage
    if (Object.keys(query).length > 0) {
      aggregationPipeline.push({ $match: query });
    }

    // Group stage
    aggregationPipeline.push({
      $group: {
        _id: '$customer.mobile',
        name: { $first: '$customer.name' },
        email: { $first: '$customer.email' },
        address: { $first: '$customer.address' },
        totalBills: { $sum: 1 },
        totalPurchase: { $sum: '$grandTotal' },
        firstPurchase: { $min: '$billDate' },
        lastPurchase: { $max: '$billDate' },
        averageBillValue: { $avg: '$grandTotal' },
        exchangeCount: {
          $sum: { $cond: [{ $ifNull: ['$exchangeDetails.hasExchange', false] }, 1, 0] }
        },
        exchangeValue: {
          $sum: { $cond: [{ $ifNull: ['$exchangeDetails.hasExchange', false] }, 
                          { $ifNull: ['$exchangeDetails.oldItemsTotal', 0] }, 0] }
        }
      }
    });

    // Add match for min/max purchase
    const purchaseMatch = {};
    if (minPurchase) purchaseMatch.totalPurchase = { $gte: parseFloat(minPurchase) };
    if (maxPurchase) {
      purchaseMatch.totalPurchase = purchaseMatch.totalPurchase || {};
      purchaseMatch.totalPurchase.$lte = parseFloat(maxPurchase);
    }
    if (minBills) purchaseMatch.totalBills = { $gte: parseInt(minBills) };

    if (Object.keys(purchaseMatch).length > 0) {
      aggregationPipeline.push({ $match: purchaseMatch });
    }

    // Filter by customer type
    if (customerType !== 'all') {
      const typeMatch = {};
      if (customerType === 'new') {
        typeMatch.totalBills = { $eq: 1 };
      } else if (customerType === 'regular') {
        typeMatch.totalBills = { $gt: 1 };
        typeMatch.averageBillValue = { $lte: 50000 };
      } else if (customerType === 'premium') {
        typeMatch.averageBillValue = { $gt: 50000 };
      }
      aggregationPipeline.push({ $match: typeMatch });
    }

    // Search by name or mobile
    if (search) {
      aggregationPipeline.push({
        $match: {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { _id: { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    // Count total customers for pagination
    const countPipeline = [...aggregationPipeline];
    countPipeline.push({ $count: 'total' });
    const countResult = await Bill.aggregate(countPipeline);
    const totalCustomers = countResult.length > 0 ? countResult[0].total : 0;

    // Sorting
    const sortField = {
      'name': 'name',
      'totalPurchase': 'totalPurchase',
      'totalBills': 'totalBills',
      'lastPurchase': 'lastPurchase',
      'averageBillValue': 'averageBillValue'
    }[sortBy] || 'totalPurchase';

    aggregationPipeline.push({
      $sort: { [sortField]: sortOrder === 'asc' ? 1 : -1 }
    });

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    aggregationPipeline.push({ $skip: skip });
    aggregationPipeline.push({ $limit: parseInt(limit) });

    // Project final fields
    aggregationPipeline.push({
      $project: {
        mobile: '$_id',
        name: 1,
        email: 1,
        address: 1,
        totalBills: 1,
        totalPurchase: 1,
        firstPurchase: 1,
        lastPurchase: 1,
        averageBillValue: 1,
        exchangeCount: 1,
        exchangeValue: 1,
        customerSince: {
          $dateToString: { format: "%Y-%m-%d", date: "$firstPurchase" }
        },
        lastPurchaseDate: {
          $dateToString: { format: "%Y-%m-%d", date: "$lastPurchase" }
        },
        daysSinceLastPurchase: {
          $cond: {
            if: { $gt: ["$lastPurchase", null] },
            then: { $subtract: [new Date(), "$lastPurchase"] },
            else: null
          }
        }
      }
    });

    const customerData = await Bill.aggregate(aggregationPipeline);

    // Calculate customer segments
    const segments = {
      premium: { count: 0, total: 0, avgValue: 0 },
      regular: { count: 0, total: 0, avgValue: 0 },
      new: { count: 0, total: 0, avgValue: 0 }
    };

    customerData.forEach(customer => {
      const avg = customer.averageBillValue;
      if (avg > 50000) {
        segments.premium.count++;
        segments.premium.total += customer.totalPurchase;
      } else if (customer.totalBills > 1) {
        segments.regular.count++;
        segments.regular.total += customer.totalPurchase;
      } else {
        segments.new.count++;
        segments.new.total += customer.totalPurchase;
      }
    });

    // Calculate averages
    if (segments.premium.count > 0) segments.premium.avgValue = segments.premium.total / segments.premium.count;
    if (segments.regular.count > 0) segments.regular.avgValue = segments.regular.total / segments.regular.count;
    if (segments.new.count > 0) segments.new.avgValue = segments.new.total / segments.new.count;

    const pagination = getPaginationMetadata(page, limit, totalCustomers);

    res.json(formatResponse({
      customers: customerData,
      segments,
      summary: {
        totalCustomers,
        totalRevenue: customerData.reduce((sum, cust) => sum + cust.totalPurchase, 0),
        averageCustomerValue: totalCustomers > 0 ? 
          customerData.reduce((sum, cust) => sum + cust.totalPurchase, 0) / totalCustomers : 0
      },
      pagination
    }));

  } catch (error) {
    console.error('Customer report error:', error);
    res.status(500).json(formatResponse(null, false, 'Failed to generate customer report'));
  }
};

exports.getStockReport = async (req, res) => {
  try {
    const { 
      lowStockOnly = 'false',
      outOfStockOnly = 'false',
      metalType,
      category,
      minStock = 0,
      maxStock,
      sortBy = 'stock',
      sortOrder = 'asc'
    } = req.query;

    // In a real application, replace this with your Item model query
    const items = [
      {
        id: '1',
        code: 'G-RING-001',
        name: 'Gold Ring 22K',
        category: 'Ring',
        metalType: 'Gold',
        purity: '22K',
        stock: 15,
        reorderLevel: 10,
        costPrice: 15000,
        sellingPrice: 18000,
        lastSold: '2024-01-15',
        status: 'In Stock'
      },
      {
        id: '2',
        code: 'S-CHAIN-001',
        name: 'Silver Chain',
        category: 'Chain',
        metalType: 'Silver',
        purity: '925',
        stock: 5,
        reorderLevel: 10,
        costPrice: 5000,
        sellingPrice: 6500,
        lastSold: '2024-01-20',
        status: 'Low Stock'
      },
      {
        id: '3',
        code: 'D-EAR-001',
        name: 'Diamond Earring',
        category: 'Earring',
        metalType: 'Diamond',
        purity: 'VS1',
        stock: 8,
        reorderLevel: 5,
        costPrice: 25000,
        sellingPrice: 32000,
        lastSold: '2024-01-18',
        status: 'In Stock'
      },
      {
        id: '4',
        code: 'P-NECK-001',
        name: 'Platinum Necklace',
        category: 'Necklace',
        metalType: 'Platinum',
        purity: '950',
        stock: 0,
        reorderLevel: 3,
        costPrice: 45000,
        sellingPrice: 55000,
        lastSold: '2024-01-10',
        status: 'Out of Stock'
      }
    ];

    // Apply filters
    let filteredItems = items;

    // Filter by metal type
    if (metalType) {
      filteredItems = filteredItems.filter(item => item.metalType === metalType);
    }

    // Filter by category
    if (category) {
      filteredItems = filteredItems.filter(item => item.category === category);
    }

    // Filter by stock range
    filteredItems = filteredItems.filter(item => item.stock >= parseInt(minStock));
    if (maxStock) {
      filteredItems = filteredItems.filter(item => item.stock <= parseInt(maxStock));
    }

    // Filter by stock status
    if (lowStockOnly === 'true') {
      filteredItems = filteredItems.filter(item => item.stock <= item.reorderLevel && item.stock > 0);
    }
    if (outOfStockOnly === 'true') {
      filteredItems = filteredItems.filter(item => item.stock === 0);
    }

    // Update status based on stock
    filteredItems = filteredItems.map(item => ({
      ...item,
      status: item.stock === 0 ? 'Out of Stock' : 
              item.stock <= item.reorderLevel ? 'Low Stock' : 'In Stock',
      stockValue: item.stock * item.costPrice,
      potentialRevenue: item.stock * item.sellingPrice
    }));

    // Apply sorting
    const sortField = {
      'stock': 'stock',
      'name': 'name',
      'category': 'category',
      'metalType': 'metalType',
      'sellingPrice': 'sellingPrice',
      'lastSold': 'lastSold'
    }[sortBy] || 'stock';

    filteredItems.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    // Calculate summary
    const summary = {
      totalItems: filteredItems.length,
      totalStockValue: filteredItems.reduce((sum, item) => sum + item.stockValue, 0),
      totalPotentialRevenue: filteredItems.reduce((sum, item) => sum + item.potentialRevenue, 0),
      lowStockItems: filteredItems.filter(item => item.status === 'Low Stock').length,
      outOfStockItems: filteredItems.filter(item => item.status === 'Out of Stock').length,
      metalWiseStock: {},
      categoryWiseStock: {}
    };

    filteredItems.forEach(item => {
      // Metal-wise summary
      if (!summary.metalWiseStock[item.metalType]) {
        summary.metalWiseStock[item.metalType] = {
          count: 0,
          totalStock: 0,
          stockValue: 0,
          lowStockCount: 0,
          outOfStockCount: 0
        };
      }
      summary.metalWiseStock[item.metalType].count++;
      summary.metalWiseStock[item.metalType].totalStock += item.stock;
      summary.metalWiseStock[item.metalType].stockValue += item.stockValue;
      if (item.status === 'Low Stock') summary.metalWiseStock[item.metalType].lowStockCount++;
      if (item.status === 'Out of Stock') summary.metalWiseStock[item.metalType].outOfStockCount++;

      // Category-wise summary
      if (!summary.categoryWiseStock[item.category]) {
        summary.categoryWiseStock[item.category] = {
          count: 0,
          totalStock: 0,
          stockValue: 0
        };
      }
      summary.categoryWiseStock[item.category].count++;
      summary.categoryWiseStock[item.category].totalStock += item.stock;
      summary.categoryWiseStock[item.category].stockValue += item.stockValue;
    });

    res.json(formatResponse({
      items: filteredItems,
      summary,
      filters: {
        metalType,
        category,
        lowStockOnly,
        outOfStockOnly
      }
    }));

  } catch (error) {
    console.error('Stock report error:', error);
    res.status(500).json(formatResponse(null, false, 'Failed to generate stock report'));
  }
};

exports.getGSTReport = async (req, res) => {
  try {
    const { month, year, format = 'json' } = req.query;
    
    const targetMonth = month || moment().month() + 1;
    const targetYear = year || moment().year();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    const bills = await Bill.find({
      billDate: { $gte: startDate, $lte: endDate },
      isActive: true
    })
    .sort({ billDate: 1 })
    .lean();

    let totalTaxableValue = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    let totalGST = 0;
    let totalDiscount = 0;

    const gstRates = {
      'Gold': 3,
      'Silver': 3,
      'Diamond': 0.25,
      'Platinum': 3,
      'Other': 3
    };

    const billDetails = bills.map(bill => {
      const taxableValue = (bill.subTotal || 0) - (bill.discount || 0);
      const gst = bill.gst || 0;
      
      totalTaxableValue += taxableValue;
      totalGST += gst;
      totalDiscount += bill.discount || 0;
      
      // Assuming equal CGST and SGST for intra-state (Bihar)
      totalCGST += gst / 2;
      totalSGST += gst / 2;

      return {
        billNumber: bill.billNumber,
        date: bill.billDate,
        customerName: bill.customer?.name || 'Walk-in Customer',
        taxableValue,
        discount: bill.discount || 0,
        cgst: gst / 2,
        sgst: gst / 2,
        igst: 0,
        gst,
        total: bill.grandTotal || 0,
        paymentMode: bill.paymentMode || 'Cash'
      };
    });

    const report = {
      period: {
        month: targetMonth,
        year: targetYear,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      },
      summary: {
        totalBills: bills.length,
        totalTaxableValue,
        totalDiscount,
        gstBreakdown: {
          cgst: totalCGST,
          sgst: totalSGST,
          igst: totalIGST,
          total: totalGST
        },
        gstRates,
        netRevenue: totalTaxableValue - totalGST
      },
      bills: billDetails
    };

    if (format === 'excel') {
      return await generateGSTExcelReport(res, report);
    }

    res.json(formatResponse(report));

  } catch (error) {
    console.error('GST report error:', error);
    res.status(500).json(formatResponse(null, false, 'Failed to generate GST report'));
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const { timeFilter = 'current_month' } = req.query;

    // Calculate date range based on time filter
    const dateRanges = {
      'current_month': { 
        start: moment().startOf('month'), 
        end: moment().endOf('month') 
      },
      'previous_month': { 
        start: moment().subtract(1, 'month').startOf('month'), 
        end: moment().subtract(1, 'month').endOf('month') 
      },
      'last_3_months': { 
        start: moment().subtract(3, 'months').startOf('month'), 
        end: moment().endOf('month') 
      },
      'last_6_months': { 
        start: moment().subtract(6, 'months').startOf('month'), 
        end: moment().endOf('month') 
      },
      'current_year': { 
        start: moment().startOf('year'), 
        end: moment().endOf('year') 
      }
    };

    const range = dateRanges[timeFilter] || dateRanges.current_month;

    const query = {
      billDate: { 
        $gte: range.start.toDate(), 
        $lte: range.end.toDate() 
      },
      isActive: true
    };

    // Get current period stats
    const currentBills = await Bill.find(query).lean();

    // Get previous period stats for comparison
    const prevRange = {
      start: moment(range.start).subtract(range.end.diff(range.start, 'months'), 'months'),
      end: moment(range.start)
    };
    
    const prevBills = await Bill.find({
      billDate: { $gte: prevRange.start.toDate(), $lt: prevRange.end.toDate() },
      isActive: true
    }).lean();

    // Calculate stats
    const currentStats = this.calculatePeriodStats(currentBills);
    const prevStats = this.calculatePeriodStats(prevBills);

    // Calculate growth
    const growth = {
      sales: prevStats.totalSales > 0 ? 
        ((currentStats.totalSales - prevStats.totalSales) / prevStats.totalSales) * 100 : 0,
      bills: prevStats.totalBills > 0 ? 
        ((currentStats.totalBills - prevStats.totalBills) / prevStats.totalBills) * 100 : 0,
      avgBill: prevStats.averageBill > 0 ? 
        ((currentStats.averageBill - prevStats.averageBill) / prevStats.averageBill) * 100 : 0
    };

    // Get sales trend for chart
    const salesTrend = this.getSalesTrend(currentBills, timeFilter);

    res.json(formatResponse({
      stats: currentStats,
      growth,
      charts: {
        salesTrend,
        metalDistribution: currentStats.metalDistribution,
        paymentModes: currentStats.paymentModeDistribution
      },
      period: {
        current: {
          start: range.start.toISOString(),
          end: range.end.toISOString()
        },
        previous: {
          start: prevRange.start.toISOString(),
          end: prevRange.end.toISOString()
        }
      }
    }));

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json(formatResponse(null, false, 'Failed to load dashboard stats'));
  }
};

// Helper methods
exports.calculatePeriodStats = (bills) => {
  const stats = {
    totalSales: 0,
    totalBills: bills.length,
    averageBill: 0,
    exchangeBills: 0,
    metalDistribution: {},
    paymentModeDistribution: {},
    topCustomers: []
  };

  bills.forEach(bill => {
    stats.totalSales += bill.grandTotal || 0;
    
    if (bill.exchangeDetails?.hasExchange) {
      stats.exchangeBills++;
    }

    // Metal distribution
    bill.items?.forEach(item => {
      if (!item.isExchange) {
        const metal = item.metalType || 'Other';
        stats.metalDistribution[metal] = (stats.metalDistribution[metal] || 0) + 1;
      }
    });

    // Payment mode distribution
    const paymentMode = bill.paymentMode || 'Cash';
    stats.paymentModeDistribution[paymentMode] = 
      (stats.paymentModeDistribution[paymentMode] || 0) + 1;
  });

  stats.averageBill = stats.totalBills > 0 ? stats.totalSales / stats.totalBills : 0;

  return stats;
};

exports.getSalesTrend = (bills, timeFilter) => {
  const format = timeFilter.includes('month') ? 'DD MMM' : 'MMM';
  const days = timeFilter === 'current_month' ? 30 : 
               timeFilter === 'last_3_months' ? 90 :
               timeFilter === 'last_6_months' ? 180 : 30;

  const trend = {};
  
  // Initialize trend for last N days
  for (let i = days - 1; i >= 0; i--) {
    const date = moment().subtract(i, 'days');
    const key = date.format(format);
    trend[key] = 0;
  }

  // Aggregate sales by date
  bills.forEach(bill => {
    const date = moment(bill.billDate);
    const key = date.format(format);
    if (trend[key] !== undefined) {
      trend[key] += bill.grandTotal || 0;
    }
  });

  return {
    labels: Object.keys(trend),
    values: Object.values(trend)
  };
};

async function generateExcelReport(res, data, summary, startDate, endDate) {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Shri Mahakaleshwar Jewellers';
    workbook.created = new Date();
    
    // Worksheet 1: Sales Summary
    const summarySheet = workbook.addWorksheet('Summary');
    
    // Add company header
    summarySheet.mergeCells('A1:E1');
    summarySheet.getCell('A1').value = 'Shri Mahakaleshwar Jewellers - Sales Report';
    summarySheet.getCell('A1').font = { size: 16, bold: true };
    summarySheet.getCell('A1').alignment = { horizontal: 'center' };
    
    summarySheet.getCell('A3').value = 'Report Period:';
    summarySheet.getCell('B3').value = `${startDate || 'Start'} to ${endDate || 'End'}`;
    
    summarySheet.getCell('A5').value = 'Total Sales:';
    summarySheet.getCell('B5').value = summary.totalPeriodSales;
    summarySheet.getCell('B5').numFmt = '"₹"#,##0.00';
    
    summarySheet.getCell('A6').value = 'Total Bills:';
    summarySheet.getCell('B6').value = summary.totalPeriodBills;
    
    summarySheet.getCell('A7').value = 'Total Items Sold:';
    summarySheet.getCell('B7').value = summary.totalPeriodItems;
    
    summarySheet.getCell('A8').value = 'Average Daily Sales:';
    summarySheet.getCell('B8').value = summary.averageDailySales;
    summarySheet.getCell('B8').numFmt = '"₹"#,##0.00';
    
    summarySheet.getCell('A9').value = 'New Items Value:';
    summarySheet.getCell('B9').value = summary.newItemsValue;
    summarySheet.getCell('B9').numFmt = '"₹"#,##0.00';
    
    summarySheet.getCell('A10').value = 'Exchange Value:';
    summarySheet.getCell('B10').value = summary.exchangeValue;
    summarySheet.getCell('B10').numFmt = '"₹"#,##0.00';

    // Worksheet 2: Daily Sales
    const dailySheet = workbook.addWorksheet('Daily Sales');
    
    dailySheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Bills', key: 'bills', width: 10, style: { numFmt: '0' } },
      { header: 'Sales', key: 'sales', width: 15, style: { numFmt: '"₹"#,##0.00' } },
      { header: 'Items', key: 'items', width: 10, style: { numFmt: '0' } },
      { header: 'Gold Sales', key: 'gold', width: 15, style: { numFmt: '"₹"#,##0.00' } },
      { header: 'Silver Sales', key: 'silver', width: 15, style: { numFmt: '"₹"#,##0.00' } },
      { header: 'Diamond Sales', key: 'diamond', width: 15, style: { numFmt: '"₹"#,##0.00' } },
      { header: 'Cash', key: 'cash', width: 15, style: { numFmt: '"₹"#,##0.00' } },
      { header: 'Card', key: 'card', width: 15, style: { numFmt: '"₹"#,##0.00' } },
      { header: 'UPI', key: 'upi', width: 15, style: { numFmt: '"₹"#,##0.00' } }
    ];

    // Add data
    data.forEach(day => {
      dailySheet.addRow({
        date: day.displayDate,
        bills: day.totalBills,
        sales: day.totalSales,
        items: day.totalItems,
        gold: day.metalWise.Gold?.amount || 0,
        silver: day.metalWise.Silver?.amount || 0,
        diamond: day.metalWise.Diamond?.amount || 0,
        cash: day.paymentMode.cash || 0,
        card: day.paymentMode.card || 0,
        upi: day.paymentMode.upi || 0
      });
    });

    // Add totals row
    dailySheet.addRow([]);
    const totalRow = dailySheet.addRow(['TOTAL']);
    totalRow.getCell(1).font = { bold: true };
    totalRow.getCell(2).value = { formula: `SUM(B2:B${data.length + 1})` };
    totalRow.getCell(3).value = { formula: `SUM(C2:C${data.length + 1})` };
    totalRow.getCell(3).numFmt = '"₹"#,##0.00';

    // Set response headers
    const fileName = `sales-report-${moment().format('YYYY-MM-DD')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Excel generation error:', error);
    throw error;
  }
}

async function generateGSTExcelReport(res, gstReport) {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Shri Mahakaleshwar Jewellers';
    workbook.created = new Date();
    
    // GST Summary Sheet
    const summarySheet = workbook.addWorksheet('GST Summary');
    
    summarySheet.mergeCells('A1:G1');
    summarySheet.getCell('A1').value = 'Shri Mahakaleshwar Jewellers - GST Report';
    summarySheet.getCell('A1').font = { size: 16, bold: true };
    summarySheet.getCell('A1').alignment = { horizontal: 'center' };
    
    summarySheet.getCell('A3').value = 'Period:';
    summarySheet.getCell('B3').value = `${gstReport.period.month}/${gstReport.period.year}`;
    
    summarySheet.getCell('A5').value = 'Total Bills:';
    summarySheet.getCell('B5').value = gstReport.summary.totalBills;
    
    summarySheet.getCell('A6').value = 'Total Taxable Value:';
    summarySheet.getCell('B6').value = gstReport.summary.totalTaxableValue;
    summarySheet.getCell('B6').numFmt = '"₹"#,##0.00';
    
    summarySheet.getCell('A7').value = 'CGST:';
    summarySheet.getCell('B7').value = gstReport.summary.gstBreakdown.cgst;
    summarySheet.getCell('B7').numFmt = '"₹"#,##0.00';
    
    summarySheet.getCell('A8').value = 'SGST:';
    summarySheet.getCell('B8').value = gstReport.summary.gstBreakdown.sgst;
    summarySheet.getCell('B8').numFmt = '"₹"#,##0.00';
    
    summarySheet.getCell('A9').value = 'Total GST:';
    summarySheet.getCell('B9').value = gstReport.summary.gstBreakdown.total;
    summarySheet.getCell('B9').numFmt = '"₹"#,##0.00';
    
    summarySheet.getCell('A10').value = 'Net Revenue:';
    summarySheet.getCell('B10').value = gstReport.summary.netRevenue;
    summarySheet.getCell('B10').numFmt = '"₹"#,##0.00';

    // GST Details Sheet
    const detailsSheet = workbook.addWorksheet('GST Details');
    
    detailsSheet.columns = [
      { header: 'Bill No', key: 'billNo', width: 15 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Customer', key: 'customer', width: 25 },
      { header: 'Taxable Value', key: 'taxableValue', width: 15 },
      { header: 'CGST', key: 'cgst', width: 15 },
      { header: 'SGST', key: 'sgst', width: 15 },
      { header: 'Total GST', key: 'totalGst', width: 15 },
      { header: 'Total', key: 'total', width: 15 },
      { header: 'Payment Mode', key: 'paymentMode', width: 15 }
    ];

    gstReport.bills.forEach(bill => {
      detailsSheet.addRow({
        billNo: bill.billNumber,
        date: moment(bill.date).format('DD/MM/YYYY'),
        customer: bill.customerName,
        taxableValue: bill.taxableValue,
        cgst: bill.cgst,
        sgst: bill.sgst,
        totalGst: bill.gst,
        total: bill.total,
        paymentMode: bill.paymentMode
      });
    });

    // Format number columns
    detailsSheet.columns.forEach(column => {
      if (column.key.includes('Value') || column.key.includes('GST') || column.key === 'total') {
        column.width = 15;
        detailsSheet.eachRow((row) => {
          const cell = row.getCell(column.key);
          if (row.number > 1) {
            cell.numFmt = '"₹"#,##0.00';
          }
        });
      }
    });

    // Add totals row
    detailsSheet.addRow([]);
    const totalRow = detailsSheet.addRow(['TOTAL']);
    totalRow.getCell(1).font = { bold: true };
    totalRow.getCell(4).value = { formula: `SUM(D2:D${gstReport.bills.length + 1})` };
    totalRow.getCell(5).value = { formula: `SUM(E2:E${gstReport.bills.length + 1})` };
    totalRow.getCell(6).value = { formula: `SUM(F2:F${gstReport.bills.length + 1})` };
    totalRow.getCell(7).value = { formula: `SUM(G2:G${gstReport.bills.length + 1})` };
    totalRow.getCell(8).value = { formula: `SUM(H2:H${gstReport.bills.length + 1})` };

    // Set response headers
    const fileName = `gst-report-${gstReport.period.month}-${gstReport.period.year}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('GST Excel generation error:', error);
    throw error;
  }
}
