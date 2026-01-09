const QRCode = require('qrcode');
const crypto = require('crypto');

const generatePublicToken = () => {
  return crypto.randomBytes(16).toString('hex');
};

const generateQRCode = async (publicToken, billNumber) => {
  try {
    const publicUrl = `${process.env.PUBLIC_URL}/p/${publicToken}`;
    const qrCodeDataURL = await QRCode.toDataURL(publicUrl);
    return qrCodeDataURL;
  } catch (error) {
    throw new Error('QR code generation failed');
  }
};

module.exports = {
  generatePublicToken,
  generateQRCode
};
