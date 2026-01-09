const QRCode = require('qrcode');

/**
 * Generate QR code as Base64 PNG
 * @param {Object} data - Data to encode in QR
 * @returns {Promise<string>} Base64 PNG string
 */
const generateQRCode = async (data) => {
  try {
    const qrString = typeof data === 'string' ? data : JSON.stringify(data);
    
    const qrCode = await QRCode.toDataURL(qrString, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      width: 300,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    return qrCode;
  } catch (error) {
    console.error('Generate QR code error:', error);
    throw new Error('Failed to generate QR code');
  }
};

/**
 * Generate QR code for bill
 */
const generateBillQRCode = async (bill) => {
  const qrData = {
    shop: 'Shri Mahakaleshwar Jewellers',
    billNumber: bill.billNumber,
    date: bill.billDate.toISOString().split('T')[0],
    total: bill.summary.grandTotal,
    customer: bill.customer.name,
    mobile: bill.customer.mobile,
    items: bill.items.length,
    payment: bill.paymentMode
  };
  
  return await generateQRCode(qrData);
};

module.exports = {
  generateQRCode,
  generateBillQRCode
};
