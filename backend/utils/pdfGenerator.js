const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

class PDFGenerator {
  constructor() {
    this.doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: 'Shree Mahakaleshwar Jewellers - Invoice',
        Author: process.env.APP_NAME,
        Subject: 'Jewellery Bill'
      }
    });
  }

  async generateInvoice(billData, outputPath) {
    return new Promise(async (resolve, reject) => {
      try {
        const writeStream = fs.createWriteStream(outputPath);
        this.doc.pipe(writeStream);

        // Header
        await this.addHeader(billData);
        
        // Customer Details
        this.addCustomerDetails(billData);
        
        // Bill Items Table
        this.addBillItems(billData);
        
        // Calculation Summary
        this.addCalculationSummary(billData);
        
        // Footer with QR Code
        await this.addFooter(billData);
        
        this.doc.end();
        
        writeStream.on('finish', () => resolve(outputPath));
        writeStream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  async addHeader(billData) {
    // Shop Name and Logo
    this.doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .fillColor('#D4AF37') // Gold color
      .text(process.env.APP_SHORT_NAME, 50, 50, { align: 'center' });
    
    this.doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#000000')
      .text(process.env.APP_NAME, { align: 'center' })
      .moveDown(0.5);
    
    this.doc
      .fontSize(10)
      .text(process.env.APP_TAGLINE, { align: 'center' })
      .moveDown(0.5);
    
    this.doc
      .fontSize(9)
      .text(`${process.env.APP_ESTABLISHED} | ${process.env.APP_LOCATION}`, { align: 'center' })
      .moveDown(1);
    
    // Bill Number and Date
    this.doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('TAX INVOICE', { align: 'center' })
      .moveDown(0.5);
    
    this.doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Bill No: ${billData.billNumber}`, 50, this.doc.y)
      .text(`Date: ${new Date(billData.billDate).toLocaleDateString('en-IN')}`, { align: 'right' })
      .moveDown(1);
    
    // Horizontal line
    this.doc
      .moveTo(50, this.doc.y)
      .lineTo(550, this.doc.y)
      .strokeColor('#D4AF37')
      .stroke()
      .moveDown(1);
  }

  addCustomerDetails(billData) {
    this.doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Customer Details:', 50, this.doc.y)
      .moveDown(0.5);
    
    this.doc
      .font('Helvetica')
      .text(`Name: ${billData.customerName}`)
      .text(`Phone: ${billData.customerPhone}`);
    
    if (billData.customerAddress) {
      this.doc.text(`Address: ${billData.customerAddress}`);
    }
    
    this.doc.moveDown(1);
  }

  addBillItems(billData) {
    const tableTop = this.doc.y;
    const itemWidth = 30;
    const descWidth = 120;
    const weightWidth = 40;
    const rateWidth = 40;
    const amountWidth = 60;
    
    // Table Header
    this.doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#FFFFFF')
      .rect(50, tableTop, 500, 20)
      .fill('#000000');
    
    this.doc
      .text('Sr.', 55, tableTop + 5)
      .text('Description', 55 + itemWidth, tableTop + 5, { width: descWidth })
      .text('Weight', 55 + itemWidth + descWidth, tableTop + 5, { width: weightWidth, align: 'right' })
      .text('Rate', 55 + itemWidth + descWidth + weightWidth, tableTop + 5, { width: rateWidth, align: 'right' })
      .text('Amount', 55 + itemWidth + descWidth + weightWidth + rateWidth, tableTop + 5, { width: amountWidth, align: 'right' });
    
    let yPos = tableTop + 25;
    
    // Table Rows
    billData.items.forEach((item, index) => {
      if (yPos > 700) {
        this.doc.addPage();
        yPos = 50;
      }
      
      const itemTotal = item.netWeight * item.rate;
      
      this.doc
        .font('Helvetica')
        .fillColor('#000000')
        .fontSize(8)
        .text(`${index + 1}.`, 55, yPos)
        .text(`${item.productName} (${item.metalType} ${item.purity})`, 55 + itemWidth, yPos, { width: descWidth })
        .text(`${item.netWeight.toFixed(3)}g`, 55 + itemWidth + descWidth, yPos, { width: weightWidth, align: 'right' })
        .text(`₹${item.rate.toFixed(2)}`, 55 + itemWidth + descWidth + weightWidth, yPos, { width: rateWidth, align: 'right' })
        .text(`₹${itemTotal.toFixed(2)}`, 55 + itemWidth + descWidth + weightWidth + rateWidth, yPos, { width: amountWidth, align: 'right' });
      
      yPos += 15;
      
      // Making charge details
      if (item.makingChargeValue > 0) {
        this.doc
          .fontSize(7)
          .text(`Making (${item.makingChargeType}): ₹${item.makingChargeValue}`, 55 + itemWidth, yPos, { width: descWidth })
          .text(`Discount: ₹${item.discountOnMaking || 0}`, 55 + itemWidth + descWidth, yPos, { width: weightWidth + rateWidth, align: 'right' });
        yPos += 10;
      }
      
      if (item.huid) {
        this.doc
          .fontSize(7)
          .text(`HUID: ${item.huid}`, 55 + itemWidth, yPos, { width: descWidth });
        yPos += 10;
      }
      
      yPos += 5;
    });
    
    this.doc.y = yPos;
  }

  addCalculationSummary(billData) {
    const summaryTop = this.doc.y + 10;
    
    this.doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Summary', 50, summaryTop);
    
    const items = [
      { label: 'Subtotal', value: billData.subtotal },
      { label: 'CGST', value: billData.cgst },
      { label: 'SGST', value: billData.sgst },
      { label: 'IGST', value: billData.igst },
      { label: 'Total GST', value: billData.totalGst }
    ];
    
    // Add exchange deduction if applicable
    const exchangeItems = billData.items.filter(item => item.isExchange);
    if (exchangeItems.length > 0) {
      const totalExchangeDeduction = exchangeItems.reduce((sum, item) => sum + (item.exchangeDeduction || 0), 0);
      items.push({ label: 'Exchange Deduction (-3%)', value: -totalExchangeDeduction });
    }
    
    items.push({ 
      label: 'Total Amount', 
      value: billData.totalAmount,
      isTotal: true 
    });
    
    let yPos = summaryTop + 20;
    
    items.forEach(item => {
      this.doc
        .fontSize(9)
        .font(item.isTotal ? 'Helvetica-Bold' : 'Helvetica')
        .text(item.label, 400, yPos)
        .text(`₹${item.value.toFixed(2)}`, 500, yPos, { align: 'right', width: 50 });
      yPos += 15;
    });
    
    this.doc.y = yPos + 10;
    
    // Payment details
    this.doc
      .fontSize(9)
      .font('Helvetica')
      .text(`Payment Method: ${billData.paymentMethod.toUpperCase()}`, 50, this.doc.y)
      .text(`Status: ${billData.paymentStatus.toUpperCase()}`, { align: 'right' })
      .moveDown(1);
  }

  async addFooter(billData) {
    // Terms and Conditions
    this.doc
      .fontSize(8)
      .font('Helvetica')
      .text('Terms & Conditions:', 50, this.doc.y, { underline: true })
      .moveDown(0.3)
      .text('1. Goods once sold will not be taken back or exchanged.')
      .text('2. Making charges are non-refundable.')
      .text('3. Hallmarking is as per Govt. guidelines.')
      .text('4. This is a computer generated invoice.')
      .moveDown(1);
    
    // QR Code for first item
    if (billData.items.length > 0 && billData.items[0].publicToken) {
      const qrUrl = `${process.env.QR_BASE_URL}/${billData.items[0].publicToken}`;
      const qrDataUrl = await QRCode.toDataURL(qrUrl);
      
      const qrSize = 80;
      const qrX = 500 - qrSize;
      const qrY = this.doc.page.height - 120;
      
      this.doc.image(qrDataUrl, qrX, qrY, { width: qrSize, height: qrSize });
      
      this.doc
        .fontSize(7)
        .text('Scan QR for', qrX, qrY + qrSize + 5, { width: qrSize, align: 'center' })
        .text('product details', qrX, this.doc.y, { width: qrSize, align: 'center' });
    }
    
    // Footer text
    this.doc
      .fontSize(8)
      .font('Helvetica-Oblique')
      .text('Thank you for your business!', { align: 'center' })
      .moveDown(0.5)
      .text(`${process.env.APP_NAME} | ${process.env.APP_LOCATION}`, { align: 'center' })
      .text(`Contact: [Your Phone Number] | GSTIN: [Your GST Number]`, { align: 'center' });
  }
}

module.exports = PDFGenerator;
