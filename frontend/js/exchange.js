class ExchangeSystem {
  constructor() {
    this.token = localStorage.getItem('token');
    this.user = JSON.parse(localStorage.getItem('user') || '{}');
    this.currentItem = {};
    this.exchangeItems = [];
    this.newItems = [];
    this.rates = {};
    
    this.init();
  }

  async init() {
    await this.loadRates();
    this.setupEventListeners();
    this.setupItemForm();
    this.updateExchangeSummary();
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
    // Populate for exchange items
    const exchangeMetalSelect = document.getElementById('exchangeMetalType');
    exchangeMetalSelect.innerHTML = '<option value="">Select Metal</option>';
    
    Object.keys(this.rates).forEach(metal => {
      const option = document.createElement('option');
      option.value = metal;
      option.textContent = metal;
      exchangeMetalSelect.appendChild(option);
    });
    
    // Populate for new items
    const newMetalSelect = document.getElementById('newMetalType');
    newMetalSelect.innerHTML = '<option value="">Select Metal</option>';
    
    Object.keys(this.rates).forEach(metal => {
      const option = document.createElement('option');
      option.value = metal;
      option.textContent = metal;
      newMetalSelect.appendChild(option);
    });
  }

  setupEventListeners() {
    // Exchange item form
    document.getElementById('exchangeMetalType').addEventListener('change', (e) => {
      this.populatePurityDropdown(e.target.value, 'exchange');
    });
    
    document.getElementById('exchangePurity').addEventListener('change', (e) => {
      const selectedOption = e.target.options[e.target.selectedIndex];
      if (selectedOption.dataset.rate) {
        document.getElementById('exchangeRate').value = selectedOption.dataset.rate;
        this.calculateExchangeNetWeight();
      }
    });
    
    document.getElementById('exchangeGrossWeight').addEventListener('input', () => this.calculateExchangeNetWeight());
    document.getElementById('exchangeLessWeight').addEventListener('input', () => this.calculateExchangeNetWeight());
    
    document.getElementById('addExchangeItemBtn').addEventListener('click', () => this.addExchangeItem());
    
    // New item form
    document.getElementById('newMetalType').addEventListener('change', (e) => {
      this.populatePurityDropdown(e.target.value, 'new');
    });
    
    document.getElementById('newPurity').addEventListener('change', (e) => {
      const selectedOption = e.target.options[e.target.selectedIndex];
      if (selectedOption.dataset.rate) {
        document.getElementById('newRate').value = selectedOption.dataset.rate;
        this.calculateNewNetWeight();
      }
    });
    
    document.getElementById('newGrossWeight').addEventListener('input', () => this.calculateNewNetWeight());
    document.getElementById('newLessWeight').addEventListener('input', () => this.calculateNewNetWeight());
    
    document.getElementById('addNewItemBtn').addEventListener('click', () => this.addNewItem());
    
    // Complete exchange button
    document.getElementById('completeExchangeBtn').addEventListener('click', () => this.completeExchange());
    
    // Clear all button
    document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAll());
    
    // GST inputs
    ['exchangeCgst', 'exchangeSgst', 'exchangeIgst'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.updateExchangeSummary());
    });
  }

  setupItemForm() {
    // Set default making charge type for new items
    document.getElementById('newMakingChargeType').value = '%';
  }

  populatePurityDropdown(metalType, type) {
    const selectId = type === 'exchange' ? 'exchangePurity' : 'newPurity';
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Select Purity</option>';
    
    if (metalType && this.rates[metalType]) {
      this.rates[metalType].forEach(purity => {
        const option = document.createElement('option');
        option.value = purity.purity;
        option.textContent = `${purity.purity} (₹${purity.rate}/g)`;
        option.dataset.rate = purity.rate;
        option.dataset.gstApplicable = purity.gstApplicable;
        select.appendChild(option);
      });
    }
    
    select.disabled = !metalType;
  }

  calculateExchangeNetWeight() {
    const grossWeight = parseFloat(document.getElementById('exchangeGrossWeight').value) || 0;
    const lessWeight = parseFloat(document.getElementById('exchangeLessWeight').value) || 0;
    const netWeight = grossWeight - lessWeight;
    
    if (netWeight < 0) {
      document.getElementById('exchangeNetWeight').value = '';
      this.showAlert('Net weight cannot be negative', 'danger');
      return;
    }
    
    document.getElementById('exchangeNetWeight').value = netWeight.toFixed(3);
    this.calculateExchangeItemValue();
  }

  calculateNewNetWeight() {
    const grossWeight = parseFloat(document.getElementById('newGrossWeight').value) || 0;
    const lessWeight = parseFloat(document.getElementById('newLessWeight').value) || 0;
    const netWeight = grossWeight - lessWeight;
    
    if (netWeight < 0) {
      document.getElementById('newNetWeight').value = '';
      this.showAlert('Net weight cannot be negative', 'danger');
      return;
    }
    
    document.getElementById('newNetWeight').value = netWeight.toFixed(3);
    this.calculateNewItemValue();
  }

  calculateExchangeItemValue() {
    const netWeight = parseFloat(document.getElementById('exchangeNetWeight').value) || 0;
    const rate = parseFloat(document.getElementById('exchangeRate').value) || 0;
    const otherCharges = parseFloat(document.getElementById('exchangeOtherCharges').value) || 0;
    
    const metalValue = netWeight * rate;
    const exchangeDeduction = metalValue * 0.03; // Fixed 3% deduction
    const totalValue = metalValue - exchangeDeduction + otherCharges;
    
    document.getElementById('exchangeMetalValue').textContent = `₹${metalValue.toFixed(2)}`;
    document.getElementById('exchangeDeduction').textContent = `₹${exchangeDeduction.toFixed(2)}`;
    document.getElementById('exchangeTotalValue').textContent = `₹${totalValue.toFixed(2)}`;
    
    return {
      metalValue,
      exchangeDeduction,
      otherCharges,
      total: totalValue
    };
  }

  calculateNewItemValue() {
    const netWeight = parseFloat(document.getElementById('newNetWeight').value) || 0;
    const rate = parseFloat(document.getElementById('newRate').value) || 0;
    const makingChargeType = document.getElementById('newMakingChargeType').value;
    const makingChargeValue = parseFloat(document.getElementById('newMakingChargeValue').value) || 0;
    const discountOnMaking = parseFloat(document.getElementById('newDiscountOnMaking').value) || 0;
    const otherCharges = parseFloat(document.getElementById('newOtherCharges').value) || 0;
    
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
    
    const totalValue = metalValue + makingCharge + otherCharges;
    
    document.getElementById('newMetalValue').textContent = `₹${metalValue.toFixed(2)}`;
    document.getElementById('newMakingCharge').textContent = `₹${makingCharge.toFixed(2)}`;
    document.getElementById('newTotalValue').textContent = `₹${totalValue.toFixed(2)}`;
    
    return {
      metalValue,
      makingCharge,
      otherCharges,
      total: totalValue
    };
  }

  validateExchangeItem() {
    const requiredFields = [
      'exchangeProductName', 'exchangeUnit', 'exchangeQuantity',
      'exchangeGrossWeight', 'exchangeLessWeight', 'exchangeMetalType',
      'exchangePurity', 'exchangeRate'
    ];
    
    for (const field of requiredFields) {
      const value = document.getElementById(field).value.trim();
      if (!value) {
        this.showAlert(`Please fill in ${field.replace('exchange', '').replace(/([A-Z])/g, ' $1').toLowerCase()}`, 'danger');
        document.getElementById(field).focus();
        return false;
      }
    }
    
    const grossWeight = parseFloat(document.getElementById('exchangeGrossWeight').value);
    const lessWeight = parseFloat(document.getElementById('exchangeLessWeight').value);
    
    if (grossWeight <= lessWeight) {
      this.showAlert('Gross weight must be greater than less weight', 'danger');
      return false;
    }
    
    return true;
  }

  validateNewItem() {
    const requiredFields = [
      'newProductName', 'newUnit', 'newQuantity',
      'newGrossWeight', 'newLessWeight', 'newMetalType',
      'newPurity', 'newRate', 'newMakingChargeType', 'newMakingChargeValue'
    ];
    
    for (const field of requiredFields) {
      const value = document.getElementById(field).value.trim();
      if (!value) {
        this.showAlert(`Please fill in ${field.replace('new', '').replace(/([A-Z])/g, ' $1').toLowerCase()}`, 'danger');
        document.getElementById(field).focus();
        return false;
      }
    }
    
    const grossWeight = parseFloat(document.getElementById('newGrossWeight').value);
    const lessWeight = parseFloat(document.getElementById('newLessWeight').value);
    
    if (grossWeight <= lessWeight) {
      this.showAlert('Gross weight must be greater than less weight', 'danger');
      return false;
    }
    
    return true;
  }

  addExchangeItem() {
    if (!this.validateExchangeItem()) return;
    
    const item = {
      productName: document.getElementById('exchangeProductName').value,
      productImage: '/uploads/products/exchange.jpg', // Default image for exchange items
      unit: document.getElementById('exchangeUnit').value,
      quantity: parseInt(document.getElementById('exchangeQuantity').value),
      grossWeight: parseFloat(document.getElementById('exchangeGrossWeight').value),
      lessWeight: parseFloat(document.getElementById('exchangeLessWeight').value) || 0,
      netWeight: parseFloat(document.getElementById('exchangeNetWeight').value),
      metalType: document.getElementById('exchangeMetalType').value,
      purity: document.getElementById('exchangePurity').value,
      rate: parseFloat(document.getElementById('exchangeRate').value),
      otherCharges: parseFloat(document.getElementById('exchangeOtherCharges').value) || 0,
      notes: document.getElementById('exchangeNotes').value,
      isExchange: true
    };
    
    const totals = this.calculateExchangeItemValue();
    item.metalValue = totals.metalValue;
    item.exchangeDeduction = totals.exchangeDeduction;
    item.total = totals.total;
    
    this.exchangeItems.push(item);
    this.updateExchangeItemsTable();
    this.updateExchangeSummary();
    this.clearExchangeForm();
    
    this.showAlert('Exchange item added', 'success');
  }

  addNewItem() {
    if (!this.validateNewItem()) return;
    
    const item = {
      productName: document.getElementById('newProductName').value,
      productImage: '/uploads/products/new.jpg', // Default image for new items
      unit: document.getElementById('newUnit').value,
      quantity: parseInt(document.getElementById('newQuantity').value),
      grossWeight: parseFloat(document.getElementById('newGrossWeight').value),
      lessWeight: parseFloat(document.getElementById('newLessWeight').value) || 0,
      netWeight: parseFloat(document.getElementById('newNetWeight').value),
      metalType: document.getElementById('newMetalType').value,
      purity: document.getElementById('newPurity').value,
      rate: parseFloat(document.getElementById('newRate').value),
      makingChargeType: document.getElementById('newMakingChargeType').value,
      makingChargeValue: parseFloat(document.getElementById('newMakingChargeValue').value),
      discountOnMaking: parseFloat(document.getElementById('newDiscountOnMaking').value) || 0,
      otherCharges: parseFloat(document.getElementById('newOtherCharges').value) || 0,
      notes: document.getElementById('newNotes').value,
      isExchange: false
    };
    
    const totals = this.calculateNewItemValue();
    item.metalValue = totals.metalValue;
    item.makingCharge = totals.makingCharge;
    item.total = totals.total;
    
    this.newItems.push(item);
    this.updateNewItemsTable();
    this.updateExchangeSummary();
    this.clearNewForm();
    
    this.showAlert('New item added', 'success');
  }

  updateExchangeItemsTable() {
    const tbody = document.getElementById('exchangeItemsTableBody');
    tbody.innerHTML = '';
    
    this.exchangeItems.forEach((item, index) => {
      const row = tbody.insertRow();
      
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${item.productName}</td>
        <td>${item.metalType} ${item.purity}</td>
        <td>${item.netWeight.toFixed(3)}g</td>
        <td>₹${item.rate.toFixed(2)}</td>
        <td>₹${item.metalValue.toFixed(2)}</td>
        <td class="text-danger">-₹${item.exchangeDeduction.toFixed(2)}</td>
        <td>₹${item.otherCharges.toFixed(2)}</td>
        <td>₹${item.total.toFixed(2)}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="exchangeSystem.removeExchangeItem(${index})">
            Remove
          </button>
        </td>
      `;
    });
    
    document.getElementById('exchangeItemsTable').style.display = this.exchangeItems.length > 0 ? 'table' : 'none';
  }

  updateNewItemsTable() {
    const tbody = document.getElementById('newItemsTableBody');
    tbody.innerHTML = '';
    
    this.newItems.forEach((item, index) => {
      const row = tbody.insertRow();
      
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${item.productName}</td>
        <td>${item.metalType} ${item.purity}</td>
        <td>${item.netWeight.toFixed(3)}g</td>
        <td>₹${item.rate.toFixed(2)}</td>
        <td>₹${item.metalValue.toFixed(2)}</td>
        <td>₹${item.makingCharge.toFixed(2)}</td>
        <td>₹${item.otherCharges.toFixed(2)}</td>
        <td>₹${item.total.toFixed(2)}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="exchangeSystem.removeNewItem(${index})">
            Remove
          </button>
        </td>
      `;
    });
    
    document.getElementById('newItemsTable').style.display = this.newItems.length > 0 ? 'table' : 'none';
  }

  removeExchangeItem(index) {
    if (confirm('Are you sure you want to remove this exchange item?')) {
      this.exchangeItems.splice(index, 1);
      this.updateExchangeItemsTable();
      this.updateExchangeSummary();
      this.showAlert('Exchange item removed', 'info');
    }
  }

  removeNewItem(index) {
    if (confirm('Are you sure you want to remove this new item?')) {
      this.newItems.splice(index, 1);
      this.updateNewItemsTable();
      this.updateExchangeSummary();
      this.showAlert('New item removed', 'info');
    }
  }

  updateExchangeSummary() {
    const totalExchangeValue = this.exchangeItems.reduce((sum, item) => sum + item.total, 0);
    const totalNewValue = this.newItems.reduce((sum, item) => sum + item.total, 0);
    
    const cgst = parseFloat(document.getElementById('exchangeCgst').value) || 0;
    const sgst = parseFloat(document.getElementById('exchangeSgst').value) || 0;
    const igst = parseFloat(document.getElementById('exchangeIgst').value) || 0;
    const totalGst = cgst + sgst + igst;
    
    const netNewValue = totalNewValue + totalGst;
    const balance = netNewValue - totalExchangeValue;
    
    document.getElementById('totalExchangeValue').textContent = `₹${totalExchangeValue.toFixed(2)}`;
    document.getElementById('totalNewValue').textContent = `₹${totalNewValue.toFixed(2)}`;
    document.getElementById('totalGst').textContent = `₹${totalGst.toFixed(2)}`;
    document.getElementById('netNewValue').textContent = `₹${netNewValue.toFixed(2)}`;
    document.getElementById('balanceAmount').textContent = `₹${Math.abs(balance).toFixed(2)}`;
    
    const balanceElement = document.getElementById('balanceAmount');
    if (balance > 0) {
      balanceElement.className = 'text-success';
      document.getElementById('balanceLabel').textContent = 'Customer Pays:';
    } else if (balance < 0) {
      balanceElement.className = 'text-danger';
      document.getElementById('balanceLabel').textContent = 'Shop Pays:';
    } else {
      balanceElement.className = 'text-info';
      document.getElementById('balanceLabel').textContent = 'Balance:';
    }
    
    document.getElementById('exchangeSummary').style.display = 
      (this.exchangeItems.length > 0 || this.newItems.length > 0) ? 'block' : 'none';
  }

  clearExchangeForm() {
    document.getElementById('exchangeItemForm').reset();
    document.getElementById('exchangeNetWeight').value = '';
    document.getElementById('exchangeMetalValue').textContent = '₹0.00';
    document.getElementById('exchangeDeduction').textContent = '₹0.00';
    document.getElementById('exchangeTotalValue').textContent = '₹0.00';
    this.populatePurityDropdown('', 'exchange');
  }

  clearNewForm() {
    document.getElementById('newItemForm').reset();
    document.getElementById('newNetWeight').value = '';
    document.getElementById('newMetalValue').textContent = '₹0.00';
    document.getElementById('newMakingCharge').textContent = '₹0.00';
    document.getElementById('newTotalValue').textContent = '₹0.00';
    this.populatePurityDropdown('', 'new');
    document.getElementById('newMakingChargeType').value = '%';
  }

  clearAll() {
    if ((this.exchangeItems.length > 0 || this.newItems.length > 0) && 
        !confirm('Are you sure you want to clear all items?')) {
      return;
    }
    
    this.exchangeItems = [];
    this.newItems = [];
    this.clearExchangeForm();
    this.clearNewForm();
    document.getElementById('exchangeForm').reset();
    document.getElementById('exchangeItemsTable').style.display = 'none';
    document.getElementById('newItemsTable').style.display = 'none';
    document.getElementById('exchangeSummary').style.display = 'none';
    
    this.showAlert('All items cleared', 'info');
  }

  async completeExchange() {
    if (this.exchangeItems.length === 0 && this.newItems.length === 0) {
      this.showAlert('Please add at least one exchange or new item', 'danger');
      return;
    }
    
    const customerName = document.getElementById('exchangeCustomerName').value.trim();
    const customerPhone = document.getElementById('exchangeCustomerPhone').value.trim();
    
    if (!customerName || !customerPhone) {
      this.showAlert('Please enter customer name and phone number', 'danger');
      return;
    }
    
    if (customerPhone.length !== 10) {
      this.showAlert('Please enter a valid 10-digit phone number', 'danger');
      return;
    }
    
    // Combine all items (exchange items marked as exchange)
    const allItems = [
      ...this.exchangeItems,
      ...this.newItems
    ];
    
    const billData = {
      customerName,
      customerPhone,
      customerAddress: document.getElementById('exchangeCustomerAddress').value.trim(),
      items: allItems,
      cgst: parseFloat(document.getElementById('exchangeCgst').value) || 0,
      sgst: parseFloat(document.getElementById('exchangeSgst').value) || 0,
      igst: parseFloat(document.getElementById('exchangeIgst').value) || 0,
      paymentMethod: document.getElementById('exchangePaymentMethod').value,
      paymentStatus: document.getElementById('exchangePaymentStatus').value,
      notes: `Exchange Transaction\n${document.getElementById('exchangeNotes').value.trim()}`,
      billDate: new Date().toISOString().split('T')[0]
    };
    
    // Calculate final balance
    const totalExchangeValue = this.exchangeItems.reduce((sum, item) => sum + item.total, 0);
    const totalNewValue = this.newItems.reduce((sum, item) => sum + item.total, 0);
    const totalGst = billData.cgst + billData.sgst + billData.igst;
    const balance = (totalNewValue + totalGst) - totalExchangeValue;
    
    // Update payment status based on balance
    if (balance > 0) {
      billData.paymentStatus = 'partial';
      billData.notes += `\nBalance to pay: ₹${balance.toFixed(2)}`;
    } else if (balance < 0) {
      billData.paymentStatus = 'pending';
      billData.notes += `\nBalance to refund: ₹${Math.abs(balance).toFixed(2)}`;
    }
    
    // Show confirmation
    const confirmed = await this.showExchangeConfirmation(billData, balance);
    if (!confirmed) return;
    
    // Show loading
    const completeBtn = document.getElementById('completeExchangeBtn');
    const originalText = completeBtn.innerHTML;
    completeBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processing...';
    completeBtn.disabled = true;
    
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
        this.showAlert('Exchange completed successfully!', 'success');
        
        // Download PDF
        if (data.bill.pdfUrl) {
          window.open(data.bill.pdfUrl, '_blank');
        }
        
        // Clear all for next exchange
        this.clearAll();
        
        // Show success modal
        this.showExchangeSuccessModal(data.bill, balance);
      } else {
        this.showAlert(data.error || 'Failed to complete exchange', 'danger');
      }
    } catch (error) {
      console.error('Complete exchange error:', error);
      this.showAlert('Error completing exchange. Please try again.', 'danger');
    } finally {
      completeBtn.innerHTML = originalText;
      completeBtn.disabled = false;
    }
  }

  async showExchangeConfirmation(billData, balance) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal show';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Confirm Exchange Transaction</h5>
            <button type="button" class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="alert ${balance > 0 ? 'alert-warning' : balance < 0 ? 'alert-info' : 'alert-success'}">
              <strong>Exchange Value:</strong> ₹${this.exchangeItems.reduce((sum, item) => sum + item.total, 0).toFixed(2)}<br>
              <strong>New Purchase Value:</strong> ₹${this.newItems.reduce((sum, item) => sum + item.total, 0).toFixed(2)}<br>
              <strong>GST:</strong> ₹${(billData.cgst + billData.sgst + billData.igst).toFixed(2)}<br>
              <strong>Final Balance:</strong> <span class="${balance > 0 ? 'text-warning' : balance < 0 ? 'text-info' : 'text-success'}">
                ${balance > 0 ? 'Customer pays' : balance < 0 ? 'Shop pays' : 'Settled'}: ₹${Math.abs(balance).toFixed(2)}
              </span>
            </div>
            
            <div class="mb-3">
              <strong>Customer:</strong> ${billData.customerName}<br>
              <strong>Phone:</strong> ${billData.customerPhone}<br>
              <strong>Payment Method:</strong> ${billData.paymentMethod.toUpperCase()}
            </div>
            
            <div class="d-flex justify-content-between">
              <button class="btn btn-secondary" onclick="this.closest('.modal').remove(); resolve(false)">
                Cancel
              </button>
              <button class="btn btn-primary" onclick="this.closest('.modal').remove(); resolve(true)">
                Confirm & Generate Bill
              </button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
        resolve(false);
      });
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
          resolve(false);
        }
      });
    });
  }

  showExchangeSuccessModal(bill, balance) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Exchange Completed</h5>
          <button type="button" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="alert alert-success">
            <strong>Bill Number:</strong> ${bill.billNumber}<br>
            <strong>Total Amount:</strong> ₹${bill.totalAmount.toFixed(2)}<br>
            <strong>Balance:</strong> ${balance > 0 ? 'Customer pays' : balance < 0 ? 'Shop pays' : 'Settled'}: ₹${Math.abs(balance).toFixed(2)}<br>
            <strong>PDF:</strong> <a href="${bill.pdfUrl}" target="_blank">Download Invoice</a>
          </div>
          
          <div class="mt-3">
            <button class="btn btn-primary" onclick="window.print()">
              Print Bill
            </button>
            <button class="btn btn-secondary" onclick="exchangeSystem.clearAll(); this.closest('.modal').remove()">
              New Exchange
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
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

// Initialize exchange system when page loads
let exchangeSystem;
document.addEventListener('DOMContentLoaded', () => {
  exchangeSystem = new ExchangeSystem();
});
