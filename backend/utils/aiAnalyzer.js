class AIAnalyzer {
  constructor() {
    this.analysisCache = new Map();
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes
  }

  async analyzeSalesData(salesData) {
    const cacheKey = `sales_${Date.now()}`;
    if (this.analysisCache.has(cacheKey)) {
      const cached = this.analysisCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheDuration) {
        return cached.data;
      }
    }

    const analysis = {
      executiveSummary: this.generateExecutiveSummary(salesData),
      metalPerformance: this.analyzeMetalPerformance(salesData),
      purityInsights: this.analyzePurityInsights(salesData),
      exchangeImpact: this.analyzeExchangeImpact(salesData),
      stockInsights: this.analyzeStockInsights(salesData.stockData),
      riskAlerts: this.generateRiskAlerts(salesData),
      recommendations: this.generateRecommendations(salesData),
      generatedAt: new Date()
    };

    this.analysisCache.set(cacheKey, {
      data: analysis,
      timestamp: Date.now()
    });

    return analysis;
  }

  generateExecutiveSummary(salesData) {
    const totalSales = salesData.bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const totalBills = salesData.bills.length;
    const avgBillValue = totalSales / totalBills;
    const exchangeBills = salesData.bills.filter(bill => 
      bill.items.some(item => item.isExchange)
    ).length;

    return {
      period: salesData.period,
      totalSales,
      totalBills,
      avgBillValue,
      exchangePercentage: (exchangeBills / totalBills) * 100,
      topPerformingDay: this.getTopPerformingDay(salesData.bills),
      peakHour: this.getPeakHour(salesData.bills)
    };
  }

  analyzeMetalPerformance(salesData) {
    const metalStats = {};
    
    salesData.bills.forEach(bill => {
      bill.items.forEach(item => {
        const metal = item.metalType;
        if (!metalStats[metal]) {
          metalStats[metal] = {
            count: 0,
            totalWeight: 0,
            totalValue: 0,
            avgRate: 0
          };
        }
        
        const itemValue = item.netWeight * item.rate;
        metalStats[metal].count++;
        metalStats[metal].totalWeight += item.netWeight;
        metalStats[metal].totalValue += itemValue;
      });
    });

    // Calculate averages
    Object.keys(metalStats).forEach(metal => {
      metalStats[metal].avgRate = metalStats[metal].totalValue / metalStats[metal].totalWeight;
      metalStats[metal].contributionPercentage = (metalStats[metal].totalValue / 
        Object.values(metalStats).reduce((sum, stat) => sum + stat.totalValue, 0)) * 100;
    });

    // Sort by contribution
    const sortedMetals = Object.entries(metalStats)
      .sort(([,a], [,b]) => b.totalValue - a.totalValue)
      .reduce((acc, [metal, stats]) => {
        acc[metal] = stats;
        return acc;
      }, {});

    return sortedMetals;
  }

  analyzePurityInsights(salesData) {
    const purityStats = {};
    
    salesData.bills.forEach(bill => {
      bill.items.forEach(item => {
        const key = `${item.metalType}_${item.purity}`;
        if (!purityStats[key]) {
          purityStats[key] = {
            metal: item.metalType,
            purity: item.purity,
            count: 0,
            totalWeight: 0,
            totalValue: 0,
            avgMakingCharge: 0,
            makingCharges: []
          };
        }
        
        const makingCharge = this.calculateMakingCharge(item);
        purityStats[key].count++;
        purityStats[key].totalWeight += item.netWeight;
        purityStats[key].totalValue += (item.netWeight * item.rate);
        purityStats[key].makingCharges.push(makingCharge);
      });
    });

    // Calculate averages
    Object.keys(purityStats).forEach(key => {
      const stats = purityStats[key];
      stats.avgMakingCharge = stats.makingCharges.reduce((a, b) => a + b, 0) / stats.makingCharges.length;
      delete stats.makingCharges;
    });

    return purityStats;
  }

  analyzeExchangeImpact(salesData) {
    const exchangeData = {
      totalExchangeValue: 0,
      totalDeduction: 0,
      exchangeByMetal: {},
      avgExchangeValue: 0,
      exchangeCount: 0
    };

    salesData.bills.forEach(bill => {
      bill.items.forEach(item => {
        if (item.isExchange) {
          exchangeData.exchangeCount++;
          const itemValue = item.netWeight * item.rate;
          exchangeData.totalExchangeValue += itemValue;
          exchangeData.totalDeduction += (item.exchangeDeduction || 0);
          
          const metal = item.metalType;
          if (!exchangeData.exchangeByMetal[metal]) {
            exchangeData.exchangeByMetal[metal] = {
              count: 0,
              totalValue: 0,
              totalWeight: 0
            };
          }
          exchangeData.exchangeByMetal[metal].count++;
          exchangeData.exchangeByMetal[metal].totalValue += itemValue;
          exchangeData.exchangeByMetal[metal].totalWeight += item.netWeight;
        }
      });
    });

    exchangeData.avgExchangeValue = exchangeData.exchangeCount > 0 ? 
      exchangeData.totalExchangeValue / exchangeData.exchangeCount : 0;
    exchangeData.deductionPercentage = exchangeData.totalExchangeValue > 0 ?
      (exchangeData.totalDeduction / exchangeData.totalExchangeValue) * 100 : 0;

    return exchangeData;
  }

  analyzeStockInsights(stockData) {
    const insights = {
      lowStockItems: [],
      highValueStock: [],
      slowMovingItems: [],
      stockTurnover: 0,
      totalStockValue: 0
    };

    stockData.forEach(item => {
      const itemValue = item.weight * (item.sellingReferencePrice || 0);
      insights.totalStockValue += itemValue;
      
      if (item.isLowStock) {
        insights.lowStockItems.push({
          product: item.productName,
          metal: `${item.metalType} ${item.purity}`,
          quantity: item.quantity,
          weight: item.weight,
          daysToStockOut: this.calculateDaysToStockOut(item)
        });
      }
      
      if (itemValue > 100000) { // High value threshold
        insights.highValueStock.push({
          product: item.productName,
          metal: `${item.metalType} ${item.purity}`,
          value: itemValue
        });
      }
    });

    // Calculate stock turnover if we have sales data
    if (stockData.salesData) {
      const totalSales = stockData.salesData.reduce((sum, sale) => sum + sale.totalAmount, 0);
      insights.stockTurnover = insights.totalStockValue > 0 ? 
        totalSales / insights.totalStockValue : 0;
    }

    return insights;
  }

  generateRiskAlerts(salesData) {
    const alerts = [];
    const today = new Date();
    const sevenDaysAgo = new Date(today.setDate(today.getDate() - 7));

    // Check for sales decline
    const recentSales = salesData.bills.filter(bill => 
      new Date(bill.billDate) >= sevenDaysAgo
    );
    const previousWeekSales = salesData.bills.filter(bill => 
      new Date(bill.billDate) < sevenDaysAgo && 
      new Date(bill.billDate) >= new Date(today.setDate(today.getDate() - 14))
    );

    if (recentSales.length > 0 && previousWeekSales.length > 0) {
      const recentTotal = recentSales.reduce((sum, bill) => sum + bill.totalAmount, 0);
      const previousTotal = previousWeekSales.reduce((sum, bill) => sum + bill.totalAmount, 0);
      
      if (recentTotal < previousTotal * 0.7) { // 30% decline
        alerts.push({
          type: 'SALES_DECLINE',
          severity: 'HIGH',
          message: `Sales declined by ${((previousTotal - recentTotal) / previousTotal * 100).toFixed(1)}% compared to previous week`,
          suggestion: 'Consider promotional offers or review pricing strategy'
        });
      }
    }

    // Check for high exchange rate
    const exchangeRate = this.analyzeExchangeImpact(salesData);
    if (exchangeRate.exchangeCount / salesData.bills.length > 0.3) { // More than 30% exchange
      alerts.push({
        type: 'HIGH_EXCHANGE_RATE',
        severity: 'MEDIUM',
        message: `Exchange transactions are ${((exchangeRate.exchangeCount / salesData.bills.length) * 100).toFixed(1)}% of total bills`,
        suggestion: 'Review exchange policy or promote new purchases'
      });
    }

    // Check for GST compliance
    const billsWithoutGST = salesData.bills.filter(bill => 
      bill.totalGst === 0 && 
      bill.items.some(item => {
        // Check if any item should have GST
        const metalType = item.metalType;
        // This would need to check against rate configuration
        return true; // Simplified
      })
    );

    if (billsWithoutGST.length > 0) {
      alerts.push({
        type: 'GST_COMPLIANCE',
        severity: 'HIGH',
        message: `${billsWithoutGST.length} bills found without GST where applicable`,
        suggestion: 'Review GST configuration and ensure proper billing'
      });
    }

    return alerts;
  }

  generateRecommendations(salesData) {
    const recommendations = [];
    const metalPerformance = this.analyzeMetalPerformance(salesData);
    const purityInsights = this.analyzePurityInsights(salesData);
    const exchangeImpact = this.analyzeExchangeImpact(salesData);

    // Stock recommendations based on sales
    const topMetals = Object.entries(metalPerformance)
      .sort(([,a], [,b]) => b.totalValue - a.totalValue)
      .slice(0, 3);

    topMetals.forEach(([metal, stats]) => {
      recommendations.push({
        type: 'STOCK_MANAGEMENT',
        priority: 'HIGH',
        message: `Increase stock for ${metal} (contributes ${stats.contributionPercentage.toFixed(1)}% of sales)`,
        action: `Procure additional ${metal} stock`
      });
    });

    // Pricing recommendations
    const highMakingChargeItems = Object.values(purityInsights)
      .filter(stat => stat.avgMakingCharge > 1000) // Threshold
      .sort((a, b) => b.avgMakingCharge - a.avgMakingCharge);

    if (highMakingChargeItems.length > 0) {
      recommendations.push({
        type: 'PRICING_OPTIMIZATION',
        priority: 'MEDIUM',
        message: `High making charges detected for ${highMakingChargeItems.length} purity categories`,
        action: 'Review making charge pricing strategy'
      });
    }

    // Exchange business recommendations
    if (exchangeImpact.exchangeCount > 10) {
      recommendations.push({
        type: 'BUSINESS_DEVELOPMENT',
        priority: 'LOW',
        message: `Significant exchange business (${exchangeImpact.exchangeCount} transactions)`,
        action: 'Consider loyalty program for exchange customers'
      });
    }

    // Seasonal recommendations
    const month = new Date().getMonth();
    if (month >= 9 && month <= 11) { // Festival season
      recommendations.push({
        type: 'SEASONAL',
        priority: 'HIGH',
        message: 'Festive season approaching',
        action: 'Stock up on festive collections and launch promotions'
      });
    }

    return recommendations;
  }

  calculateMakingCharge(item) {
    switch (item.makingChargeType) {
      case 'FIX':
        return item.makingChargeValue;
      case '%':
        return (item.netWeight * item.rate * item.makingChargeValue) / 100;
      case 'GRM':
        return item.netWeight * item.makingChargeValue;
      default:
        return 0;
    }
  }

  getTopPerformingDay(bills) {
    const daySales = {};
    bills.forEach(bill => {
      const day = new Date(bill.billDate).toLocaleDateString('en-IN', { weekday: 'long' });
      daySales[day] = (daySales[day] || 0) + bill.totalAmount;
    });
    
    return Object.entries(daySales)
      .sort(([,a], [,b]) => b - a)[0] || ['N/A', 0];
  }

  getPeakHour(bills) {
    const hourSales = Array(24).fill(0);
    bills.forEach(bill => {
      const hour = new Date(bill.billDate).getHours();
      hourSales[hour] += bill.totalAmount;
    });
    
    const peakHour = hourSales.indexOf(Math.max(...hourSales));
    return `${peakHour}:00 - ${peakHour + 1}:00`;
  }

  calculateDaysToStockOut(stockItem) {
    // Simplified calculation - would need sales velocity data
    const avgDailySales = 1; // This should be calculated from historical data
    return stockItem.quantity / avgDailySales;
  }
}

module.exports = AIAnalyzer;
