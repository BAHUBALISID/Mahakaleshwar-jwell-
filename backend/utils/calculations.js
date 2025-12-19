const numberToWords = (num) => {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  
  const b = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  const convertToCrores = (n) => {
    if (n < 10000000) return convertToLakhs(n);
    return (
      convertToCrores(Math.floor(n / 10000000)) +
      ' Crore ' +
      convertToLakhs(n % 10000000)
    );
  };

  const convertToLakhs = (n) => {
    if (n < 100000) return convertToThousands(n);
    return (
      convertToLakhs(Math.floor(n / 100000)) +
      ' Lakh ' +
      convertToThousands(n % 100000)
    );
  };

  const convertToThousands = (n) => {
    if (n < 1000) return convertToHundreds(n);
    return (
      convertToThousands(Math.floor(n / 1000)) +
      ' Thousand ' +
      convertToHundreds(n % 1000)
    );
  };

  const convertToHundreds = (n) => {
    if (n > 99) {
      return (
        a[Math.floor(n / 100)] +
        ' Hundred ' +
        convertToTens(n % 100)
      );
    }
    return convertToTens(n);
  };

  const convertToTens = (n) => {
    if (n < 20) return a[n];
    return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
  };

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  
  let words = convertToCrores(rupees) + ' Rupees';
  
  if (paise > 0) {
    words += ' and ' + convertToTens(paise) + ' Paise';
  }
  
  words += ' Only';
  
  return words.replace(/\s+/g, ' ').trim();
};

const calculateItemAmount = (item, ratePerGram) => {
  let metalAmount = 0;
  
  if (item.metalType === 'Diamond') {
    metalAmount = item.rate * item.weight;
  } else {
    metalAmount = ratePerGram * item.weight;
  }
  
  let makingCharges = 0;
  if (item.makingChargesType === 'percentage') {
    makingCharges = (metalAmount * item.makingCharges) / 100;
  } else {
    makingCharges = item.makingCharges;
  }
  
  return {
    metalAmount,
    makingCharges,
    total: metalAmount + makingCharges
  };
};

const calculateExchangeValue = (oldItem, currentRate) => {
  const weight = oldItem.weight;
  const rate = oldItem.rate || currentRate;
  
  let grossValue = weight * rate;
  
  // Apply wastage deduction if any
  if (oldItem.wastageDeduction && oldItem.wastageDeduction > 0) {
    grossValue = grossValue * ((100 - oldItem.wastageDeduction) / 100);
  }
  
  // Apply melting charges if any
  if (oldItem.meltingCharges && oldItem.meltingCharges > 0) {
    grossValue = grossValue - oldItem.meltingCharges;
  }
  
  return Math.max(0, grossValue);
};

const calculateGST = (amount, gstRate = 3) => {
  return (amount * gstRate) / 100;
};

module.exports = {
  numberToWords,
  calculateItemAmount,
  calculateExchangeValue,
  calculateGST
};
