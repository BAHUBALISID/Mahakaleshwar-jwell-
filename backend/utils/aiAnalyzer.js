const OpenAI = require('openai');
const Bill = require('../models/Bill');
const moment = require('moment');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class AIAnalyzer {
  constructor() {
    this.systemPrompt = `You are a senior jewellery business analyst with 20+ years of experience.
    Analyze the following sales data and provide structured business insights.
    
    IMPORTANT RULES:
    1. NEVER mention any customer personal data (names, mobile, PAN, Aadhaar)
    2. Focus only on business metrics and trends
    3. Provide actionable recommendations
    4. Be specific and data-driven
    5. Format output in clear sections
    
    Analysis Structure:
    1. EXECUTIVE SUMMARY
    2. METAL-WISE PERFORMANCE
    3. ITEM CATEGORY ANALYSIS
    4. CUSTOMER BEHAVIOR TRENDS
    5. EXCHANGE BUSINESS ANALYSIS
    6. RISK ALERTS
    7. RECOMMENDATIONS
    8. FORECAST FOR NEXT PERIOD`;
  }

  async analyzeSalesData(filter) {
    try {
      // Build query based on filter
      const query = this.buildQuery(filter);
      
      // Fetch data from database
      const bills = await Bill.find(query)
        .populate('createdBy', 'name')
        .lean();

      if (bills.length === 0) {
        return {
          summary: 'No data available for the selected period',
          insights: []
        };
      }

      // Prepare data for AI analysis (remove sensitive info)
      const analysisData = this.prepareDataForAI(bills);
      
      // Get AI analysis
      const insights = await this.getAIAnalysis(analysisData, filter);
      
      // Calculate metrics for verification
      const metrics = this.calculateMetrics(bills);
      
      return {
        summary: `Analysis of ${bills.length} bills from ${filter.startDate || 'beginning'} to ${filter.endDate || 'now'}`,
        metrics,
        insights,
        generatedAt: new Date()
      };

    } catch (error) {
      console.error('AI Analysis Error:', error);
      throw new Error('Failed to generate AI analysis');
    }
  }

  buildQuery(filter) {
    const query = { isActive: true };
    
    if (filter.startDate || filter.endDate) {
      query.billDate = {};
      if (filter.startDate) {
        query.billDate.$gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        query.billDate.$lte = new Date(filter.endDate);
      }
    } else {
      // Apply default time filters
      const dateRanges = {
        'current_month': moment().startOf('month'),
        'previous_month': moment().subtract(1, 'month').startOf('month'),
        'last_3_months': moment().subtract(3, 'months'),
        'last_6_months': moment().subtract(6, 'months'),
        'current_year': moment().startOf('year')
      };

      if (dateRanges[filter.timeFilter]) {
        query.billDate = { $gte: dateRanges[filter.timeFilter].toDate() };
      }
    }

    if (filter.metalType) {
      query['items.metalType'] = filter.metalType;
    }

    if (filter.paymentStatus) {
      query.paymentStatus = filter.paymentStatus;
    }

    return query;
  }

  prepareDataForAI(bills) {
    return bills.map(bill => ({
      billNumber: bill.billNumber,
      billDate: bill.billDate,
      totalAmount: bill.grandTotal,
      metalTypes: [...new Set(bill.items.map(item => item.metalType))],
      itemCount: bill.items.length,
      hasExchange: bill.exchangeDetails?.hasExchange || false,
      exchangeValue: bill.exchangeDetails?.oldItemsTotal || 0,
      paymentMode: bill.paymentMode,
      paymentStatus: bill.paymentStatus,
      // Remove all sensitive customer data
      customer: {
        // Only include non-sensitive aggregated data
        hasDOB: !!bill.customer.dob,
        hasPAN: !!bill.customer.pan,
        hasAadhaar: !!bill.customer.aadhaar
      }
    }));
  }

  async getAIAnalysis(data, filter) {
    try {
      const prompt = `
        Analyze this jewellery sales data:
        
        Period: ${filter.timeFilter || 'Custom period'}
        Total Bills: ${data.length}
        Total Revenue: ₹${data.reduce((sum, bill) => sum + bill.totalAmount, 0).toLocaleString()}
        
        Data Summary:
        ${JSON.stringify(this.summarizeData(data), null, 2)}
        
        Please provide detailed business analysis based on the structure defined.
      `;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: this.systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI API Error:', error);
      return 'AI analysis temporarily unavailable. Please try again later.';
    }
  }

  summarizeData(data) {
    const summary = {
      totalBills: data.length,
      totalRevenue: data.reduce((sum, bill) => sum + bill.totalAmount, 0),
      averageBillValue: data.length > 0 ? data.reduce((sum, bill) => sum + bill.totalAmount, 0) / data.length : 0,
      metalDistribution: {},
      exchangeBills: data.filter(bill => bill.hasExchange).length,
      paymentModeDistribution: {},
      dailyTrend: {}
    };

    // Calculate metal distribution
    data.forEach(bill => {
      bill.metalTypes.forEach(metal => {
        summary.metalDistribution[metal] = (summary.metalDistribution[metal] || 0) + 1;
      });
      
      // Payment mode distribution
      summary.paymentModeDistribution[bill.paymentMode] = 
        (summary.paymentModeDistribution[bill.paymentMode] || 0) + 1;
      
      // Daily trend
      const date = moment(bill.billDate).format('YYYY-MM-DD');
      summary.dailyTrend[date] = (summary.dailyTrend[date] || 0) + bill.totalAmount;
    });

    return summary;
  }

  calculateMetrics(bills) {
    const metrics = {
      totalSales: 0,
      totalItems: 0,
      goldSales: 0,
      silverSales: 0,
      diamondSales: 0,
      exchangeTransactions: 0,
      averageTransactionValue: 0,
      highestSale: 0,
      lowestSale: Infinity,
      paymentModeBreakdown: {}
    };

    bills.forEach(bill => {
      metrics.totalSales += bill.grandTotal;
      metrics.totalItems += bill.items.length;
      
      bill.items.forEach(item => {
        if (item.metalType === 'Gold') metrics.goldSales += item.amount;
        if (item.metalType === 'Silver') metrics.silverSales += item.amount;
        if (item.metalType === 'Diamond') metrics.diamondSales += item.amount;
      });

      if (bill.exchangeDetails?.hasExchange) {
        metrics.exchangeTransactions++;
      }

      metrics.highestSale = Math.max(metrics.highestSale, bill.grandTotal);
      metrics.lowestSale = Math.min(metrics.lowestSale, bill.grandTotal);

      metrics.paymentModeBreakdown[bill.paymentMode] = 
        (metrics.paymentModeBreakdown[bill.paymentMode] || 0) + bill.grandTotal;
    });

    metrics.averageTransactionValue = bills.length > 0 ? metrics.totalSales / bills.length : 0;
    if (metrics.lowestSale === Infinity) metrics.lowestSale = 0;

    return metrics;
  }
}

module.exports = AIAnalyzer;
