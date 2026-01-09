const Bill = require('../models/Bill');

const generateBillNumber = async () => {
  const currentYear = new Date().getFullYear();
  const prefix = `JBL/${currentYear.toString().substr(-2)}/`;
  
  const lastBill = await Bill.findOne({ billNumber: new RegExp(`^${prefix}`) })
    .sort({ billNumber: -1 })
    .exec();
  
  let sequence = 1;
  if (lastBill && lastBill.billNumber) {
    const lastSequence = parseInt(lastBill.billNumber.split('/').pop());
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }
  
  return `${prefix}${sequence.toString().padStart(5, '0')}`;
};

module.exports = generateBillNumber;
