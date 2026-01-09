const QRCode = require('qrcode');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

class QRGenerator {
  static generatePublicToken() {
    return crypto.randomBytes(16).toString('hex');
  }

  static async generateQRCode(data, outputPath) {
    try {
      await QRCode.toFile(outputPath, data, {
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 300,
        margin: 1,
        errorCorrectionLevel: 'H'
      });
      return outputPath;
    } catch (error) {
      throw new Error(`QR generation failed: ${error.message}`);
    }
  }

  static async generateQRDataURL(data) {
    try {
      return await QRCode.toDataURL(data, {
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 200,
        margin: 1
      });
    } catch (error) {
      throw new Error(`QR data URL generation failed: ${error.message}`);
    }
  }

  static getProductQRUrl(publicToken) {
    return `${process.env.QR_BASE_URL}/${publicToken}`;
  }

  static async saveQRCodeForProduct(publicToken, productName) {
    const qrData = this.getProductQRUrl(publicToken);
    const fileName = `qr_${publicToken}.png`;
    const outputPath = path.join(process.env.UPLOAD_PATH, 'qrcodes', fileName);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    await this.generateQRCode(qrData, outputPath);
    return `/uploads/qrcodes/${fileName}`;
  }
}

module.exports = QRGenerator;
