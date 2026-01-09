/**
 * Billing System - Advanced Version with Admin Rates
 * Features:
 * - Dynamic metal/purity dropdowns from admin
 * - Manual GST entry
 * - Rate auto-fill from admin
 * - Professional UI/UX
 */

class AdvancedBillingSystem {
  constructor() {
    this.apiBase = 'http://localhost:5000/api';
    this.token = window.auth.getToken();
    
    // Initialize data
    this.items = [];
    this.exchangeItems = [];
    this.currentItemId = 1;
    this.currentExchangeId = 1;
    this.rates = {}; // Will store rates from backend
    this.metalPurityMap = {}; // Map of metal to purities
    
    // Customer data
    this.customer = {
      name: '',
      mobile: '',
      address: '',
      dob: '',
      pan: '',
      aadhaar: '',
      gstin: ''
    };
    
    // GST data
    this.gst = {
      enabled: false,
      type: 'NONE',
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalGST: 0
    };
    
    // Initialize
    this.init();
  }
  
  async init() {
    this.setupEventListeners();
    await this.loadRates(); // Load rates before adding items
    this.addNewItem();
    this.setupGSTControls();
  }
  
  async loadRates() {
    try {
      const response = await fetch(`${this.apiBase}/rates/active`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          this.rates = data.rates;
          this.populateMetalDropdowns();
        }
      }
    } catch (error) {
      console.error('Failed to load rates:', error);
      this.showAlert('danger', 'Failed to load metal rates. Using default values.');
    }
  }
  
  populateMetalDropdowns() {
    // Get all metal types
    const metalTypes = Object.keys(this.rates);
    
    // Update all metal dropdowns
    document.querySelectorAll('.item-metal, .exchange-metal').forEach(dropdown => {
      const currentValue = dropdown.value;
      dropdown.innerHTML = '<option value="">Select Metal</option>';
      
      metalTypes.forEach(metal => {
        const option = document.createElement('option');
        option.value = metal;
        option.textContent = metal;
        if (metal === currentValue) option.selected = true;
        dropdown.appendChild(option);
      });
    });
    
    // Store metal to purity mapping
    this.metalPurityMap = {};
    metalTypes.forEach(metal => {
      this.metalPurityMap[metal] = this.rates[metal].map(r => r.purity);
    });
  }
  
  populatePurityDropdown(metalType, dropdown) {
    if (!metalType || !this.metalPurityMap[metalType]) {
      dropdown.innerHTML = '<option value="">Select Purity</option>';
      return;
    }
    
    const currentValue = dropdown.value;
    dropdown.innerHTML = '<option value="">Select Purity</option>';
    
    this.metalPurityMap[metalType].forEach(purity => {
      const option = document.createElement('option');
      option.value = purity;
      option.textContent = purity;
      if (purity === currentValue) option.selected = true;
      dropdown.appendChild(option);
    });
  }
  
  getRateForMetalPurity(metalType, purity) {
    if (!metalType || !purity || !this.rates[metalType]) return 0;
    
    const rateObj = this.rates[metalType].find(r => r.purity === purity);
    return rateObj ? rateObj.rate : 0;
  }
  
  isGSTApplicableForMetalPurity(metalType, purity) {
    if (!metalType || !purity || !this.rates[metalType]) return true;
    
    const rateObj = this.rates[metalType].find(r => r.purity === purity);
    return rateObj ? rateObj.gstApplicable : true;
  }
  
  setupEventListeners() {
    // Customer form listeners
    ['customerName', 'customerMobile', 'customerAddress', 'customerDOB', 'customerPAN', 'customerAadhaar', 'customerGSTIN'].forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('change', (e) => {
          const field = id.replace('customer', '').toLowerCase();
          this.customer[field] = e.target.value;
        });
      }
    });
    
    // Add item button
    document.getElementById('addItemBtn')?.addEventListener('click', () => {
      this.addNewItem();
    });
    
    // Add exchange button
    document.getElementById('addExchangeBtn')?.addEventListener('click', () => {
      this.addExchangeItem();
    });
    
    // Generate bill button
    document.getElementById('generateBillBtn')?.addEventListener('click', () => {
      this.generateBill();
    });
    
    // Print bill button
    document.getElementById('printBillBtn')?.addEventListener('click', () => {
      this.printBill();
    });
    
    // Discount input
    document.getElementById('discount')?.addEventListener('change', (e) => {
      this.updateBillSummary();
    });
    
    // Payment mode change
    document.getElementById('paymentMode')?.addEventListener('change', (e) => {
      this.updateBillSummary();
    });
    
    // Clear form button
    document.querySelectorAll('.btn-outline').forEach(btn => {
      if (btn.textContent.includes('Clear')) {
        btn.addEventListener('click', () => this.clearForm());
      }
    });
    
    // Auto-fill customer from mobile (if existing customer)
    document.getElementById('customerMobile')?.addEventListener('blur', async (e) => {
      if (e.target.value && e.target.value.length === 10) {
        await this.autoFillCustomer(e.target.value);
      }
    });
  }
  
  setupGSTControls() {
    const gstTypeSelect = document.getElementById('gstType');
    if (!gstTypeSelect) return;
    
    gstTypeSelect.addEventListener('change', (e) => {
      this.gst.type = e.target.value;
      this.gst.enabled = e.target.value !== 'NONE';
      this.toggleGSTFields();
      this.updateBillSummary();
    });
    
    // GST amount inputs
    ['cgstAmount', 'sgstAmount', 'igstAmount', 'totalGST'].forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('change', (e) => {
          const field = id.replace('Amount', '').replace('totalGST', 'totalGST');
          this.gst[field] = parseFloat(e.target.value) || 0;
          this.validateGSTAmounts();
          this.updateBillSummary();
        });
      }
    });
    
    this.toggleGSTFields();
  }
  
  toggleGSTFields() {
    const gstType = this.gst.type;
    const gstSection = document.getElementById('gstSection');
    
    if (!gstSection) return;
    
    // Show/hide appropriate fields based on GST type
    if (gstType === 'CGST_SGST') {
      document.getElementById('cgstGroup').style.display = 'block';
      document.getElementById('sgstGroup').style.display = 'block';
      document.getElementById('igstGroup').style.display = 'none';
    } else if (gstType === 'IGST') {
      document.getElementById('cgstGroup').style.display = 'none';
      document.getElementById('sgstGroup').style.display = 'none';
      document.getElementById('igstGroup').style.display = 'block';
    } else {
      document.getElementById('cgstGroup').style.display = 'none';
      document.getElementById('sgstGroup').style.display = 'none';
      document.getElementById('igstGroup').style.display = 'none';
    }
  }
  
  validateGSTAmounts() {
    if (this.gst.type === 'CGST_SGST') {
      // Ensure total matches sum
      const sum = (this.gst.cgstAmount || 0) + (this.gst.sgstAmount || 0);
      if (Math.abs(sum - this.gst.totalGST) > 0.01) {
        this.gst.totalGST = sum;
        document.getElementById('totalGST').value = sum.toFixed(2);
      }
    } else if (this.gst.type === 'IGST') {
      this.gst.totalGST = this.gst.igstAmount || 0;
      document.getElementById('totalGST').value = this.gst.totalGST.toFixed(2);
    }
  }
  
  async autoFillCustomer(mobile) {
    try {
      const response = await fetch(`${this.apiBase}/customers/search?mobile=${mobile}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.customers.length > 0) {
          const customer = data.customers[0];
          this.customer = { ...this.customer, ...customer };
          
          // Fill form fields
          document.getElementById('customerName').value = customer.name || '';
          document.getElementById('customerAddress').value = customer.address || '';
          document.getElementById('customerPAN').value = customer.pan || '';
          document.getElementById('customerAadhaar').value = customer.aadhaar || '';
          document.getElementById('customerGSTIN').value = customer.gstin || '';
          
          this.showAlert('info', `Customer "${customer.name}" loaded from database.`);
        }
      }
    } catch (error) {
      // Silent fail - customer not found is okay
    }
  }
  
  addNewItem() {
    const container = document.getElementById('itemsContainer');
    const itemId = `item-${this.currentItemId++}`;
    
    // Remove initial placeholder if present
    const placeholder = container.querySelector('.text-center.text-muted');
    if (placeholder) placeholder.remove();
    
    const itemRow = document.createElement('div');
    itemRow.className = 'item-row';
    itemRow.id = itemId;
    
    itemRow.innerHTML = `
      <!-- Product -->
      <div class="field-group">
        <label class="field-label">Product</label>
        <input type="text" class="form-control item-product" placeholder="Product Name" 
               onchange="window.billingSystem.updateItem('${itemId}', 'product', this.value)">
      </div>
      
      <!-- Unit -->
      <div class="field-group">
        <label class="field-label">Unit</label>
        <input type="text" class="form-control item-unit" placeholder="PCS/Set" 
               onchange="window.billingSystem.updateItem('${itemId}', 'unit', this.value)">
      </div>
      
      <!-- Num -->
      <div class="field-group">
        <label class="field-label">Num</label>
        <input type="text" class="form-control item-num" placeholder="Num" 
               onchange="window.billingSystem.updateItem('${itemId}', 'num', this.value)">
      </div>
      
      <!-- Stmp -->
      <div class="field-group">
        <label class="field-label">Stmp</label>
        <input type="text" class="form-control item-stmp" placeholder="Stmp" 
               onchange="window.billingSystem.updateItem('${itemId}', 'stmp', this.value)">
      </div>
      
      <!-- Qty -->
      <div class="field-group">
        <label class="field-label required">Qty</label>
        <input type="number" class="form-control item-qty" placeholder="Qty" value="1" min="1" step="0.001"
               onchange="window.billingSystem.updateItem('${itemId}', 'qty', this.value); window.billingSystem.calculateNetWeight('${itemId}')">
      </div>
      
      <!-- Gr.Wt -->
      <div class="field-group">
        <label class="field-label required">Gr.Wt</label>
        <input type="number" class="form-control item-grWt" placeholder="Gr.Wt" step="0.001" min="0"
               onchange="window.billingSystem.calculateNetWeight('${itemId}')">
      </div>
      
      <!-- Less -->
      <div class="field-group">
        <label class="field-label">Less</label>
        <input type="number" class="form-control item-less" placeholder="Less" step="0.001" min="0"
               onchange="window.billingSystem.calculateNetWeight('${itemId}')">
      </div>
      
      <!-- Nt.Wt -->
      <div class="field-group">
        <label class="field-label required">Nt.Wt</label>
        <input type="number" class="form-control item-ntWt" placeholder="Nt.Wt" step="0.001" min="0" readonly
               onchange="window.billingSystem.updateItem('${itemId}', 'ntWt', this.value)">
      </div>
      
      <!-- Metal Type -->
      <div class="field-group">
        <label class="field-label required">Metal</label>
        <select class="form-control item-metal" 
                onchange="window.billingSystem.onMetalChange('${itemId}', this.value)">
          <option value="">Select Metal</option>
          ${Object.keys(this.rates).map(metal => 
            `<option value="${metal}">${metal}</option>`
          ).join('')}
        </select>
      </div>
      
      <!-- Purity -->
      <div class="field-group">
        <label class="field-label required">Purity</label>
        <select class="form-control item-purity" 
                onchange="window.billingSystem.onPurityChange('${itemId}', this.value)">
          <option value="">Select Purity</option>
        </select>
      </div>
      
      <!-- Rate -->
      <div class="field-group">
        <label class="field-label required">Rate</label>
        <input type="number" class="form-control item-rate" placeholder="Rate" step="0.01" min="0"
               onchange="window.billingSystem.updateItem('${itemId}', 'rate', this.value)">
      </div>
      
      <!-- Tnch -->
      <div class="field-group">
        <label class="field-label">Tnch</label>
        <input type="text" class="form-control item-tnch" placeholder="Tnch(%)" 
               onchange="window.billingSystem.updateItem('${itemId}', 'tnch', this.value)">
      </div>
      
      <!-- Making Type -->
      <div class="field-group">
        <label class="field-label">Mk Type</label>
        <select class="form-control item-mk" onchange="window.billingSystem.updateItem('${itemId}', 'mk', this.value)">
          <option value="FIX">FIX</option>
          <option value="%">%</option>
          <option value="GRM">GRM</option>
        </select>
      </div>
      
      <!-- Making Charges -->
      <div class="field-group">
        <label class="field-label">Mk Charges</label>
        <input type="number" class="form-control item-mkCrg" placeholder="MkCrg" step="0.01" min="0"
               onchange="window.billingSystem.updateItem('${itemId}', 'mkCrg', this.value)">
      </div>
      
      <!-- Discount on Making -->
      <div class="field-group">
        <label class="field-label">DisMk%</label>
        <input type="number" class="form-control item-disMk" placeholder="DisMk%" step="0.01" min="0" max="100"
               onchange="window.billingSystem.updateItem('${itemId}', 'disMk', this.value)">
      </div>
      
      <!-- HUID -->
      <div class="field-group">
        <label class="field-label">HUID</label>
        <input type="text" class="form-control item-huid" placeholder="HUID" 
               onchange="window.billingSystem.updateItem('${itemId}', 'huid', this.value)">
      </div>
      
      <!-- HUID Charges -->
      <div class="field-group">
        <label class="field-label">Hu Charges</label>
        <input type="number" class="form-control item-huCrg" placeholder="HuCrg" step="0.01" min="0"
               onchange="window.billingSystem.updateItem('${itemId}', 'huCrg', this.value)">
      </div>
      
      <!-- Delete button -->
      <div class="field-group">
        <label class="field-label">&nbsp;</label>
        <button class="btn btn-danger btn-sm btn-block" onclick="window.billingSystem.removeItem('${itemId}')">
          <i class="fas fa-trash"></i> Remove
        </button>
      </div>
    `;
    
    container.appendChild(itemRow);
    
    // Initialize item object
    this.items.push({
      id: itemId,
      product: '',
      unit: '',
      num: '',
      stmp: '',
      qty: 1,
      grWt: 0,
      less: 0,
      ntWt: 0,
      metalType: '',
      purity: '',
      tnch: '',
      huid: '',
      huCrg: 0,
      mk: 'FIX',
      mkCrg: 0,
      rate: 0,
      disMk: 0,
      gstApplicable: true,
      isExchange: false
    });
    
    this.updateResponsiveLayout();
  }
  
  onMetalChange(itemId, metalType) {
    const row = document.getElementById(itemId);
    if (!row) return;
    
    const purityDropdown = row.querySelector('.item-purity');
    this.populatePurityDropdown(metalType, purityDropdown);
    
    // Update item object
    const itemIndex = this.items.findIndex(item => item.id === itemId);
    if (itemIndex !== -1) {
      this.items[itemIndex].metalType = metalType;
      this.items[itemIndex].purity = '';
      
      // Clear rate when metal changes
      const rateInput = row.querySelector('.item-rate');
      rateInput.value = '';
      this.items[itemIndex].rate = 0;
      
      // Update GST applicability
      this.updateGSTApplicability();
    }
  }
  
  onPurityChange(itemId, purity) {
    const row = document.getElementById(itemId);
    if (!row) return;
    
    // Update item object
    const itemIndex = this.items.findIndex(item => item.id === itemId);
    if (itemIndex !== -1) {
      const metalType = this.items[itemIndex].metalType;
      this.items[itemIndex].purity = purity;
      
      // Auto-fill rate from admin rates
      const rate = this.getRateForMetalPurity(metalType, purity);
      if (rate > 0) {
        const rateInput = row.querySelector('.item-rate');
        rateInput.value = rate;
        this.items[itemIndex].rate = rate;
      }
      
      // Update GST applicability
      const gstApplicable = this.isGSTApplicableForMetalPurity(metalType, purity);
      this.items[itemIndex].gstApplicable = gstApplicable;
      
      // Auto-fill tunch for gold
      if (metalType === 'Gold' && purity) {
        const tnchMap = {
          '24K': '99.9%',
          '22K': '91.6%',
          '916': '91.6%',
          '18K': '75.0%',
          '750': '75.0%',
          '14K': '58.3%',
          '585': '58.5%'
        };
        
        if (tnchMap[purity]) {
          const tnchInput = row.querySelector('.item-tnch');
          if (tnchInput && !tnchInput.value) {
            tnchInput.value = tnchMap[purity];
            this.items[itemIndex].tnch = tnchMap[purity];
          }
        }
      }
      
      this.updateBillSummary();
    }
  }
  
  updateGSTApplicability() {
    // Check if any item has GST applicable
    const hasGSTApplicableItem = this.items.some(item => 
      item.metalType && item.purity && item.gstApplicable
    );
    
    // If no items have GST applicable, disable GST
    if (!hasGSTApplicableItem) {
      this.gst.enabled = false;
      this.gst.type = 'NONE';
      this.gst.cgstAmount = 0;
      this.gst.sgstAmount = 0;
      this.gst.igstAmount = 0;
      this.gst.totalGST = 0;
      
      document.getElementById('gstType').value = 'NONE';
      document.getElementById('cgstAmount').value = '0';
      document.getElementById('sgstAmount').value = '0';
      document.getElementById('igstAmount').value = '0';
      document.getElementById('totalGST').value = '0';
      
      this.toggleGSTFields();
    }
  }
  
  // ... rest of the methods (calculateNetWeight, updateItem, removeItem, etc.) 
  // remain similar but updated to use the new GST system and rate management
  
  async generateBill() {
    if (!this.validateBill()) {
      return;
    }
    
    const btn = document.getElementById('generateBillBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Generating Bill...';
    btn.disabled = true;
    
    try {
      // Prepare bill data with manual GST
      const billData = {
        customer: this.customer,
        items: this.items,
        exchangeItems: this.exchangeItems,
        paymentMode: document.getElementById('paymentMode')?.value || 'cash',
        discount: parseFloat(document.getElementById('discount')?.value) || 0,
        gst: this.gst
      };
      
      const response = await fetch(`${this.apiBase}/bills/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(billData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.showAlert('success', 'Bill generated successfully!');
        this.showBillPreview(data.bill);
        document.getElementById('printBillBtn').disabled = false;
        
        // Store bill for printing
        window.currentBill = data.bill;
        
        // Clear form after successful generation
        setTimeout(() => this.clearForm(), 3000);
      } else {
        throw new Error(data.message || 'Failed to generate bill');
      }
    } catch (error) {
      console.error('Generate bill error:', error);
      this.showAlert('danger', error.message || 'Failed to generate bill');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }
  
  // ... rest of the methods remain with appropriate updates for the new system
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  if (window.auth && window.auth.isAuthenticated && window.auth.isAuthenticated()) {
    window.billingSystem = new AdvancedBillingSystem();
  } else {
    window.location.href = 'login.html';
  }
});
