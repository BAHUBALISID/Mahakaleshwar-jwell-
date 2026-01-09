const Bill = require('../models/Bill');
const moment = require('moment');

const generateBillNumber = async () => {
  try {
    const today = moment().format('DDMMYY');
    const lastBill = await Bill.findOne({
      billNumber: new RegExp(`^SMJ/${today}/`)
    }).sort({ billNumber: -1 });
    
    let sequence = '001';
    if (lastBill) {
      const lastSequence = parseInt(lastBill.billNumber.split('/')[2]);
      sequence = String(lastSequence + 1).padStart(3, '0');
    }
    
    return `SMJ/${today}/${sequence}`;
  } catch (error) {
    console.error('Error generating bill number:', error);
    // Fallback to timestamp based number
    return `SMJ/${moment().format('DDMMYY')}/${Date.now().toString().slice(-3)}`;
  }
};

module.exports = { generateBillNumber };
