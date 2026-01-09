const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateInvoicePDF = async (bill, items, outputPath) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Header
      doc.fontSize(20).text('JEWELLERY SHOP', { align: 'center' });
      doc.fontSize(10).text('123 Shop Street, City, State - 123456', { align: 'center' });
      doc.fontSize(10).text('Phone: +91 9876543210 | GSTIN: 12ABCDE1234F1Z2', { align: 'center' });
      doc.moveDown();

      // Bill Info
      doc.fontSize(12);
      doc.text(`Bill Number: ${bill.billNumber}`);
      doc.text(`Date: ${new Date(bill.billDate).toLocaleDateString('en-IN')}`);
      if (bill.customerName) doc.text(`Customer: ${bill.customerName}`);
      if (bill.customerPhone) doc.text(`Phone: ${bill.customerPhone}`);
      doc.moveDown();

      // Items Table Header
      const tableTop = doc.y;
      doc.font('Helvetica-Bold');
      doc.text('Item', 50, tableTop);
      doc.text('Net Wt', 200, tableTop);
      doc.text('Rate', 250, tableTop);
      doc.text('Amount', 300, tableTop);
      
      doc.moveTo(50, tableTop + 15)
        .lineTo(550, tableTop + 15)
        .stroke();
      
      // Items
      doc.font('Helvetica');
      let y = tableTop + 25;
      
      items.forEach((item, index) => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        
        const itemValue = item.calculations.total;
        
        doc.text(item.productName.substring(0, 30), 50, y);
        doc.text(item.netWeight.toFixed(3), 200, y);
        doc.text(item.rate.toFixed(2), 250, y);
        doc.text(itemValue.toFixed(2), 300, y);
        
        y += 20;
        
        // Making charges details if any
        if (item.makingChargesValue > 0) {
          doc.fontSize(8).text(`Making (${item.makingChargeType}): ${item.makingChargesValue}`, 70, y);
          y += 15;
          doc.fontSize(10);
        }
      });

      // Totals
      y = Math.max(y, 500);
      doc.moveDown(2);
      
      doc.text(`Sub Total: ₹${bill.subTotal.toFixed(2)}`, 350, y);
      y += 20;
      
      if (bill.exchangeDeduction > 0) {
        doc.text(`Exchange Deduction (3%): -₹${bill.exchangeDeduction.toFixed(2)}`, 350, y);
        y += 20;
      }
      
      if (bill.gst.enabled && bill.gst.totalGST > 0) {
        if (bill.gst.type === 'CGST_SGST') {
          doc.text(`CGST: ₹${bill.gst.cgstAmount.toFixed(2)}`, 350, y);
          y += 20;
          doc.text(`SGST: ₹${bill.gst.sgstAmount.toFixed(2)}`, 350, y);
          y += 20;
        } else if (bill.gst.type === 'IGST') {
          doc.text(`IGST: ₹${bill.gst.igstAmount.toFixed(2)}`, 350, y);
          y += 20;
        }
      }
      
      doc.font('Helvetica-Bold');
      doc.text(`Grand Total: ₹${bill.grandTotal.toFixed(2)}`, 350, y);
      
      // Footer
      doc.font('Helvetica');
      doc.fontSize(10);
      doc.text('Terms & Conditions:', 50, 650);
      doc.fontSize(8);
      doc.text('1. Goods once sold will not be taken back or exchanged.', 50, 670);
      doc.text('2. All disputes subject to local jurisdiction.', 50, 685);
      
      // QR Code if exists
      if (bill.qrCodeUrl) {
        doc.image(bill.qrCodeUrl, 400, 600, { width: 100 });
        doc.fontSize(8).text('Scan for details', 400, 710, { width: 100, align: 'center' });
      }

      doc.end();
      
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = generateInvoicePDF;
