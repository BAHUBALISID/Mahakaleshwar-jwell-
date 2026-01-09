const Bill = require('../models/Bill');
const Stock = require('../models/Stock');
const Rate = require('../models/Rate');
const AIAnalyzer = require('../utils/aiAnalyzer');
const moment = require('moment');

class ReportController {
    async getSalesReport(req, res) {
        try {
            const { startDate, endDate, metalType, purity, customerPhone } = req.query;

            // Build filter
            const filter = {};
            
            // Date filter
            if (startDate || endDate) {
                filter.billDate = {};
                if (startDate) filter.billDate.$gte = new Date(startDate);
                if (endDate) filter.billDate.$lte = new Date(endDate);
            }

            // Customer filter
            if (customerPhone) {
                filter.customerPhone = customerPhone;
            }

            // Metal type filter (applied after aggregation)
            const bills = await Bill.find(filter)
                .populate('createdBy', 'name')
                .sort({ billDate: -1 })
                .lean();

            // Process and filter bills
            let processedBills = bills;

            if (metalType || purity) {
                processedBills = bills.filter(bill => {
                    return bill.items.some(item => {
                        let match = true;
                        if (metalType) match = match && item.metalType === metalType;
                        if (purity) match = match && item.purity === purity;
                        return match;
                    });
                });
            }

            // Calculate summary
            const summary = {
                totalBills: processedBills.length,
                totalSales: processedBills.reduce((sum, bill) => sum + bill.totalAmount, 0),
                totalGST: processedBills.reduce((sum, bill) => sum + bill.totalGst, 0),
                totalItems: processedBills.reduce((sum, bill) => sum + bill.items.length, 0)
            };

            summary.avgBillValue = summary.totalBills > 0 ? summary.totalSales / summary.totalBills : 0;

            // Metal-wise breakdown
            const metalBreakdown = {};
            processedBills.forEach(bill => {
                bill.items.forEach(item => {
                    const key = `${item.metalType}_${item.purity}`;
                    if (!metalBreakdown[key]) {
                        metalBreakdown[key] = {
                            metalType: item.metalType,
                            purity: item.purity,
                            count: 0,
                            totalWeight: 0,
                            totalValue: 0
                        };
                    }
                    metalBreakdown[key].count++;
                    metalBreakdown[key].totalWeight += item.netWeight;
                    metalBreakdown[key].totalValue += (item.netWeight * item.rate);
                });
            });

            // Calculate contribution percentages
            const totalMetalValue = Object.values(metalBreakdown).reduce((sum, item) => sum + item.totalValue, 0);
            Object.values(metalBreakdown).forEach(item => {
                item.contributionPercentage = totalMetalValue > 0 ? (item.totalValue / totalMetalValue) * 100 : 0;
            });

            // Daily trend
            const dailyTrend = {};
            processedBills.forEach(bill => {
                const date = moment(bill.billDate).format('YYYY-MM-DD');
                if (!dailyTrend[date]) {
                    dailyTrend[date] = {
                        date,
                        dailySales: 0,
                        billCount: 0,
                        items: 0
                    };
                }
                dailyTrend[date].dailySales += bill.totalAmount;
                dailyTrend[date].billCount++;
                dailyTrend[date].items += bill.items.length;
            });

            const dailyTrendArray = Object.values(dailyTrend).sort((a, b) => 
                new Date(a.date) - new Date(b.date)
            );

            res.json({
                success: true,
                report: {
                    period: {
                        startDate: startDate || 'Beginning',
                        endDate: endDate || 'Today'
                    },
                    summary,
                    metalBreakdown: Object.values(metalBreakdown),
                    dailyTrend: dailyTrendArray,
                    bills: processedBills
                }
            });

        } catch (error) {
            console.error('Sales report error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getStockReport(req, res) {
        try {
            const { metalType, lowStockOnly, stockType } = req.query;

            const filter = {};
            if (metalType) filter.metalType = metalType;
            if (lowStockOnly === 'true') filter.isLowStock = true;

            // Additional filtering based on stock type
            if (stockType === 'low') {
                filter.isLowStock = true;
            } else if (stockType === 'zero') {
                filter.quantity = 0;
            } else if (stockType === 'slow') {
                // This would need additional logic for slow moving items
            }

            const stock = await Stock.find(filter)
                .sort({ metalType: 1, purity: 1, productName: 1 })
                .lean();

            const totalValue = stock.reduce((sum, item) => {
                return sum + (item.weight * (item.sellingReferencePrice || 0));
            }, 0);

            // Metal-wise breakdown
            const metalBreakdown = {};
            stock.forEach(item => {
                const key = `${item.metalType}_${item.purity}`;
                if (!metalBreakdown[key]) {
                    metalBreakdown[key] = {
                        metalType: item.metalType,
                        purity: item.purity,
                        totalWeight: 0,
                        totalValue: 0,
                        items: 0
                    };
                }
                metalBreakdown[key].totalWeight += item.weight;
                metalBreakdown[key].totalValue += (item.weight * (item.sellingReferencePrice || 0));
                metalBreakdown[key].items++;
            });

            res.json({
                success: true,
                report: {
                    totalItems: stock.length,
                    totalValue,
                    lowStockCount: stock.filter(item => item.isLowStock).length,
                    zeroStockCount: stock.filter(item => item.quantity === 0).length,
                    metalBreakdown: Object.values(metalBreakdown),
                    stock
                }
            });

        } catch (error) {
            console.error('Stock report error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getGSTReport(req, res) {
        try {
            const { startDate, endDate, gstType } = req.query;

            const filter = {};
            if (startDate || endDate) {
                filter.billDate = {};
                if (startDate) filter.billDate.$gte = new Date(startDate);
                if (endDate) filter.billDate.$lte = new Date(endDate);
            }

            // GST type filter
            if (gstType === 'with') {
                filter.totalGst = { $gt: 0 };
            } else if (gstType === 'without') {
                filter.totalGst = 0;
            }

            const bills = await Bill.find(filter)
                .sort({ billDate: 1 })
                .lean();

            const gstSummary = {
                totalCGST: bills.reduce((sum, bill) => sum + bill.cgst, 0),
                totalSGST: bills.reduce((sum, bill) => sum + bill.sgst, 0),
                totalIGST: bills.reduce((sum, bill) => sum + bill.igst, 0),
                totalGST: bills.reduce((sum, bill) => sum + bill.totalGst, 0),
                billsWithGST: bills.filter(bill => bill.totalGst > 0).length,
                billsWithoutGST: bills.filter(bill => bill.totalGst === 0).length
            };

            // Monthly breakdown
            const monthlyBreakdown = {};
            bills.forEach(bill => {
                const monthYear = moment(bill.billDate).format('MMM YYYY');
                if (!monthlyBreakdown[monthYear]) {
                    monthlyBreakdown[monthYear] = {
                        month: monthYear,
                        cgst: 0,
                        sgst: 0,
                        igst: 0,
                        total: 0,
                        bills: 0
                    };
                }
                monthlyBreakdown[monthYear].cgst += bill.cgst;
                monthlyBreakdown[monthYear].sgst += bill.sgst;
                monthlyBreakdown[monthYear].igst += bill.igst;
                monthlyBreakdown[monthYear].total += bill.totalGst;
                monthlyBreakdown[monthYear].bills++;
            });

            res.json({
                success: true,
                report: {
                    period: {
                        startDate: startDate || 'Beginning',
                        endDate: endDate || 'Today'
                    },
                    summary: gstSummary,
                    monthlyBreakdown: Object.values(monthlyBreakdown),
                    bills: bills.map(bill => ({
                        billNumber: bill.billNumber,
                        date: bill.billDate,
                        customerName: bill.customerName,
                        cgst: bill.cgst,
                        sgst: bill.sgst,
                        igst: bill.igst,
                        totalGst: bill.totalGst
                    }))
                }
            });

        } catch (error) {
            console.error('GST report error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getExchangeReport(req, res) {
        try {
            const { startDate, endDate, metalType } = req.query;

            const filter = {
                'items.isExchange': true
            };

            if (startDate || endDate) {
                filter.billDate = {};
                if (startDate) filter.billDate.$gte = new Date(startDate);
                if (endDate) filter.billDate.$lte = new Date(endDate);
            }

            const bills = await Bill.find(filter)
                .populate('createdBy', 'name')
                .sort({ billDate: -1 })
                .lean();

            const exchangeSummary = {
                totalExchangeBills: 0,
                totalExchangeItems: 0,
                totalExchangeValue: 0,
                totalDeduction: 0,
                netExchangeValue: 0
            };

            const metalBreakdown = {};
            const processedBills = [];

            bills.forEach(bill => {
                const exchangeItems = bill.items.filter(item => item.isExchange);
                
                // Filter by metal type if specified
                let filteredItems = exchangeItems;
                if (metalType) {
                    filteredItems = exchangeItems.filter(item => item.metalType === metalType);
                }

                if (filteredItems.length === 0) return;

                exchangeSummary.totalExchangeBills++;
                
                const billExchangeValue = filteredItems.reduce((sum, item) => {
                    const itemValue = item.netWeight * item.rate;
                    return sum + itemValue;
                }, 0);

                const billDeduction = filteredItems.reduce((sum, item) => {
                    return sum + (item.exchangeDeduction || 0);
                }, 0);

                processedBills.push({
                    billNumber: bill.billNumber,
                    billDate: bill.billDate,
                    customerName: bill.customerName,
                    exchangeItems: filteredItems.length,
                    exchangeValue: billExchangeValue,
                    deduction: billDeduction
                });

                // Update summary
                exchangeSummary.totalExchangeItems += filteredItems.length;
                exchangeSummary.totalExchangeValue += billExchangeValue;
                exchangeSummary.totalDeduction += billDeduction;
                exchangeSummary.netExchangeValue += (billExchangeValue - billDeduction);

                // Update metal breakdown
                filteredItems.forEach(item => {
                    const key = `${item.metalType}_${item.purity}`;
                    if (!metalBreakdown[key]) {
                        metalBreakdown[key] = {
                            metalType: item.metalType,
                            purity: item.purity,
                            count: 0,
                            totalWeight: 0,
                            totalValue: 0
                        };
                    }
                    metalBreakdown[key].count++;
                    metalBreakdown[key].totalWeight += item.netWeight;
                    metalBreakdown[key].totalValue += (item.netWeight * item.rate);
                });
            });

            res.json({
                success: true,
                report: {
                    period: {
                        startDate: startDate || 'Beginning',
                        endDate: endDate || 'Today'
                    },
                    summary: exchangeSummary,
                    metalBreakdown: Object.values(metalBreakdown),
                    bills: processedBills
                }
            });

        } catch (error) {
            console.error('Exchange report error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getDashboardOverview(req, res) {
        try {
            // Today's date
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Yesterday
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            // Last 7 days
            const lastWeek = new Date(today);
            lastWeek.setDate(lastWeek.getDate() - 7);

            // This month
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

            // Get today's bills
            const todayBills = await Bill.find({
                billDate: { $gte: today, $lt: tomorrow }
            });

            // Get yesterday's bills for comparison
            const yesterdayBills = await Bill.find({
                billDate: { $gte: yesterday, $lt: today }
            });

            // Get this month's bills
            const monthBills = await Bill.find({
                billDate: { $gte: firstDayOfMonth }
            });

            // Get stock data
            const stock = await Stock.find();
            const lowStockItems = stock.filter(item => item.isLowStock);

            // Calculate statistics
            const todaySales = todayBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
            const yesterdaySales = yesterdayBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
            const monthSales = monthBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
            const todayGST = todayBills.reduce((sum, bill) => sum + bill.totalGst, 0);

            // Exchange items today
            const todayExchanges = todayBills.filter(bill => 
                bill.items.some(item => item.isExchange)
            ).length;

            // Stock value
            const stockValue = stock.reduce((sum, item) => {
                return sum + (item.weight * (item.sellingReferencePrice || 0));
            }, 0);

            // Active users
            const activeUsers = await User.countDocuments({ isActive: true });

            // Daily trend for chart
            const dailyTrend = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const nextDay = new Date(date);
                nextDay.setDate(nextDay.getDate() + 1);

                const dayBills = await Bill.find({
                    billDate: { $gte: date, $lt: nextDay }
                });

                const daySales = dayBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
                
                dailyTrend.push({
                    date: date.toISOString().split('T')[0],
                    dailySales: daySales,
                    billCount: dayBills.length
                });
            }

            // Metal sales distribution for chart
            const metalSales = {};
            monthBills.forEach(bill => {
                bill.items.forEach(item => {
                    const metal = item.metalType;
                    if (!metalSales[metal]) {
                        metalSales[metal] = 0;
                    }
                    metalSales[metal] += (item.netWeight * item.rate);
                });
            });

            const metalSalesArray = Object.entries(metalSales).map(([metal, value]) => ({
                metal,
                value
            }));

            res.json({
                success: true,
                stats: {
                    todaySales,
                    yesterdaySales,
                    monthSales,
                    todayGST,
                    todayBills: todayBills.length,
                    todayExchanges,
                    lowStockItems: lowStockItems.length,
                    stockValue,
                    activeUsers,
                    salesChange: yesterdaySales > 0 ? 
                        ((todaySales - yesterdaySales) / yesterdaySales) * 100 : 0
                },
                dailyTrend,
                metalSales: metalSalesArray
            });

        } catch (error) {
            console.error('Dashboard overview error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getAIInsights(req, res) {
        try {
            const { startDate, endDate } = req.query;

            const filter = {};
            if (startDate || endDate) {
                filter.billDate = {};
                if (startDate) filter.billDate.$gte = new Date(startDate);
                if (endDate) filter.billDate.$lte = new Date(endDate);
            }

            const bills = await Bill.find(filter).lean();
            const stock = await Stock.find().lean();

            const salesData = {
                bills,
                period: {
                    startDate: startDate || 'Beginning',
                    endDate: endDate || 'Today'
                },
                stockData: stock
            };

            const aiAnalyzer = new AIAnalyzer();
            const insights = await aiAnalyzer.analyzeSalesData(salesData);

            res.json({
                success: true,
                insights
            });

        } catch (error) {
            console.error('AI insights error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async exportReport(req, res) {
        try {
            const { format, startDate, endDate, reportType } = req.query;

            // Based on report type, generate appropriate data
            let reportData;
            switch (reportType) {
                case 'sales':
                    reportData = await this.generateSalesData(startDate, endDate);
                    break;
                case 'stock':
                    reportData = await this.generateStockData();
                    break;
                case 'gst':
                    reportData = await this.generateGSTData(startDate, endDate);
                    break;
                case 'exchange':
                    reportData = await this.generateExchangeData(startDate, endDate);
                    break;
                default:
                    reportData = await this.generateSalesData(startDate, endDate);
            }

            if (format === 'pdf') {
                // Generate PDF (you would implement PDF generation here)
                res.json({
                    success: true,
                    message: 'PDF export not implemented in this example',
                    data: reportData
                });
            } else if (format === 'excel') {
                // Generate Excel
                res.json({
                    success: true,
                    message: 'Excel export not implemented in this example',
                    data: reportData
                });
            } else {
                res.json({
                    success: true,
                    data: reportData
                });
            }

        } catch (error) {
            console.error('Export report error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async generateSalesData(startDate, endDate) {
        const filter = {};
        if (startDate || endDate) {
            filter.billDate = {};
            if (startDate) filter.billDate.$gte = new Date(startDate);
            if (endDate) filter.billDate.$lte = new Date(endDate);
        }

        const bills = await Bill.find(filter).lean();

        return bills.map(bill => ({
            'Bill Number': bill.billNumber,
            'Date': new Date(bill.billDate).toLocaleDateString('en-IN'),
            'Customer Name': bill.customerName,
            'Customer Phone': bill.customerPhone,
            'Subtotal': bill.subtotal,
            'CGST': bill.cgst,
            'SGST': bill.sgst,
            'IGST': bill.igst,
            'Total GST': bill.totalGst,
            'Total Amount': bill.totalAmount,
            'Payment Method': bill.paymentMethod,
            'Payment Status': bill.paymentStatus,
            'Items Count': bill.items.length
        }));
    }

    async generateStockData() {
        const stock = await Stock.find().lean();

        return stock.map(item => ({
            'Metal Type': item.metalType,
            'Purity': item.purity,
            'Product Name': item.productName,
            'Quantity': item.quantity,
            'Weight (g)': item.weight,
            'Cost Price': item.costPrice || 0,
            'Selling Price': item.sellingReferencePrice || 0,
            'Stock Value': item.weight * (item.sellingReferencePrice || 0),
            'Low Stock Threshold': item.lowStockThreshold,
            'Status': item.isLowStock ? 'Low Stock' : 'Normal',
            'Last Updated': new Date(item.lastUpdated).toLocaleDateString('en-IN')
        }));
    }

    async generateGSTData(startDate, endDate) {
        const filter = {};
        if (startDate || endDate) {
            filter.billDate = {};
            if (startDate) filter.billDate.$gte = new Date(startDate);
            if (endDate) filter.billDate.$lte = new Date(endDate);
        }

        const bills = await Bill.find(filter).lean();

        return bills.map(bill => ({
            'Bill Number': bill.billNumber,
            'Date': new Date(bill.billDate).toLocaleDateString('en-IN'),
            'Customer Name': bill.customerName,
            'CGST': bill.cgst,
            'SGST': bill.sgst,
            'IGST': bill.igst,
            'Total GST': bill.totalGst,
            'Total Amount': bill.totalAmount,
            'GST Percentage': bill.totalAmount > 0 ? ((bill.totalGst / bill.totalAmount) * 100).toFixed(2) + '%' : '0%'
        }));
    }

    async generateExchangeData(startDate, endDate) {
        const filter = {
            'items.isExchange': true
        };

        if (startDate || endDate) {
            filter.billDate = {};
            if (startDate) filter.billDate.$gte = new Date(startDate);
            if (endDate) filter.billDate.$lte = new Date(endDate);
        }

        const bills = await Bill.find(filter).lean();

        const exchangeData = [];
        bills.forEach(bill => {
            const exchangeItems = bill.items.filter(item => item.isExchange);
            exchangeItems.forEach(item => {
                exchangeData.push({
                    'Bill Number': bill.billNumber,
                    'Date': new Date(bill.billDate).toLocaleDateString('en-IN'),
                    'Customer Name': bill.customerName,
                    'Product': item.productName,
                    'Metal': item.metalType,
                    'Purity': item.purity,
                    'Weight (g)': item.netWeight,
                    'Rate': item.rate,
                    'Metal Value': item.netWeight * item.rate,
                    'Deduction (3%)': item.exchangeDeduction || 0,
                    'Net Value': (item.netWeight * item.rate) - (item.exchangeDeduction || 0)
                });
            });
        });

        return exchangeData;
    }
}

module.exports = new ReportController();
