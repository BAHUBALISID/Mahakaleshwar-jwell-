/**
 * Convert per kg rate to per gram rate
 */
const perKgToPerGram = (ratePerKg) => {
  return ratePerKg / 1000;
};

/**
 * Calculate metal value
 */
const calculateMetalValue = (weight, ratePerGram) => {
  return weight * ratePerGram;
};

/**
 * Calculate making charge
 */
const calculateMakingCharge = (metalValue, chargeType, chargeValue) => {
  if (chargeType === 'percentage') {
    return (metalValue * chargeValue) / 100;
  } else {
    return chargeValue;
  }
};

/**
 * Calculate GST (CGST + SGST = 3% + 3% = 6% for jewellery)
 */
const calculateGST = (amount) => {
  const cgst = (amount * 3) / 100;
  const sgst = (amount * 3) / 100;
  return {
    cgst,
    sgst,
    total: cgst + sgst
  };
};

/**
 * Calculate exchange value with optional wastage deduction
 */
const calculateExchangeValue = (weight, ratePerGram, wastagePercent = 0) => {
  const metalValue = weight * ratePerGram;
  const wastageDeduction = (metalValue * wastagePercent) / 100;
  return metalValue - wastageDeduction;
};

/**
 * Calculate net payable amount
 */
const calculateNetPayable = (totalAmount, exchangeValue = 0) => {
  const net = totalAmount - exchangeValue;
  
  return {
    netPayable: Math.abs(net),
    balanceType: net >= 0 ? 'payable' : 'refundable'
  };
};

/**
 * Convert number to Indian Rupees words
 */
const numberToWords = (num) => {
  const { toWords } = require('number-to-words');
  const words = toWords(num);
  return words.charAt(0).toUpperCase() + words.slice(1) + ' Rupees Only';
};

/**
 * Calculate total bill from items
 */
const calculateBillTotals = (items) => {
  let totals = {
    totalMetalValue: 0,
    totalMakingCharge: 0,
    totalBeforeTax: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    totalTax: 0,
    totalAmount: 0
  };
  
  items.forEach(item => {
    totals.totalMetalValue += item.metalValue || 0;
    totals.totalMakingCharge += item.makingChargeAmount || 0;
    totals.totalBeforeTax += item.totalBeforeTax || 0;
    totals.cgstAmount += item.cgst || 0;
    totals.sgstAmount += item.sgst || 0;
    totals.totalTax += (item.cgst || 0) + (item.sgst || 0);
    totals.totalAmount += item.total || 0;
  });
  
  return totals;
};

module.exports = {
  perKgToPerGram,
  calculateMetalValue,
  calculateMakingCharge,
  calculateGST,
  calculateExchangeValue,
  calculateNetPayable,
  numberToWords,
  calculateBillTotals
};
