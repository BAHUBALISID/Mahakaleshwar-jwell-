class BillingSystem {
  constructor() {
    this.currentItem = {};
    this.billItems = [];
    this.rates = {};
    this.token = localStorage.getItem('token');
    this.user = JSON.parse(localStorage.getItem('user') || '{}');
    
    this.init();
  }

  async init() {
    await this.loadRates();
    this.setupEventListeners();
    this.setupItemForm();
    this.updateBillSummary();
    
    // Set current date
    document.getElementById('billDate').value = new Date().toISOString().split('T')[0];
    
    // Generate bill number
    this.generateBillNumber();
  }

  async loadRates() {
    try {
      const response = await fetch('/api/rates/active', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      const data = await response.json();
      if (data.success) {
        this.rates = data.rates;
        this.populateMetalDropdowns();
      }
    } catch (error) {
      console.error('Error loading rates:', error);
      this.showAlert('Failed to load rates. Please refresh the page.', 'danger');
    }
  }

  populateMetalDropdowns() {
    const metalSelect = document.getElementById('metalType');
    metalSelect.innerHTML = '<option value="">Select Metal</option>';
    
    Object.keys(this.rates).forEach(metal => {
      const option = document.createElement('option');
      option.value = metal;
      option.textContent = metal;
      metalSelect.appendChild(option);
    });
    
    // Trigger change to populate purity dropdown
    metalSelect.addEventListener('change', (e) => this.populatePurityDropdown(e.target.value));
  }

  populatePurityDropdown(metalType) {
    const puritySelect = document.getElementById('purity');
    puritySelect.innerHTML = '<option value="">Select Purity</option>';
    
    if (metalType && this.rates[metalType]) {
      this.rates[metalType].forEach(purity => {
        const option = document.createElement('option');
        option.value = purity.purity;
        option.textContent = `${purity.purity} (₹${purity.rate}/g)`;
        option.dataset.rate = purity.rate;
        option.dataset.gstApplicable = purity.gstApplicable;
        puritySelect.appendChild(option);
      });
    }
    
    puritySelect.disabled = !metalType;
  }

  setupEventListeners() {
    // Metal type change
    document.getElementById('metalType').addEventListener('change', (e) => {
      this.populatePurityDropdown(e.target.value);
      this.checkGSTApplicability();
    });
    
    // Purity change
    document.getElementById('purity').addEventListener('change', (e) => {
      const selectedOption = e.target.options[e.target.selectedIndex];
      if (selectedOption.dataset.rate) {
        document.getElementById('rate').value = selectedOption.dataset.rate;
        this.calculateNetWeight();
        this.checkGSTApplicability();
      }
    });
    
    // Weight calculations
    document.getElementById('grossWeight').addEventListener('input', () => this.calculateNetWeight());
    document.getElementById('lessWeight').addEventListener('input', () => this.calculateNetWeight());
    
    // Making charge type change
    document.getElementById('makingChargeType').addEventListener('change', (e) => {
      const label = document.querySelector('label[for="makingChargeValue"]');
      const unit = e.target.value === '%' ? '(%)' : e.target.value === 'GRM' ? '(per gram)' : '(₹)';
      label.innerHTML = `Making Charge Value ${unit} <span class="required">*</span>`;
    });
    
    // Image upload
    document.getElementById('productImage').addEventListener('change', (e) => {
      this.handleImageUpload(e.target.files[0]);
    });
    
    // Add item button
    document.getElementById('addItemBtn').addEventListener('click', () => this.addItem());
    
    // Generate bill button
    document.getElementById('generateBillBtn').addEventListener('click', () => this.generateBill());
    
    // Clear form button
    document.getElementById('clearFormBtn').addEventListener('click', () => this.clearForm());
    
    // GST inputs
    ['cgst', 'sgst', 'igst'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.updateBillSummary());
    });
    
    // Exchange checkbox
    document.getElementById('isExchange').addEventListener('change', (e) => {
      this.toggleExchangeWarning(e.target.checked);
    });
  }

  setupItemForm() {
    // Initialize form validation
    const form = document.getElementById('itemForm');
    form.addEventListener('submit', (e) => e.preventDefault());
    
    // Set default making charge type
    document.getElementById('makingChargeType').value = '%';
  }

  calculateNetWeight() {
    const grossWeight = parseFloat(document.getElementById('grossWeight').value) || 0;
    const lessWeight = parseFloat(document.getElementById('lessWeight').value) || 0;
    const netWeight = grossWeight - lessWeight;
    
    if (netWeight < 0) {
      document.getElementById('netWeight').value = '';
      this.showAlert('Net weight cannot be negative', 'danger');
      return;
    }
    
    document.getElementById('netWeight').value = netWeight.toFixed(3);
    this.calculateItemTotal();
  }

  calculateItemTotal() {
    const netWeight = parseFloat(document.getElementById('netWeight').value) || 0;
    const rate = parseFloat(document.getElementById('rate').value) || 0;
    const makingChargeType = document.getElementById('makingChargeType').value;
    const makingChargeValue = parseFloat(document.getElementById('makingChargeValue').value) || 0;
    const discountOnMaking = parseFloat(document.getElementById('discountOnMaking').value) || 0;
    const otherCharges = parseFloat(document.getElementById('otherCharges').value) || 0;
    const isExchange = document.getElementById('isExchange').checked;
    
    let metalValue = netWeight * rate;
    let makingCharge = 0;
    
    // Calculate making charge based on type
    switch (makingChargeType) {
      case 'FIX':
        makingCharge = makingChargeValue;
        break;
      case '%':
        makingCharge = (metalValue * makingChargeValue) / 100;
        break;
      case 'GRM':
        makingCharge = netWeight * makingChargeValue;
        break;
    }
    
    // Apply discount
    makingCharge = Math.max(0, makingCharge - discountOnMaking);
    
    // Calculate exchange deduction if applicable
    let exchangeDeduction = 0;
    let itemTotal = metalValue + makingCharge + otherCharges;
    
    if (isExchange) {
      exchangeDeduction = itemTotal * 0.03; // Fixed 3% deduction
      itemTotal -= exchangeDeduction;
    }
    
    // Update display
    document.getElementById('metalValueDisplay').textContent = `₹${metalValue.toFixed(2)}`;
    document.getElementById('makingChargeDisplay').textContent = `₹${makingCharge.toFixed(2)}`;
    document.getElementById('exchangeDeductionDisplay').textContent = `₹${exchangeDeduction.toFixed(2)}`;
    document.getElementById('itemTotalDisplay').textContent = `₹${itemTotal.toFixed(2)}`;
    
    return {
      metalValue,
      makingCharge,
      exchangeDeduction,
      otherCharges,
      total: itemTotal
    };
  }

  checkGSTApplicability() {
    const metalType = document.getElementById('metalType').value;
    const purity = document.getElementById('purity').value;
    const puritySelect = document.getElementById('purity');
    const selectedOption = puritySelect.options[puritySelect.selectedIndex];
    
    let gstApplicable = true;
    if (selectedOption && selectedOption.dataset.gstApplicable) {
      gstApplicable = selectedOption.dataset.gstApplicable === 'true';
    }
    
    const gstInputs = ['cgst', 'sgst', 'igst'];
    gstInputs.forEach(id => {
      const input = document.getElementById(id);
      input.disabled = !gstApplicable;
      if (!gstApplicable) {
        input.value = 0;
      }
    });
    
    document.getElementById('gstWarning').style.display = gstApplicable ? 'none' : 'block';
  }

  toggleExchangeWarning(show) {
    const warning = document.getElementById('exchangeWarning');
    warning.style.display = show ? 'flex' : 'none';
    
    if (show) {
      this.showAlert('Exchange items have 3% automatic deduction applied.', 'warning');
    }
  }

  async handleImageUpload(file) {
    if (!file) return;
    
    if (!file.type.match('image.*')) {
      this.showAlert('Please select an image file', 'danger');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      this.showAlert('Image size should be less than 5MB', 'danger');
      return;
    }
    
    const formData = new FormData();
    formData.append('productImage', file);
    
    try {
      const response = await fetch('/api/bills/upload-image', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` },
        body: formData
      });
      
      const data = await response.json();
      if (data.success) {
        document.getElementById('imagePreview').src = data.imageUrl;
        document.getElementById('imagePreview').style.display = 'block';
        this.currentItem.productImage = data.imageUrl;
      }
    } catch (error) {
      console.error('Image upload error:', error);
      this.showAlert('Failed to upload image', 'danger');
    }
  }

  validateItem() {
    const requiredFields = [
      'productName', 'unit', 'quantity', 'grossWeight', 'lessWeight',
      'metalType', 'purity', 'rate', 'makingChargeType', 'makingChargeValue'
    ];
    
    for (const field of requiredFields) {
      const value = document.getElementById(field).value.trim();
      if (!value) {
        this.showAlert(`Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`, 'danger');
        document.getElementById(field).focus();
        return false;
      }
    }
    
    // Validate weights
    const grossWeight = parseFloat(document.getElementById('grossWeight').value);
    const lessWeight = parseFloat(document.getElementById('lessWeight').value);
    if (grossWeight <= 0) {
      this.showAlert('Gross weight must be greater than 0', 'danger');
      return false;
    }
    if (lessWeight < 0) {
      this.showAlert('Less weight cannot be negative', 'danger');
      return false;
    }
    if (grossWeight <= lessWeight) {
      this.showAlert('Gross weight must be greater than less weight', 'danger');
      return false;
    }
    
    // Validate rate
    const rate = parseFloat(document.getElementById('rate').value);
    if (rate <= 0) {
      this.showAlert('Rate must be greater than 0', 'danger');
      return false;
    }
    
    return true;
  }

  addItem() {
    if (!this.validateItem()) return;
    
    const item = {
      productName: document.getElementById('productName').value,
      productImage: this.currentItem.productImage || '/uploads/products/default.jpg',
      unit: document.getElementById('unit').value,
      quantity: parseInt(document.getElementById('quantity').value),
      grossWeight: parseFloat(document.getElementById('grossWeight').value),
      lessWeight: parseFloat(document.getElementById('lessWeight').value) || 0,
      netWeight: parseFloat(document.getElementById('netWeight').value),
      metalType: document.getElementById('metalType').value,
      purity: document.getElementById('purity').value,
      rate: parseFloat(document.getElementById('rate').value),
      makingChargeType: document.getElementById('makingChargeType').value,
      makingChargeValue: parseFloat(document.getElementById('makingChargeValue').value),
      discountOnMaking: parseFloat(document.getElementById('discountOnMaking').value) || 0,
      huid: document.getElementById('huid').value,
      tunch: document.getElementById('tunch').value,
      otherCharges: parseFloat(document.getElementById('otherCharges').value) || 0,
      notes: document.getElementById('notes').value,
      isExchange: document.getElementById('isExchange').checked
    };
    
    // Calculate item totals
    const totals = this.calculateItemTotal();
    item.metalValue = totals.metalValue;
    item.makingCharge = totals.makingCharge;
    item.exchangeDeduction = totals.exchangeDeduction;
    item.total = totals.total;
    
    this.billItems.push(item);
    this.updateItemsTable();
    this.updateBillSummary();
    this.clearItemForm();
    
    this.showAlert('Item added successfully', 'success');
  }

  updateItemsTable() {
    const tbody = document.getElementById('itemsTableBody');
    tbody.innerHTML = '';
    
    this.billItems.forEach((item, index) => {
      const row = tbody.insertRow();
      
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>
          <img src="${item.productImage}" alt="${item.productName}" style="width: 50px; height: 50px; object-fit: cover;">
          <div>${item.productName}</div>
        </td>
        <td>${item.metalType} ${item.purity}</td>
        <td>${item.netWeight.toFixed(3)}g</td>
        <td>₹${item.rate.toFixed(2)}</td>
        <td>₹${item.metalValue.toFixed(2)}</td>
        <td>
          <div>${item.makingChargeType}: ₹${item.makingChargeValue}</div>
          <small>Discount: ₹${item.discountOnMaking.toFixed(2)}</small>
        </td>
        <td>₹${item.otherCharges.toFixed(2)}</td>
        <td>${item.isExchange ? `<span class="badge badge-warning">Exchange (-3%)</span>` : ''}</td>
        <td>₹${item.total.toFixed(2)}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="billingSystem.removeItem(${index})">
            Remove
          </button>
        </td>
      `;
    });
    
    document.getElementById('itemsTable').style.display = this.billItems.length > 0 ? 'table' : 'none';
  }

  removeItem(index) {
    if (confirm('Are you sure you want to remove this item?')) {
      this.billItems.splice(index, 1);
      this.updateItemsTable();
      this.updateBillSummary();
      this.showAlert('Item removed', 'info');
    }
  }

  updateBillSummary() {
    if (this.billItems.length === 0) {
      document.getElementById('billSummary').style.display = 'none';
      return;
    }
    
    const subtotal = this.billItems.reduce((sum, item) => sum + item.total, 0);
    const cgst = parseFloat(document.getElementById('cgst').value) || 0;
    const sgst = parseFloat(document.getElementById('sgst').value) || 0;
    const igst = parseFloat(document.getElementById('igst').value) || 0;
    const totalGst = cgst + sgst + igst;
    const totalAmount = subtotal + totalGst;
    
    document.getElementById('subtotalDisplay').textContent = `₹${subtotal.toFixed(2)}`;
    document.getElementById('cgstDisplay').textContent = `₹${cgst.toFixed(2)}`;
    document.getElementById('sgstDisplay').textContent = `₹${sgst.toFixed(2)}`;
    document.getElementById('igstDisplay').textContent = `₹${igst.toFixed(2)}`;
    document.getElementById('totalGstDisplay').textContent = `₹${totalGst.toFixed(2)}`;
    document.getElementById('totalAmountDisplay').textContent = `₹${totalAmount.toFixed(2)}`;
    
    // Update exchange deduction display
    const exchangeItems = this.billItems.filter(item => item.isExchange);
    const totalExchangeDeduction = exchangeItems.reduce((sum, item) => sum + item.exchangeDeduction, 0);
    document.getElementById('totalExchangeDeduction').textContent = `₹${totalExchangeDeduction.toFixed(2)}`;
    document.getElementById('exchangeSummary').style.display = exchangeItems.length > 0 ? 'block' : 'none';
    
    document.getElementById('billSummary').style.display = 'block';
  }

  clearItemForm() {
    document.getElementById('itemForm').reset();
    document.getElementById('netWeight').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('metalValueDisplay').textContent = '₹0.00';
    document.getElementById('makingChargeDisplay').textContent = '₹0.00';
    document.getElementById('exchangeDeductionDisplay').textContent = '₹0.00';
    document.getElementById('itemTotalDisplay').textContent = '₹0.00';
    this.currentItem = {};
    this.populatePurityDropdown('');
    this.checkGSTApplicability();
    this.toggleExchangeWarning(false);
  }

  clearForm() {
    if (this.billItems.length > 0 && !confirm('Are you sure you want to clear the entire bill? All items will be lost.')) {
      return;
    }
    
    this.billItems = [];
    this.clearItemForm();
    document.getElementById('billForm').reset();
    document.getElementById('itemsTable').style.display = 'none';
    document.getElementById('billSummary').style.display = 'none';
    document.getElementById('billDate').value = new Date().toISOString().split('T')[0];
    this.generateBillNumber();
    this.showAlert('Form cleared', 'info');
  }

  generateBillNumber() {
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-IN').replace(/\//g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    document.getElementById('billNumber').value = `SMJ/${dateStr}/${random}`;
  }

  async generateBill() {
    // Validate bill
    if (this.billItems.length === 0) {
      this.showAlert('Please add at least one item to the bill', 'danger');
      return;
    }
    
    const customerName = document.getElementById('customerName').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    
    if (!customerName || !customerPhone) {
      this.showAlert('Please enter customer name and phone number', 'danger');
      return;
    }
    
    if (customerPhone.length !== 10) {
      this.showAlert('Please enter a valid 10-digit phone number', 'danger');
      return;
    }
    
    // Prepare bill data
    const billData = {
      customerName,
      customerPhone,
      customerAddress: document.getElementById('customerAddress').value.trim(),
      items: this.billItems.map(item => ({
        ...item,
        productImage: item.productImage // Ensure image URL is included
      })),
      cgst: parseFloat(document.getElementById('cgst').value) || 0,
      sgst: parseFloat(document.getElementById('sgst').value) || 0,
      igst: parseFloat(document.getElementById('igst').value) || 0,
      paymentMethod: document.getElementById('paymentMethod').value,
      paymentStatus: document.getElementById('paymentStatus').value,
      notes: document.getElementById('billNotes').value.trim(),
      billDate: document.getElementById('billDate').value
    };
    
    // Show loading
    const generateBtn = document.getElementById('generateBillBtn');
    const originalText = generateBtn.innerHTML;
    generateBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generating...';
    generateBtn.disabled = true;
    
    try {
      const response = await fetch('/api/bills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(billData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.showAlert('Bill generated successfully! PDF is being downloaded.', 'success');
        
        // Download PDF
        if (data.bill.pdfUrl) {
          window.open(data.bill.pdfUrl, '_blank');
        }
        
        // Clear form for next bill
        this.clearForm();
        
        // Show success modal with bill details
        this.showBillSuccessModal(data.bill);
      } else {
        this.showAlert(data.error || 'Failed to generate bill', 'danger');
      }
    } catch (error) {
      console.error('Generate bill error:', error);
      this.showAlert('Error generating bill. Please try again.', 'danger');
    } finally {
      generateBtn.innerHTML = originalText;
      generateBtn.disabled = false;
    }
  }

  showBillSuccessModal(bill) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Bill Generated Successfully</h5>
          <button type="button" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="alert alert-success">
            <strong>Bill Number:</strong> ${bill.billNumber}<br>
            <strong>Total Amount:</strong> ₹${bill.totalAmount.toFixed(2)}<br>
            <strong>PDF:</strong> <a href="${bill.pdfUrl}" target="_blank">Download Invoice</a>
          </div>
          
          <h6>Item QR Codes:</h6>
          <div class="row">
            ${bill.items.map(item => `
              <div class="col-md-4">
                <div class="qr-container">
                  <img src="${item.qrUrl}" alt="QR Code" class="qr-code">
                  <div class="qr-label">${item.productName}</div>
                </div>
              </div>
            `).join('')}
          </div>
          
          <div class="mt-3">
            <button class="btn btn-primary" onclick="window.print()">
              Print Bill
            </button>
            <button class="btn btn-secondary" onclick="billingSystem.clearForm()">
              New Bill
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal on click
    modal.querySelector('.modal-close').addEventListener('click', () => {
      modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="close" data-dismiss="alert">&times;</button>
    `;
    
    const container = document.querySelector('.main-content') || document.body;
    container.insertBefore(alertDiv, container.firstChild);
    
    setTimeout(() => {
      alertDiv.remove();
    }, 5000);
  }
}

// Initialize billing system when page loads
let billingSystem;
document.addEventListener('DOMContentLoaded', () => {
  billingSystem = new BillingSystem();
});
