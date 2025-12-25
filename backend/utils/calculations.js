// utils/calculations.js
const numberToWords = (num) => {
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  
  if (rupees === 0 && paise === 0) {
    return 'Zero Rupees Only';
  }
  
  let words = '';
  
  // Convert rupees
  if (rupees > 0) {
    // Convert crore part
    if (rupees >= 10000000) {
      const crore = Math.floor(rupees / 10000000);
      words += convertNumberToWords(crore) + ' Crore ';
      rupees %= 10000000;
    }
    
    // Convert lakh part
    if (rupees >= 100000) {
      const lakh = Math.floor(rupees / 100000);
      words += convertNumberToWords(lakh) + ' Lakh ';
      rupees %= 100000;
    }
    
    // Convert thousand part
    if (rupees >= 1000) {
      const thousand = Math.floor(rupees / 1000);
      words += convertNumberToWords(thousand) + ' Thousand ';
      rupees %= 1000;
    }
    
    // Convert hundred part
    if (rupees >= 100) {
      const hundred = Math.floor(rupees / 100);
      words += convertNumberToWords(hundred) + ' Hundred ';
      rupees %= 100;
    }
    
    // Convert tens and units
    if (rupees > 0) {
      if (words !== '') words += 'and ';
      words += convertNumberToWords(rupees) + ' ';
    }
    
    words += 'Rupees';
  }
  
  // Convert paise
  if (paise > 0) {
    if (words !== '') words += ' and ';
    words += convertNumberToWords(paise) + ' Paise';
  }
  
  return words + ' Only';
};

const convertNumberToWords = (num) => {
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if (num < 10) return units[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) {
    const ten = Math.floor(num / 10);
    const unit = num % 10;
    return tens[ten] + (unit > 0 ? ' ' + units[unit] : '');
  }
  return '';
};

const calculateNetWeight = (grWt, less) => {
  return Math.max(0, (grWt || 0) - (less || 0));
};

const calculateMetalValue = (netWeight, rate, quantity = 1) => {
  return (netWeight || 0) * (rate || 0) * (quantity || 1);
};

const calculateMakingCharges = (mkType, mkCrg, metalValue, netWeight, quantity = 1, disMk = 0) => {
  let makingCharges = 0;
  
  switch (mkType) {
    case 'FIX':
      makingCharges = (mkCrg || 0) * (quantity || 1);
      break;
    case '%':
      makingCharges = (metalValue * (mkCrg || 0)) / 100;
      break;
    case 'GRM':
      makingCharges = (netWeight || 0) * (mkCrg || 0) * (quantity || 1);
      break;
    default:
      makingCharges = mkCrg || 0;
  }
  
  // Apply discount on making charges
  if (disMk > 0) {
    makingCharges = makingCharges - (makingCharges * disMk / 100);
  }
  
  return Math.max(0, makingCharges);
};

const calculateExchangeValue = (item, marketRate) => {
  const netWeight = calculateNetWeight(item.grWt || 0, item.less || 0);
  const exchangeRate = (marketRate || 0) * 0.97; // 3% deduction
  const wastageDeduction = (item.wastage || 0) / 100 * netWeight;
  const effectiveWeight = netWeight - wastageDeduction;
  const exchangeValue = effectiveWeight * exchangeRate * (item.qty || 1);
  return Math.max(0, exchangeValue - (item.meltingCharges || 0));
};

const calculateGST = (metalValue, makingCharges, gstOnMetal = 3, gstOnMaking = 5, isIntraState = true) => {
  const gstOnMetalAmount = (metalValue * gstOnMetal) / 100;
  const gstOnMakingAmount = (makingCharges * gstOnMaking) / 100;
  
  if (isIntraState) {
    return {
      totalGST: gstOnMetalAmount + gstOnMakingAmount,
      gstOnMetalCGST: gstOnMetalAmount / 2,
      gstOnMetalSGST: gstOnMetalAmount / 2,
      gstOnMakingCGST: gstOnMakingAmount / 2,
      gstOnMakingSGST: gstOnMakingAmount / 2,
      gstOnMetalIGST: 0,
      gstOnMakingIGST: 0
    };
  } else {
    return {
      totalGST: gstOnMetalAmount + gstOnMakingAmount,
      gstOnMetalCGST: 0,
      gstOnMetalSGST: 0,
      gstOnMakingCGST: 0,
      gstOnMakingSGST: 0,
      gstOnMetalIGST: gstOnMetalAmount,
      gstOnMakingIGST: gstOnMakingAmount
    };
  }
};

module.exports = {
  numberToWords,
  calculateNetWeight,
  calculateMetalValue,
  calculateMakingCharges,
  calculateExchangeValue,
  calculateGST,
  convertNumberToWords
};
