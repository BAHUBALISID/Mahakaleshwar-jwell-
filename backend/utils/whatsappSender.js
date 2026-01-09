const axios = require('axios');

class WhatsAppSender {
  constructor() {
    this.apiKey = process.env.WHATSAPP_API_KEY;
    this.apiUrl = process.env.WHATSAPP_API_URL;
  }

  async sendBill(billData, customerPhone, pdfPath) {
    try {
      // Format phone number (remove +91 if present, add country code)
      let phone = customerPhone.replace(/\D/g, '');
      if (phone.startsWith('91') && phone.length === 12) {
        phone = phone.substring(2);
      }
      if (phone.length === 10) {
        phone = `91${phone}`;
      }

      const message = `Dear ${billData.customerName},\n\n` +
        `Thank you for shopping at ${process.env.APP_NAME}!\n` +
        `Your bill ${billData.billNumber} for ₹${billData.totalAmount.toFixed(2)} has been generated.\n` +
        `Date: ${new Date(billData.billDate).toLocaleDateString('en-IN')}\n\n` +
        `Payment Status: ${billData.paymentStatus.toUpperCase()}\n` +
        `Payment Method: ${billData.paymentMethod.toUpperCase()}\n\n` +
        `View your bill: ${process.env.QR_BASE_URL}/b/${billData._id}\n\n` +
        `For any queries, contact us.\n\n` +
        `Thank you!\n` +
        `${process.env.APP_NAME}\n` +
        `${process.env.APP_LOCATION}`;

      // If using WhatsApp Business API
      if (this.apiKey && this.apiUrl.includes('api.whatsapp.com')) {
        const response = await axios.post(this.apiUrl, {
          apiKey: this.apiKey,
          phone: phone,
          message: message,
          filename: `SMJ_Bill_${billData.billNumber}.pdf`,
          document: pdfPath // Base64 encoded PDF
        });

        return {
          success: true,
          messageId: response.data.messageId,
          timestamp: new Date()
        };
      } else {
        // Fallback to WhatsApp Web link
        const encodedMessage = encodeURIComponent(message);
        const whatsappLink = `https://wa.me/${phone}?text=${encodedMessage}`;
        
        return {
          success: true,
          link: whatsappLink,
          message: 'WhatsApp message prepared. Open link to send.',
          timestamp: new Date()
        };
      }
    } catch (error) {
      console.error('WhatsApp sending error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendLowStockAlert(stockItem, adminPhone) {
    const message = `🚨 LOW STOCK ALERT 🚨\n\n` +
      `Product: ${stockItem.productName}\n` +
      `Metal: ${stockItem.metalType} ${stockItem.purity}\n` +
      `Current Quantity: ${stockItem.quantity}\n` +
      `Current Weight: ${stockItem.weight.toFixed(3)}g\n` +
      `Threshold: ${stockItem.lowStockThreshold}\n\n` +
      `Please restock soon.\n` +
      `${process.env.APP_NAME}`;

    return this.sendMessage(adminPhone, message);
  }

  async sendDailyReport(reportData, adminPhone) {
    const message = `DAILY SALES REPORT \n\n` +
      `Date: ${new Date().toLocaleDateString('en-IN')}\n` +
      `Total Bills: ${reportData.totalBills}\n` +
      `Total Sales: ₹${reportData.totalSales.toFixed(2)}\n` +
      `Total GST: ₹${reportData.totalGST.toFixed(2)}\n` +
      `Exchange Transactions: ${reportData.exchangeCount}\n` +
      `Top Metal: ${reportData.topMetal}\n\n` +
      `View detailed report: ${process.env.QR_BASE_URL}/reports/daily\n\n` +
      `${process.env.APP_NAME}`;

    return this.sendMessage(adminPhone, message);
  }

  async sendMessage(phone, message) {
    // Implementation for sending message
    // This would integrate with your WhatsApp provider
    return { success: true, message: 'Message sent' };
  }
}

module.exports = WhatsAppSender;
