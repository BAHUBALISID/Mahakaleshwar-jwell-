// backend/utils/calculations.js
/**
 * Jewellery Calculation Utilities
 * Strictly follows business rules
 */

const Rate = require('../models/Rate');

// Validation function to check if all required rates exist
async function validateRates(items) {
  const missingRates = [];
  
  for (const item of items) {
    // Skip exchange items for rate validation (they use exchange rate logic)
    if (item.isExchange) continue;
    
    const rate = await Rate.findOne({
      metalType: item.metalType,
      purity: item.purity
    }).sort({ effectiveDate: -1 });
    
    if (!rate) {
      missingRates.push(`${item.metalType} - ${item.purity}`);
    }
  }
  
  return missingRates;
}

// Calculate new item value (for purchase items)
function calculateNewItem(itemData) {
  const {
    qty,
    ntWt, // Net weight (Gr.Wt - Less)
    rate,
    mk,
    mkCrg,
    disMk, // Discount on making %
    huCrg
  } = itemData;
  
  // Metal value = Net weight × Rate × Quantity
  let metalValue = ntWt * rate * qty;
  
  // Making charge calculation
  let makingValue = 0;
  if (mk === 'FIX') {
    // Fixed making charge
    makingValue = mkCrg * qty;
  } else if (mk === '%') {
    // Percentage making charge on metal value
    makingValue = metalValue * (mkCrg / 100);
  } else if (mk === 'GRM') {
    // Making charge per gram
    makingValue = ntWt * mkCrg * qty;
  }
  
  // Apply discount on making
  if (disMk > 0) {
    makingValue = makingValue - (makingValue * disMk / 100);
  }
  
  // Add HUID charge
  const huidCharge = huCrg * qty;
  
  // Total item value
  const totalValue = metalValue + makingValue + huidCharge;
  
  return {
    metalValue: parseFloat(metalValue.toFixed(2)),
    makingValue: parseFloat(makingValue.toFixed(2)),
    huidCharge: parseFloat(huidCharge.toFixed(2)),
    totalValue: parseFloat(totalValue.toFixed(2))
  };
}

// Calculate exchange item value (BUSINESS RULE: Market Rate - 3%)
function calculateExchangeItem(itemData, currentRate) {
  const {
    qty,
    ntWt, // Net weight
    wastage, // Wastage percentage
    meltingCharges // Fixed melting charges
  } = itemData;
  
  // Exchange rate = Current rate - 3%
  const exchangeRate = currentRate * 0.97;
  
  // Apply wastage deduction (percentage)
  const wastageDeduction = (wastage / 100) * ntWt;
  const effectiveWeight = ntWt - wastageDeduction;
  
  // Calculate metal value after wastage
  let exchangeValue = effectiveWeight * exchangeRate * qty;
  
  // Deduct melting charges
  exchangeValue -= meltingCharges;
  
  // Ensure value doesn't go negative
  exchangeValue = Math.max(0, exchangeValue);
  
  return {
    metalValue: 0, // No metal value for exchange items in purchase
    makingValue: 0, // No making charges for exchange items
    exchangeValue: parseFloat(exchangeValue.toFixed(2)),
    totalValue: parseFloat(exchangeValue.toFixed(2)) // For exchange items, total = exchange value
  };
}

// Calculate GST (BUSINESS RULE: Only 3% on new items, NO GST on making)
function calculateGST(items) {
  let taxableValue = 0;
  
  // Only new items (not exchange) contribute to taxable value
  for (const item of items) {
    if (!item.isExchange) {
      // GST is ONLY on metal value (BUSINESS RULE)
      taxableValue += item.metalValue;
    }
  }
  
  // GST = 3% of taxable value
  const gstAmount = taxableValue * 0.03;
  const cgst = gstAmount / 2;
  const sgst = gstAmount / 2;
  
  return {
    taxableValue: parseFloat(taxableValue.toFixed(2)),
    gstAmount: parseFloat(gstAmount.toFixed(2)),
    cgst: parseFloat(cgst.toFixed(2)),
    sgst: parseFloat(sgst.toFixed(2))
  };
}

// Calculate bill summary
function calculateBillSummary(items) {
  let metalValue = 0;
  let makingValue = 0;
  let exchangeValue = 0;
  let subTotal = 0;
  
  for (const item of items) {
    if (item.isExchange) {
      exchangeValue += item.totalValue;
    } else {
      metalValue += item.metalValue;
      makingValue += item.makingValue;
      subTotal += item.totalValue;
    }
  }
  
  const gst = calculateGST(items);
  
  // Grand total = Subtotal + GST
  const grandTotal = subTotal + gst.gstAmount;
  
  // Balance calculation for exchange
  let balancePayable = 0;
  let balanceRefundable = 0;
  
  if (exchangeValue > 0) {
    if (grandTotal > exchangeValue) {
      balancePayable = grandTotal - exchangeValue;
    } else {
      balanceRefundable = exchangeValue - grandTotal;
    }
  } else {
    balancePayable = grandTotal;
  }
  
  return {
    metalValue: parseFloat(metalValue.toFixed(2)),
    makingValue: parseFloat(makingValue.toFixed(2)),
    exchangeValue: parseFloat(exchangeValue.toFixed(2)),
    subTotal: parseFloat(subTotal.toFixed(2)),
    gst: gst,
    grandTotal: parseFloat(grandTotal.toFixed(2)),
    balancePayable: parseFloat(balancePayable.toFixed(2)),
    balanceRefundable: parseFloat(balanceRefundable.toFixed(2))
  };
}

module.exports = {
  validateRates,
  calculateNewItem,
  calculateExchangeItem,
  calculateGST,
  calculateBillSummary
};
