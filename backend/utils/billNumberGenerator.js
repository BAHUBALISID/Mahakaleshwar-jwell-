const Bill = require('../models/Bill');

/**
 * Generate unique bill number for the day
 * Format: YYYYMMDD-001, YYYYMMDD-002, etc.
 */
const generateBillNumber = async () => {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  
  try {
    // Find today's last bill
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    const lastBill = await Bill.findOne({
      billDate: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    }).sort({ billNumber: -1 });
    
    let sequence = 1;
    if (lastBill && lastBill.billNumber) {
      // Extract sequence from bill number
      const lastNumber = parseInt(lastBill.billNumber.split('-')[1]) || 0;
      sequence = lastNumber + 1;
    }
    
    const billNumber = `${dateStr}-${sequence.toString().padStart(3, '0')}`;
    
    return {
      success: true,
      billNumber,
      sequence
    };
  } catch (error) {
    console.error('Generate bill number error:', error);
    return {
      success: false,
      error: 'Failed to generate bill number'
    };
  }
};

/**
 * Generate QR code data for bill
 */
const generateQRData = (bill) => {
  const qrData = {
    shop: 'Shri Mahakaleshwar Jewellers',
    billNumber: bill.billNumber,
    date: bill.billDate.toISOString().split('T')[0],
    total: bill.summary.grandTotal,
    customer: bill.customer.name,
    mobile: bill.customer.mobile
  };
  
  return JSON.stringify(qrData);
};

module.exports = {
  generateBillNumber,
  generateQRData
};
