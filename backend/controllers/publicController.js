const Bill = require('../models/Bill');
const QRGenerator = require('../utils/qrGenerator');
const path = require('path');
const fs = require('fs').promises;

class PublicController {
  // Get product details by public token
  async getProductByToken(req, res) {
    try {
      const { token } = req.params;
      
      // Find bill item with matching public token
      const bill = await Bill.findOne({
        'items.publicToken': token
      });

      if (!bill) {
        return res.status(404).render('product-not-found', {
          title: 'Product Not Found',
          shopName: process.env.APP_NAME,
          tagline: process.env.APP_TAGLINE
        });
      }

      // Find the specific item
      const item = bill.items.find(item => item.publicToken === token);
      if (!item) {
        return res.status(404).render('product-not-found', {
          title: 'Product Not Found',
          shopName: process.env.APP_NAME,
          tagline: process.env.APP_TAGLINE
        });
      }

      // Calculate item details
      const itemDetails = this.calculateItemDetails(item);
      
      // Prepare response data
      const productData = {
        shopName: process.env.APP_NAME,
        shortName: process.env.APP_SHORT_NAME,
        tagline: process.env.APP_TAGLINE,
        established: process.env.APP_ESTABLISHED,
        location: process.env.APP_LOCATION,
        
        productName: item.productName,
        productImage: item.productImage,
        metalType: item.metalType,
        purity: item.purity,
        netWeight: item.netWeight,
        rate: item.rate,
        makingChargeType: item.makingChargeType,
        makingChargeValue: item.makingChargeValue,
        discountOnMaking: item.discountOnMaking,
        otherCharges: item.otherCharges,
        huid: item.huid,
        tunch: item.tunch,
        notes: item.notes,
        isExchange: item.isExchange,
        exchangeDeduction: item.exchangeDeduction,
        
        billNumber: bill.billNumber,
        billDate: bill.billDate,
        customerName: bill.customerName,
        
        calculations: itemDetails,
        token: item.publicToken,
        
        // URLs
        qrUrl: QRGenerator.getProductQRUrl(item.publicToken),
        whatsappUrl: this.getWhatsAppShareUrl(bill, item)
      };

      // Render product page
      res.render('product-view', productData);

    } catch (error) {
      console.error('Get product by token error:', error);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load product details',
        shopName: process.env.APP_NAME,
        tagline: process.env.APP_TAGLINE
      });
    }
  }

  // Calculate item details for display
  calculateItemDetails(item) {
    const metalValue = item.netWeight * item.rate;
    let makingCharge = 0;
    
    switch (item.makingChargeType) {
      case 'FIX':
        makingCharge = item.makingChargeValue;
        break;
      case '%':
        makingCharge = (metalValue * item.makingChargeValue) / 100;
        break;
      case 'GRM':
        makingCharge = item.netWeight * item.makingChargeValue;
        break;
    }
    
    // Apply discount
    makingCharge = Math.max(0, makingCharge - item.discountOnMaking);
    
    // Calculate subtotal
    let subtotal = metalValue + makingCharge + item.otherCharges;
    
    // Apply exchange deduction if applicable
    let exchangeDeduction = 0;
    if (item.isExchange) {
      exchangeDeduction = subtotal * 0.03; // Fixed 3% deduction
      subtotal -= exchangeDeduction;
    }
    
    return {
      metalValue,
      makingCharge,
      otherCharges: item.otherCharges,
      exchangeDeduction,
      subtotal
    };
  }

  // Generate WhatsApp share URL
  getWhatsAppShareUrl(bill, item) {
    const message = `Check out my jewellery from ${process.env.APP_NAME}!\n\n` +
      `Product: ${item.productName}\n` +
      `Metal: ${item.metalType} ${item.purity}\n` +
      `Weight: ${item.netWeight}g\n` +
      `Bill No: ${bill.billNumber}\n\n` +
      `View product: ${process.env.QR_BASE_URL}/p/${item.publicToken}`;
    
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/?text=${encodedMessage}`;
  }

  // Get bill by ID (public view)
  async getBillById(req, res) {
    try {
      const { id } = req.params;
      
      const bill = await Bill.findById(id)
        .populate('createdBy', 'name')
        .lean();

      if (!bill) {
        return res.status(404).render('error', {
          title: 'Bill Not Found',
          message: 'The requested bill could not be found',
          shopName: process.env.APP_NAME,
          tagline: process.env.APP_TAGLINE
        });
      }

      // Calculate totals for display
      const billData = {
        shopName: process.env.APP_NAME,
        shortName: process.env.APP_SHORT_NAME,
        tagline: process.env.APP_TAGLINE,
        established: process.env.APP_ESTABLISHED,
        location: process.env.APP_LOCATION,
        
        billNumber: bill.billNumber,
        billDate: bill.billDate,
        customerName: bill.customerName,
        customerPhone: bill.customerPhone,
        customerAddress: bill.customerAddress,
        
        items: bill.items.map(item => ({
          ...item,
          itemTotal: item.netWeight * item.rate,
          makingCharge: this.calculateMakingCharge(item)
        })),
        
        subtotal: bill.subtotal,
        cgst: bill.cgst,
        sgst: bill.sgst,
        igst: bill.igst,
        totalGst: bill.totalGst,
        totalAmount: bill.totalAmount,
        
        paymentMethod: bill.paymentMethod,
        paymentStatus: bill.paymentStatus,
        notes: bill.notes,
        
        createdBy: bill.createdBy?.name || 'System',
        
        // Check if any items are exchange
        hasExchange: bill.items.some(item => item.isExchange),
        totalExchangeDeduction: bill.items.reduce((sum, item) => 
          sum + (item.exchangeDeduction || 0), 0
        )
      };

      // Render bill view
      res.render('bill-view', billData);

    } catch (error) {
      console.error('Get bill by ID error:', error);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to load bill details',
        shopName: process.env.APP_NAME,
        tagline: process.env.APP_TAGLINE
      });
    }
  }

  calculateMakingCharge(item) {
    const metalValue = item.netWeight * item.rate;
    let makingCharge = 0;
    
    switch (item.makingChargeType) {
      case 'FIX':
        makingCharge = item.makingChargeValue;
        break;
      case '%':
        makingCharge = (metalValue * item.makingChargeValue) / 100;
        break;
      case 'GRM':
        makingCharge = item.netWeight * item.makingChargeValue;
        break;
    }
    
    return Math.max(0, makingCharge - item.discountOnMaking);
  }

  // Download PDF invoice
  async downloadInvoice(req, res) {
    try {
      const { id } = req.params;
      
      const bill = await Bill.findById(id).lean();
      if (!bill) {
        return res.status(404).json({ error: 'Bill not found' });
      }

      if (!bill.pdfPath) {
        return res.status(404).json({ error: 'PDF not generated for this bill' });
      }

      const pdfPath = path.join(__dirname, '..', bill.pdfPath);
      
      // Check if file exists
      try {
        await fs.access(pdfPath);
      } catch {
        return res.status(404).json({ error: 'PDF file not found' });
      }

      // Set headers for download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 
        `attachment; filename="SMJ_Bill_${bill.billNumber}.pdf"`);
      
      // Stream the file
      const fileStream = fs.createReadStream(pdfPath);
      fileStream.pipe(res);

    } catch (error) {
      console.error('Download invoice error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // View QR code
  async viewQRCode(req, res) {
    try {
      const { token } = req.params;
      
      // Find item with this token
      const bill = await Bill.findOne({
        'items.publicToken': token
      });

      if (!bill) {
        return res.status(404).send('QR code not found');
      }

      const item = bill.items.find(item => item.publicToken === token);
      if (!item) {
        return res.status(404).send('QR code not found');
      }

      // Generate QR code data URL
      const qrData = QRGenerator.getProductQRUrl(token);
      const qrDataUrl = await QRGenerator.generateQRDataURL(qrData);
      
      // Render QR view
      res.render('qr-view', {
        title: 'SMJ Product QR Code',
        shopName: process.env.APP_NAME,
        productName: item.productName,
        qrDataUrl,
        productUrl: qrData
      });

    } catch (error) {
      console.error('View QR code error:', error);
      res.status(500).send('Error generating QR code');
    }
  }

  // Verify product authenticity
  async verifyProduct(req, res) {
    try {
      const { token, huid } = req.query;
      
      if (!token && !huid) {
        return res.status(400).json({
          success: false,
          error: 'Token or HUID required'
        });
      }

      let query = {};
      if (token) {
        query['items.publicToken'] = token;
      }
      if (huid) {
        query['items.huid'] = huid;
      }

      const bill = await Bill.findOne(query);
      if (!bill) {
        return res.json({
          success: false,
          verified: false,
          message: 'Product not found in records'
        });
      }

      const item = bill.items.find(item => 
        (token && item.publicToken === token) || 
        (huid && item.huid === huid)
      );

      if (!item) {
        return res.json({
          success: false,
          verified: false,
          message: 'Product not found'
        });
      }

      // Product found - verify details
      res.json({
        success: true,
        verified: true,
        message: 'Product verified successfully',
        product: {
          name: item.productName,
          metal: `${item.metalType} ${item.purity}`,
          weight: `${item.netWeight}g`,
          billNumber: bill.billNumber,
          billDate: bill.billDate,
          customerName: bill.customerName
        },
        authenticity: {
          hasHUID: !!item.huid,
          hasToken: !!item.publicToken,
          isExchange: item.isExchange
        }
      });

    } catch (error) {
      console.error('Verify product error:', error);
      res.status(500).json({
        success: false,
        error: 'Verification failed'
      });
    }
  }

  // Get shop information
  async getShopInfo(req, res) {
    try {
      res.json({
        success: true,
        shop: {
          name: process.env.APP_NAME,
          shortName: process.env.APP_SHORT_NAME,
          tagline: process.env.APP_TAGLINE,
          established: process.env.APP_ESTABLISHED,
          location: process.env.APP_LOCATION,
          businessType: 'Retail Jewellery Shop',
          deployment: 'Private VPS'
        },
        contact: {
          // These would come from database in production
          phone: '[Your Phone Number]',
          email: '[Your Email]',
          address: process.env.APP_LOCATION,
          gstin: '[Your GST Number]'
        },
        policies: {
          exchangeDeduction: '3% fixed deduction on all exchange items',
          gst: 'GST is manually entered and never auto-calculated',
          warranty: 'As per standard jewellery industry practices'
        }
      });
    } catch (error) {
      console.error('Get shop info error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new PublicController();
