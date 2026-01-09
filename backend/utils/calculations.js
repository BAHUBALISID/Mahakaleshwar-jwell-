const calculateNetWeight = (grossWeight, lessWeight) => {
  return grossWeight - lessWeight;
};

const calculateItemValue = (item) => {
  let itemValue = 0;
  
  // Calculate metal value
  const metalValue = item.netWeight * item.rate;
  
  // Calculate making charges
  let makingCharges = 0;
  switch (item.makingChargeType) {
    case 'FIX':
      makingCharges = item.makingChargesValue;
      break;
    case '%':
      makingCharges = (metalValue * item.makingChargesValue) / 100;
      break;
    case 'GRM':
      makingCharges = item.netWeight * item.makingChargesValue;
      break;
  }
  
  // Apply discount on making
  makingCharges -= item.discountOnMaking;
  if (makingCharges < 0) makingCharges = 0;
  
  // Calculate total item value
  itemValue = metalValue + makingCharges + item.otherCharges;
  
  return {
    metalValue,
    makingCharges,
    otherCharges: item.otherCharges,
    total: itemValue
  };
};

const calculateExchangeValue = (marketValue) => {
  const deductionPercent = 3;
  const deductionAmount = (marketValue * deductionPercent) / 100;
  const finalValue = marketValue - deductionAmount;
  
  return {
    marketValue,
    deductionPercent,
    deductionAmount,
    finalValue
  };
};

module.exports = {
  calculateNetWeight,
  calculateItemValue,
  calculateExchangeValue
};
