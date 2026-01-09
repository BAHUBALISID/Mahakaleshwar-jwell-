const AIAnalyzer = require('../utils/aiAnalyzer');
const Bill = require('../models/Bill');
const Stock = require('../models/Stock');
const Rate = require('../models/Rate');
const User = require('../models/User');
const moment = require('moment');

class AIController {
  constructor() {
    this.aiAnalyzer = new AIAnalyzer();
  }

  // Get comprehensive business insights
  async getBusinessInsights(req, res) {
    try {
      const { startDate, endDate, scope = 'overall' } = req.query;

      // Build date filter
      const dateFilter = {};
      if (startDate || endDate) {
        dateFilter.billDate = {};
        if (startDate) dateFilter.billDate.$gte = new Date(startDate);
        if (endDate) dateFilter.billDate.$lte = new Date(endDate);
      }

      // Fetch data based on scope
      let salesData;
      switch (scope) {
        case 'today':
          salesData = await this.getTodayData();
          break;
        case 'week':
          salesData = await this.getWeekData();
          break;
        case 'month':
          salesData = await this.getMonthData();
          break;
        default:
          salesData = await this.getOverallData(dateFilter);
      }

      // Generate AI insights
      const insights = await this.aiAnalyzer.analyzeSalesData(salesData);

      res.json({
        success: true,
        insights,
        metadata: {
          scope,
          period: salesData.period,
          generatedAt: new Date(),
          dataPoints: {
            bills: salesData.bills?.length || 0,
            stockItems: salesData.stockData?.length || 0
          }
        }
      });

    } catch (error) {
      console.error('Get business insights error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Get today's data
  async getTodayData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const bills = await Bill.find({
      billDate: { $gte: today, $lt: tomorrow }
    }).lean();

    const stockData = await Stock.find().lean();

    return {
      bills,
      stockData,
      period: 'Today'
    };
  }

  // Get week's data
  async getWeekData() {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const bills = await Bill.find({
      billDate: { $gte: weekAgo }
    }).lean();

    const stockData = await Stock.find().lean();

    return {
      bills,
      stockData,
      period: 'Last 7 Days'
    };
  }

  // Get month's data
  async getMonthData() {
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    const bills = await Bill.find({
      billDate: { $gte: monthAgo }
    }).lean();

    const stockData = await Stock.find().lean();

    return {
      bills,
      stockData,
      period: 'Last 30 Days'
    };
  }

  // Get overall data with filter
  async getOverallData(dateFilter) {
    const bills = await Bill.find(dateFilter).lean();
    const stockData = await Stock.find().lean();

    const period = dateFilter.billDate ? 
      `${dateFilter.billDate.$gte ? moment(dateFilter.billDate.$gte).format('DD/MM/YYYY') : 'Beginning'} to ${dateFilter.billDate.$lte ? moment(dateFilter.billDate.$lte).format('DD/MM/YYYY') : 'Today'}` :
      'All Time';

    return {
      bills,
      stockData,
      period
    };
  }

  // Get predictive analytics
  async getPredictiveAnalytics(req, res) {
    try {
      const { horizon = '30' } = req.query; // days
      
      // Get historical data
      const horizonDate = new Date();
      horizonDate.setDate(horizonDate.getDate() - parseInt(horizon));

      const bills = await Bill.find({
        billDate: { $gte: horizonDate }
      }).lean();

      // Analyze patterns
      const predictions = await this.generatePredictions(bills, parseInt(horizon));

      res.json({
        success: true,
        predictions,
        metadata: {
          horizon: `${horizon} days`,
          analyzedPeriod: `${moment(horizonDate).format('DD/MM/YYYY')} to ${moment().format('DD/MM/YYYY')}`,
          totalBillsAnalyzed: bills.length
        }
      });

    } catch (error) {
      console.error('Get predictive analytics error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Generate predictions based on historical data
  async generatePredictions(bills, horizon) {
    const predictions = {
      salesForecast: this.forecastSales(bills, horizon),
      stockRequirements: await this.forecastStockRequirements(bills, horizon),
      peakTimes: this.identifyPeakTimes(bills),
      seasonalTrends: this.identifySeasonalTrends(bills)
    };

    return predictions;
  }

  // Forecast future sales
  forecastSales(bills, days) {
    // Group sales by day
    const dailySales = {};
    bills.forEach(bill => {
      const date = moment(bill.billDate).format('YYYY-MM-DD');
      dailySales[date] = (dailySales[date] || 0) + bill.totalAmount;
    });

    // Calculate average daily sales
    const daysWithSales = Object.keys(dailySales).length;
    const totalSales = Object.values(dailySales).reduce((a, b) => a + b, 0);
    const avgDailySales = daysWithSales > 0 ? totalSales / daysWithSales : 0;

    // Simple moving average forecast
    const forecast = avgDailySales * days;

    return {
      forecastAmount: forecast,
      confidence: Math.min(0.95, daysWithSales / 30), // Confidence based on data points
      dailyAverage: avgDailySales,
      growthRate: this.calculateGrowthRate(dailySales),
      recommendation: this.getSalesRecommendation(avgDailySales, days)
    };
  }

  // Calculate growth rate
  calculateGrowthRate(dailySales) {
    const dates = Object.keys(dailySales).sort();
    if (dates.length < 2) return 0;

    const firstWeek = dates.slice(0, 7).reduce((sum, date) => sum + (dailySales[date] || 0), 0);
    const lastWeek = dates.slice(-7).reduce((sum, date) => sum + (dailySales[date] || 0), 0);

    return lastWeek > 0 ? ((lastWeek - firstWeek) / firstWeek) * 100 : 0;
  }

  // Get sales recommendations
  getSalesRecommendation(avgDailySales, days) {
    const forecast = avgDailySales * days;
    
    if (forecast > 1000000) {
      return 'Excellent sales forecast. Consider expanding stock and marketing.';
    } else if (forecast > 500000) {
      return 'Good sales forecast. Maintain current operations.';
    } else {
      return 'Consider promotional offers to boost sales.';
    }
  }

  // Forecast stock requirements
  async forecastStockRequirements(bills, days) {
    const stock = await Stock.find().lean();
    
    // Analyze sales patterns for each metal
    const metalUsage = {};
    bills.forEach(bill => {
      bill.items.forEach(item => {
        const key = `${item.metalType}_${item.purity}`;
        if (!metalUsage[key]) {
          metalUsage[key] = {
            metalType: item.metalType,
            purity: item.purity,
            totalWeightSold: 0,
            daysTracked: new Set()
          };
        }
        metalUsage[key].totalWeightSold += item.netWeight;
        metalUsage[key].daysTracked.add(moment(bill.billDate).format('YYYY-MM-DD'));
      });
    });

    // Calculate requirements
    const requirements = [];
    Object.values(metalUsage).forEach(usage => {
      const daysTracked = usage.daysTracked.size;
      const avgDailyWeight = usage.totalWeightSold / Math.max(daysTracked, 1);
      const forecastWeight = avgDailyWeight * days;
      
      // Find current stock
      const stockItem = stock.find(item => 
        item.metalType === usage.metalType && 
        item.purity === usage.purity
      );

      const currentStock = stockItem?.weight || 0;
      const daysOfStock = currentStock / avgDailyWeight;

      requirements.push({
        metalType: usage.metalType,
        purity: usage.purity,
        currentStock: currentStock,
        forecastRequirement: forecastWeight,
        daysOfStock: Math.round(daysOfStock),
        status: this.getStockStatus(daysOfStock),
        recommendation: this.getStockRecommendation(daysOfStock, forecastWeight)
      });
    });

    return requirements;
  }

  // Get stock status
  getStockStatus(daysOfStock) {
    if (daysOfStock <= 7) return 'CRITICAL';
    if (daysOfStock <= 14) return 'LOW';
    if (daysOfStock <= 30) return 'MEDIUM';
    return 'GOOD';
  }

  // Get stock recommendation
  getStockRecommendation(daysOfStock, forecastWeight) {
    if (daysOfStock <= 7) {
      return `Urgent restocking needed. Order ${forecastWeight.toFixed(2)}g immediately.`;
    } else if (daysOfStock <= 14) {
      return `Consider restocking soon. Plan for ${forecastWeight.toFixed(2)}g.`;
    } else if (daysOfStock <= 30) {
      return `Stock level adequate. Monitor weekly.`;
    } else {
      return `Stock level good. No immediate action needed.`;
    }
  }

  // Identify peak business times
  identifyPeakTimes(bills) {
    const hourlySales = Array(24).fill(0);
    const hourlyBills = Array(24).fill(0);

    bills.forEach(bill => {
      const hour = moment(bill.billDate).hour();
      hourlySales[hour] += bill.totalAmount;
      hourlyBills[hour]++;
    });

    // Find peak hours
    const maxSalesHour = hourlySales.indexOf(Math.max(...hourlySales));
    const maxBillsHour = hourlyBills.indexOf(Math.max(...hourlyBills));

    return {
      peakSalesHour: `${maxSalesHour}:00`,
      peakBillsHour: `${maxBillsHour}:00`,
      hourlyBreakdown: hourlySales.map((sales, hour) => ({
        hour: `${hour}:00`,
        sales,
        bills: hourlyBills[hour]
      })),
      recommendation: this.getStaffingRecommendation(maxBillsHour)
    };
  }

  // Get staffing recommendation
  getStaffingRecommendation(peakHour) {
    if (peakHour >= 11 && peakHour <= 16) {
      return 'Ensure maximum staff during lunch hours (11 AM - 4 PM)';
    } else if (peakHour >= 17 && peakHour <= 20) {
      return 'Evening is peak time. Extend working hours if possible.';
    } else {
      return 'Standard staffing sufficient.';
    }
  }

  // Identify seasonal trends
  identifySeasonalTrends(bills) {
    const monthlySales = Array(12).fill(0);
    const monthlyBills = Array(12).fill(0);

    bills.forEach(bill => {
      const month = moment(bill.billDate).month();
      monthlySales[month] += bill.totalAmount;
      monthlyBills[month]++;
    });

    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const trends = monthNames.map((name, index) => ({
      month: name,
      sales: monthlySales[index],
      bills: monthlyBills[index]
    }));

    // Find best and worst months
    const maxSalesMonth = monthlySales.indexOf(Math.max(...monthlySales));
    const minSalesMonth = monthlySales.indexOf(Math.min(...monthlySales));

    return {
      trends,
      bestMonth: monthNames[maxSalesMonth],
      worstMonth: monthNames[minSalesMonth],
      seasonalFactors: this.getSeasonalFactors(maxSalesMonth, minSalesMonth)
    };
  }

  // Get seasonal factors
  getSeasonalFactors(bestMonth, worstMonth) {
    const factors = [];
    
    // Festive season (Oct-Dec)
    if (bestMonth >= 9 && bestMonth <= 11) {
      factors.push('Festive season boost (Diwali, Christmas)');
    }
    
    // Wedding season (Nov-Feb)
    if (bestMonth >= 10 || bestMonth <= 1) {
      factors.push('Wedding season demand');
    }
    
    // Summer slowdown
    if (worstMonth >= 4 && worstMonth <= 6) {
      factors.push('Summer slowdown typical');
    }

    return factors.length > 0 ? factors : ['No strong seasonal patterns detected'];
  }

  // Get risk assessment
  async getRiskAssessment(req, res) {
    try {
      const risks = [];

      // Check GST compliance
      const gstRisks = await this.checkGSTRisks();
      if (gstRisks.length > 0) {
        risks.push(...gstRisks);
      }

      // Check stock risks
      const stockRisks = await this.checkStockRisks();
      if (stockRisks.length > 0) {
        risks.push(...stockRisks);
      }

      // Check exchange risks
      const exchangeRisks = this.checkExchangeRisks();
      if (exchangeRisks.length > 0) {
        risks.push(...exchangeRisks);
      }

      // Calculate overall risk score
      const riskScore = this.calculateRiskScore(risks);

      res.json({
        success: true,
        riskAssessment: {
          overallScore: riskScore,
          level: this.getRiskLevel(riskScore),
          risks,
          mitigation: this.getRiskMitigation(risks),
          lastUpdated: new Date()
        }
      });

    } catch (error) {
      console.error('Get risk assessment error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Check GST compliance risks
  async checkGSTRisks() {
    const risks = [];
    
    // Find bills with GST applicable items but no GST
    const bills = await Bill.find({
      totalGst: 0
    }).lean();

    const gstBills = bills.filter(bill => {
      return bill.items.some(item => {
        // This would check against rate configuration
        // For now, we'll check if metal value is significant
        const itemValue = item.netWeight * item.rate;
        return itemValue > 50000; // Assumption: High value items should have GST
      });
    });

    if (gstBills.length > 0) {
      risks.push({
        type: 'GST_COMPLIANCE',
        severity: 'HIGH',
        description: `${gstBills.length} high-value bills found without GST`,
        impact: 'Potential regulatory issues and penalties',
        suggestion: 'Review GST configuration and bill generation process'
      });
    }

    return risks;
  }

  // Check stock risks
  async checkStockRisks() {
    const risks = [];
    const stock = await Stock.find().lean();

    // Check for out of stock items
    const outOfStock = stock.filter(item => item.quantity === 0);
    if (outOfStock.length > 0) {
      risks.push({
        type: 'STOCK_OUTAGE',
        severity: 'HIGH',
        description: `${outOfStock.length} items completely out of stock`,
        impact: 'Lost sales opportunities',
        suggestion: 'Immediate restocking required'
      });
    }

    // Check for slow-moving items
    const slowMoving = stock.filter(item => {
      // Items with no sales in last 30 days
      // This would need actual sales data
      return item.quantity > 10; // Example threshold
    });

    if (slowMoving.length > 0) {
      risks.push({
        type: 'SLOW_MOVING_STOCK',
        severity: 'MEDIUM',
        description: `${slowMoving.length} items moving slowly`,
        impact: 'Capital tied up in inventory',
        suggestion: 'Consider discounts or promotions to move inventory'
      });
    }

    return risks;
  }

  // Check exchange risks
  checkExchangeRisks() {
    const risks = [];
    
    // Fixed 3% deduction ensures no exchange rate risk
    // But we can check for high exchange volume
    
    risks.push({
      type: 'EXCHANGE_VOLUME',
      severity: 'LOW',
      description: 'Monitor exchange volume to ensure profitability',
      impact: 'High exchange volume can affect new sales',
      suggestion: 'Track exchange to new sale ratio monthly'
    });

    return risks;
  }

  // Calculate risk score
  calculateRiskScore(risks) {
    const severityWeights = {
      'HIGH': 3,
      'MEDIUM': 2,
      'LOW': 1
    };

    const totalWeight = risks.reduce((sum, risk) => 
      sum + severityWeights[risk.severity], 0);
    
    const maxPossible = risks.length * 3;
    
    return maxPossible > 0 ? (totalWeight / maxPossible) * 100 : 0;
  }

  // Get risk level
  getRiskLevel(score) {
    if (score >= 70) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    if (score >= 10) return 'LOW';
    return 'MINIMAL';
  }

  // Get risk mitigation strategies
  getRiskMitigation(risks) {
    const mitigation = [];

    if (risks.some(r => r.type === 'GST_COMPLIANCE')) {
      mitigation.push({
        action: 'GST Compliance Audit',
        priority: 'HIGH',
        timeline: 'Immediate',
        responsible: 'Admin'
      });
    }

    if (risks.some(r => r.type === 'STOCK_OUTAGE')) {
      mitigation.push({
        action: 'Stock Replenishment Plan',
        priority: 'HIGH',
        timeline: 'Within 7 days',
        responsible: 'Stock Manager'
      });
    }

    if (risks.some(r => r.type === 'EXCHANGE_VOLUME')) {
      mitigation.push({
        action: 'Exchange Policy Review',
        priority: 'MEDIUM',
        timeline: 'Within 30 days',
        responsible: 'Management'
      });
    }

    return mitigation;
  }
}

module.exports = new AIController();
