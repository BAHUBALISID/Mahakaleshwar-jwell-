const calculateItemTotal = (item, isExchange = false) => {
  let total = 0;
  
  // Calculate metal value
  const metalValue = item.netWeight * item.rate;
  
  // Calculate making charge
  let makingCharge = 0;
  switch (item.makingChargeType) {
    case 'FIX':
      makingCharge = item.makingChargeValue;
      break;
    case '%':
      makingCharge = (metalValue * item.makingChargeValue) / 100;
      break;
    case 'GRM':
      makingCharge = item.netWeight * item.makingChargeValue;
      break;
  }
  
  // Apply discount on making
  makingCharge = Math.max(0, makingCharge - item.discountOnMaking);
  
  // Add other charges
  total = metalValue + makingCharge + (item.otherCharges || 0);
  
  // Apply exchange deduction if applicable
  if (isExchange) {
    const exchangeDeduction = total * 0.03; // Fixed 3% deduction
    item.exchangeDeduction = exchangeDeduction;
    total -= exchangeDeduction;
  }
  
  return {
    metalValue,
    makingCharge,
    exchangeDeduction: item.exchangeDeduction || 0,
    otherCharges: item.otherCharges || 0,
    total
  };
};

const calculateBillTotals = (items, gstAmounts = { cgst: 0, sgst: 0, igst: 0 }) => {
  const itemTotals = items.map(item => calculateItemTotal(item));
  
  const subtotal = itemTotals.reduce((sum, item) => sum + item.total, 0);
  const totalGst = (gstAmounts.cgst || 0) + (gstAmounts.sgst || 0) + (gstAmounts.igst || 0);
  const totalAmount = subtotal + totalGst;
  
  return {
    subtotal,
    cgst: gstAmounts.cgst || 0,
    sgst: gstAmounts.sgst || 0,
    igst: gstAmounts.igst || 0,
    totalGst,
    totalAmount,
    itemBreakdown: itemTotals
  };
};

const validateNetWeight = (grossWeight, lessWeight) => {
  const netWeight = grossWeight - lessWeight;
  if (netWeight < 0) {
    throw new Error('Net weight cannot be negative');
  }
  return netWeight;
};

module.exports = {
  calculateItemTotal,
  calculateBillTotals,
  validateNetWeight
};
