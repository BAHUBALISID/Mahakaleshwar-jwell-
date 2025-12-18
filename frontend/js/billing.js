// Billing System JavaScript
class BillingSystem {
    constructor() {
        this.items = [];
        this.exchangeItems = [];
        this.currentBillNumber = '';
        this.currentRates = null;
        this.billType = 'sale';
        this.customer = {
            name: '',
            phone: '',
            address: ''
        };
        this.payment = {
            method: 'cash',
            status: 'paid',
            paidAmount: 0
        };
        this.totals = {
            totalMetalValue: 0,
            totalMakingCharge: 0,
            totalBeforeTax: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            totalTax: 0,
            totalAmount: 0,
            totalExchangeValue: 0,
            netPayable: 0,
            balanceType: 'payable'
        };
        
        this.apiBase = window.location.origin.includes('localhost') 
            ? 'http://localhost:5000/api' 
            : '/api';
    }
    
    // Initialize billing system
    async initialize() {
        if (!authManager.checkAuth()) return false;
        
        // Load current rates
        await this.loadRates();
        
        // Generate bill number
        await this.generateBillNumber();
        
        // Check if viewing existing bill
        this.checkViewMode();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Add first item row
        this.addItemRow();
        
        // Update totals
        this.updateTotals();
        
        return true;
    }
    
    // Load current rates
    async loadRates() {
        try {
            const response = await fetch(`${this.apiBase}/rates/current`, {
                headers: authManager.getAuthHeaders()
            });
            
            const data = await response.json();
            
            if (data.success && data.rates) {
                this.currentRates = data.rates;
                this.displayRates();
            }
        } catch (error) {
            console.error('Error loading rates:', error);
            alert('Error loading current rates. Please try again.');
        }
    }
    
    // Display rates in form
    displayRates() {
        if (!this.currentRates) return;
        
        const ratesInfo = document.getElementById('ratesInfo');
        if (ratesInfo) {
            ratesInfo.innerHTML = `
                <span class="rate-badge">Gold 24K: ₹${(this.currentRates.gold24K / 100000).toFixed(2)}/g</span>
                <span class="rate-badge">Gold 22K: ₹${(this.currentRates.gold22K / 100000).toFixed(2)}/g</span>
                <span class="rate-badge">Gold 18K: ₹${(this.currentRates.gold18K / 100000).toFixed(2)}/g</span>
                <span class="rate-badge">Silver 999: ₹${(this.currentRates.silver999 / 1000).toFixed(2)}/g</span>
                <span class="rate-badge">Silver 925: ₹${(this.currentRates.silver925 / 1000).toFixed(2)}/g</span>
            `;
        }
    }
    
    // Generate bill number
    async generateBillNumber() {
        // In a real app, this would come from the server
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
        const randomNum = Math.floor(Math.random() * 1000).toString().padStart(4, '0');
        this.currentBillNumber = `SMJ-${dateStr}-${randomNum}`;
        
        const billNumberElement = document.getElementById('billNumber');
        if (billNumberElement) {
            billNumberElement.textContent = this.currentBillNumber;
        }
    }
    
    // Check if in view mode
    checkViewMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const billId = urlParams.get('view');
        
        if (billId) {
            this.loadBillForView(billId);
        }
    }
    
    // Load bill for viewing
    async loadBillForView(billId) {
        try {
            const response = await fetch(`${this.apiBase}/bills/${billId}`, {
                headers: authManager.getAuthHeaders()
            });
            
            const data = await response.json();
            
            if (data.success && data.bill) {
                this.displayBillForView(data.bill);
            }
        } catch (error) {
            console.error('Error loading bill:', error);
        }
    }
    
    // Display bill in view mode
    displayBillForView(bill) {
        // Disable form
        document.querySelectorAll('input, select, button').forEach(el => {
            if (!el.classList.contains('print-btn')) {
                el.disabled = true;
            }
        });
        
        // Set customer info
        document.getElementById('customerName').value = bill.customerName;
        document.getElementById('customerPhone').value = bill.customerPhone;
        document.getElementById('customerAddress').value = bill.customerAddress;
        
        // Set bill number
        document.getElementById('billNumber').textContent = bill.billNumber;
        this.currentBillNumber = bill.billNumber;
        
        // Set payment info
        document.getElementById('paymentMethod').value = bill.paymentMethod;
        document.getElementById('paymentStatus').value = bill.paymentStatus;
        document.getElementById('paidAmount').value = bill.paidAmount;
        
        // Load items
        this.items = bill.items;
        this.displayItems();
        
        // Load exchange items if any
        if (bill.exchangeItems && bill.exchangeItems.length > 0) {
            this.exchangeItems = bill.exchangeItems;
            this.displayExchangeItems();
        }
        
        // Update totals
        this.totals = {
            totalMetalValue: bill.totalMetalValue,
            totalMakingCharge: bill.totalMakingCharge,
            totalBeforeTax: bill.totalBeforeTax,
            cgstAmount: bill.cgstAmount,
            sgstAmount: bill.sgstAmount,
            totalTax: bill.totalTax,
            totalAmount: bill.totalAmount,
            totalExchangeValue: bill.totalExchangeValue,
            netPayable: bill.netPayable,
            balanceType: bill.balanceType
        };
        
        this.updateTotalsDisplay();
        
        // Change title
        document.querySelector('h2').innerHTML = '<i class="fas fa-eye"></i> View Bill';
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Add item button
        const addItemBtn = document.getElementById('addItem');
        if (addItemBtn) {
            addItemBtn.addEventListener('click', () => this.addItemRow());
        }
        
        // Calculate button
        const calculateBtn = document.getElementById('calculateTotals');
        if (calculateBtn) {
            calculateBtn.addEventListener('click', () => this.updateTotals());
        }
        
        // Save bill button
        const saveBillBtn = document.getElementById('saveBill');
        if (saveBillBtn) {
            saveBillBtn.addEventListener('click', () => this.saveBill());
        }
        
        // Print button
        const printBtn = document.getElementById('printBill');
        if (printBtn) {
            printBtn.addEventListener('click', () => this.printBill());
        }
        
        // Payment status change
        const paymentStatus = document.getElementById('paymentStatus');
        if (paymentStatus) {
            paymentStatus.addEventListener('change', () => this.updatePaymentFields());
        }
        
        // Bill type change
        const billType = document.getElementById('billType');
        if (billType) {
            billType.addEventListener('change', (e) => {
                this.billType = e.target.value;
                this.toggleExchangeSection();
            });
        }
        
        // Add exchange item
        const addExchangeBtn = document.getElementById('addExchangeItem');
        if (addExchangeBtn) {
            addExchangeBtn.addEventListener('click', () => this.addExchangeItem());
        }
        
        // Metal type change in items
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('item-metal-type')) {
                const row = e.target.closest('.item-row');
                this.updatePurityOptions(row);
            }
        });
    }
    
    // Add new item row
    addItemRow() {
        const tbody = document.querySelector('#itemsTable tbody');
        if (!tbody) return;
        
        const row = document.createElement('tr');
        row.className = 'item-row';
        row.innerHTML = `
            <td>
                <input type="text" class="form-control item-description" placeholder="Item description" required>
            </td>
            <td>
                <select class="form-control item-metal-type" required>
                    <option value="">Select</option>
                    <option value="gold">Gold</option>
                    <option value="silver">Silver</option>
                </select>
            </td>
            <td>
                <select class="form-control item-purity" required>
                    <option value="">Select Purity</option>
                </select>
            </td>
            <td>
                <input type="number" class="form-control item-gross-weight" step="0.001" placeholder="0.000" required>
            </td>
            <td>
                <input type="number" class="form-control item-net-weight" step="0.001" placeholder="0.000" required>
            </td>
            <td>
                <select class="form-control item-making-type">
                    <option value="percentage">%</option>
                    <option value="fixed">₹</option>
                </select>
            </td>
            <td>
                <input type="number" class="form-control item-making-value" step="0.01" placeholder="0.00" required>
            </td>
            <td class="item-rate-per-gram">₹0.00</td>
            <td class="item-metal-value">₹0.00</td>
            <td class="item-making-charge">₹0.00</td>
            <td class="item-total">₹0.00</td>
            <td>
                <button type="button" class="btn-danger btn-sm" onclick="billingSystem.removeItemRow(this)">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
        
        // Set up event listeners for this row
        this.setupItemRowListeners(row);
    }
    
    // Setup event listeners for item row
    setupItemRowListeners(row) {
        const inputs = row.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('change', () => this.calculateItem(row));
            input.addEventListener('input', () => this.calculateItem(row));
        });
    }
    
    // Update purity options based on metal type
    updatePurityOptions(row) {
        const metalType = row.querySelector('.item-metal-type').value;
        const puritySelect = row.querySelector('.item-purity');
        
        puritySelect.innerHTML = '<option value="">Select Purity</option>';
        
        if (metalType === 'gold') {
            puritySelect.innerHTML += `
                <option value="24K">24K</option>
                <option value="22K">22K</option>
                <option value="18K">18K</option>
            `;
        } else if (metalType === 'silver') {
            puritySelect.innerHTML += `
                <option value="999">999</option>
                <option value="925">925</option>
            `;
        }
    }
    
    // Calculate item values
    calculateItem(row) {
        if (!this.currentRates) return;
        
        const metalType = row.querySelector('.item-metal-type').value;
        const purity = row.querySelector('.item-purity').value;
        const grossWeight = parseFloat(row.querySelector('.item-gross-weight').value) || 0;
        const netWeight = parseFloat(row.querySelector('.item-net-weight').value) || 0;
        const makingType = row.querySelector('.item-making-type').value;
        const makingValue = parseFloat(row.querySelector('.item-making-value').value) || 0;
        
        if (!metalType || !purity || netWeight <= 0) return;
        
        // Get rate per gram
        const ratePerGram = this.getRatePerGram(metalType, purity);
        
        // Calculate metal value
        const metalValue = netWeight * ratePerGram;
        
        // Calculate making charge
        let makingCharge = 0;
        if (makingType === 'percentage') {
            makingCharge = (metalValue * makingValue) / 100;
        } else {
            makingCharge = makingValue;
        }
        
        // Calculate total before tax
        const totalBeforeTax = metalValue + makingCharge;
        
        // Calculate GST (3% CGST + 3% SGST)
        const cgst = (totalBeforeTax * 3) / 100;
        const sgst = (totalBeforeTax * 3) / 100;
        const total = totalBeforeTax + cgst + sgst;
        
        // Update row display
        row.querySelector('.item-rate-per-gram').textContent = `₹${ratePerGram.toFixed(2)}`;
        row.querySelector('.item-metal-value').textContent = `₹${metalValue.toFixed(2)}`;
        row.querySelector('.item-making-charge').textContent = `₹${makingCharge.toFixed(2)}`;
        row.querySelector('.item-total').textContent = `₹${total.toFixed(2)}`;
        
        // Store item data
        const itemIndex = Array.from(row.parentNode.children).indexOf(row);
        this.items[itemIndex] = {
            description: row.querySelector('.item-description').value,
            metalType,
            purity,
            grossWeight,
            netWeight,
            makingChargeType: makingType,
            makingChargeValue: makingValue,
            ratePerGram,
            metalValue,
            makingCharge,
            totalBeforeTax,
            cgst,
            sgst,
            total
        };
        
        // Update totals
        this.updateTotals();
    }
    
    // Get rate per gram based on metal type and purity
    getRatePerGram(metalType, purity) {
        if (!this.currentRates) return 0;
        
        const rateMap = {
            'gold': {
                '24K': this.currentRates.gold24KPerGram,
                '22K': this.currentRates.gold22KPerGram,
                '18K': this.currentRates.gold18KPerGram
            },
            'silver': {
                '999': this.currentRates.silver999PerGram,
                '925': this.currentRates.silver925PerGram
            }
        };
        
        return rateMap[metalType]?.[purity] || 0;
    }
    
    // Remove item row
    removeItemRow(button) {
        const row = button.closest('.item-row');
        const itemIndex = Array.from(row.parentNode.children).indexOf(row);
        
        // Remove from items array
        this.items.splice(itemIndex, 1);
        
        // Remove row from DOM
        row.remove();
        
        // Update totals
        this.updateTotals();
    }
    
    // Update totals
    updateTotals() {
        // Recalculate from items
        this.totals = {
            totalMetalValue: 0,
            totalMakingCharge: 0,
            totalBeforeTax: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            totalTax: 0,
            totalAmount: 0,
            totalExchangeValue: this.totals.totalExchangeValue,
            netPayable: 0,
            balanceType: 'payable'
        };
        
        this.items.forEach(item => {
            if (item) {
                this.totals.totalMetalValue += item.metalValue || 0;
                this.totals.totalMakingCharge += item.makingCharge || 0;
                this.totals.totalBeforeTax += item.totalBeforeTax || 0;
                this.totals.cgstAmount += item.cgst || 0;
                this.totals.sgstAmount += item.sgst || 0;
                this.totals.totalTax += (item.cgst || 0) + (item.sgst || 0);
                this.totals.totalAmount += item.total || 0;
            }
        });
        
        // Calculate net payable considering exchange
        const net = this.totals.totalAmount - this.totals.totalExchangeValue;
        this.totals.netPayable = Math.abs(net);
        this.totals.balanceType = net >= 0 ? 'payable' : 'refundable';
        
        // Update display
        this.updateTotalsDisplay();
    }
    
    // Update totals display
    updateTotalsDisplay() {
        document.getElementById('totalMetalValue').textContent = `₹${this.totals.totalMetalValue.toFixed(2)}`;
        document.getElementById('totalMakingCharge').textContent = `₹${this.totals.totalMakingCharge.toFixed(2)}`;
        document.getElementById('totalBeforeTax').textContent = `₹${this.totals.totalBeforeTax.toFixed(2)}`;
        document.getElementById('cgstAmount').textContent = `₹${this.totals.cgstAmount.toFixed(2)}`;
        document.getElementById('sgstAmount').textContent = `₹${this.totals.sgstAmount.toFixed(2)}`;
        document.getElementById('totalTax').textContent = `₹${this.totals.totalTax.toFixed(2)}`;
        document.getElementById('totalAmount').textContent = `₹${this.totals.totalAmount.toFixed(2)}`;
        document.getElementById('totalExchangeValue').textContent = `₹${this.totals.totalExchangeValue.toFixed(2)}`;
        document.getElementById('netPayable').textContent = `₹${this.totals.netPayable.toFixed(2)}`;
        
        // Update balance type display
        const balanceTypeElement = document.getElementById('balanceType');
        if (balanceTypeElement) {
            balanceTypeElement.textContent = this.totals.balanceType === 'payable' ? 'Payable by Customer' : 'Refundable to Customer';
            balanceTypeElement.className = this.totals.balanceType === 'payable' ? 'badge badge-danger' : 'badge badge-success';
        }
        
        // Update bill total in header
        const billTotalElement = document.getElementById('billTotal');
        if (billTotalElement) {
            billTotalElement.textContent = `₹${this.totals.netPayable.toFixed(2)}`;
        }
    }
    
    // Toggle exchange section based on bill type
    toggleExchangeSection() {
        const exchangeSection = document.getElementById('exchangeSection');
        if (!exchangeSection) return;
        
        if (this.billType === 'exchange' || this.billType === 'sale_exchange') {
            exchangeSection.style.display = 'block';
        } else {
            exchangeSection.style.display = 'none';
            this.exchangeItems = [];
            this.totals.totalExchangeValue = 0;
            this.updateTotals();
        }
    }
    
    // Add exchange item
    addExchangeItem() {
        const tbody = document.querySelector('#exchangeItemsTable tbody');
        if (!tbody) return;
        
        const row = document.createElement('tr');
        row.className = 'exchange-item-row';
        row.innerHTML = `
            <td>
                <input type="text" class="form-control exchange-description" placeholder="Item description">
            </td>
            <td>
                <select class="form-control exchange-metal-type" required>
                    <option value="">Select</option>
                    <option value="gold">Gold</option>
                    <option value="silver">Silver</option>
                </select>
            </td>
            <td>
                <select class="form-control exchange-purity" required>
                    <option value="">Select Purity</option>
                </select>
            </td>
            <td>
                <input type="number" class="form-control exchange-weight" step="0.001" placeholder="0.000" required>
            </td>
            <td>
                <input type="number" class="form-control exchange-wastage" step="0.01" placeholder="0" value="0" min="0" max="100">
            </td>
            <td class="exchange-rate-per-gram">₹0.00</td>
            <td class="exchange-value">₹0.00</td>
            <td>
                <button type="button" class="btn-danger btn-sm" onclick="billingSystem.removeExchangeItem(this)">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
        
        // Set up event listeners
        this.setupExchangeRowListeners(row);
    }
    
    // Setup event listeners for exchange row
    setupExchangeRowListeners(row) {
        const metalTypeSelect = row.querySelector('.exchange-metal-type');
        const puritySelect = row.querySelector('.exchange-purity');
        
        metalTypeSelect.addEventListener('change', () => {
            this.updateExchangePurityOptions(row);
            this.calculateExchangeItem(row);
        });
        
        const inputs = row.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('change', () => this.calculateExchangeItem(row));
            input.addEventListener('input', () => this.calculateExchangeItem(row));
        });
    }
    
    // Update purity options for exchange item
    updateExchangePurityOptions(row) {
        const metalType = row.querySelector('.exchange-metal-type').value;
        const puritySelect = row.querySelector('.exchange-purity');
        
        puritySelect.innerHTML = '<option value="">Select Purity</option>';
        
        if (metalType === 'gold') {
            puritySelect.innerHTML += `
                <option value="24K">24K</option>
                <option value="22K">22K</option>
                <option value="18K">18K</option>
            `;
        } else if (metalType === 'silver') {
            puritySelect.innerHTML += `
                <option value="999">999</option>
                <option value="925">925</option>
            `;
        }
    }
    
    // Calculate exchange item value
    calculateExchangeItem(row) {
        if (!this.currentRates) return;
        
        const metalType = row.querySelector('.exchange-metal-type').value;
        const purity = row.querySelector('.exchange-purity').value;
        const weight = parseFloat(row.querySelector('.exchange-weight').value) || 0;
        const wastage = parseFloat(row.querySelector('.exchange-wastage').value) || 0;
        
        if (!metalType || !purity || weight <= 0) return;
        
        // Get rate per gram
        const ratePerGram = this.getRatePerGram(metalType, purity);
        
        // Calculate metal value
        const metalValue = weight * ratePerGram;
        
        // Apply wastage deduction
        const wastageDeduction = (metalValue * wastage) / 100;
        const exchangeValue = metalValue - wastageDeduction;
        
        // Update row display
        row.querySelector('.exchange-rate-per-gram').textContent = `₹${ratePerGram.toFixed(2)}`;
        row.querySelector('.exchange-value').textContent = `₹${exchangeValue.toFixed(2)}`;
        
        // Store exchange item data
        const itemIndex = Array.from(row.parentNode.children).indexOf(row);
        this.exchangeItems[itemIndex] = {
            description: row.querySelector('.exchange-description').value,
            metalType,
            purity,
            weight,
            wastageDeduction: wastage,
            ratePerGram,
            metalValue,
            exchangeValue
        };
        
        // Recalculate total exchange value
        this.calculateTotalExchangeValue();
    }
    
    // Calculate total exchange value
    calculateTotalExchangeValue() {
        this.totals.totalExchangeValue = this.exchangeItems.reduce((total, item) => {
            return total + (item?.exchangeValue || 0);
        }, 0);
        
        // Update totals
        this.updateTotals();
    }
    
    // Remove exchange item
    removeExchangeItem(button) {
        const row = button.closest('.exchange-item-row');
        const itemIndex = Array.from(row.parentNode.children).indexOf(row);
        
        // Remove from exchange items array
        this.exchangeItems.splice(itemIndex, 1);
        
        // Remove row from DOM
        row.remove();
        
        // Recalculate total exchange value
        this.calculateTotalExchangeValue();
    }
    
    // Update payment fields based on status
    updatePaymentFields() {
        const paymentStatus = document.getElementById('paymentStatus').value;
        const paidAmountGroup = document.getElementById('paidAmountGroup');
        
        if (paymentStatus === 'partial') {
            paidAmountGroup.style.display = 'block';
        } else {
            paidAmountGroup.style.display = 'none';
        }
    }
    
    // Validate form
    validateForm() {
        // Validate customer info
        const customerName = document.getElementById('customerName').value.trim();
        if (!customerName) {
            alert('Please enter customer name');
            return false;
        }
        
        // Validate items
        if (this.items.length === 0) {
            alert('Please add at least one item');
            return false;
        }
        
        // Validate each item
        for (const item of this.items) {
            if (!item || !item.description || !item.metalType || !item.purity || !item.netWeight) {
                alert('Please complete all item details');
                return false;
            }
        }
        
        // Validate exchange items if exchange bill
        if ((this.billType === 'exchange' || this.billType === 'sale_exchange') && this.exchangeItems.length === 0) {
            alert('Please add at least one exchange item');
            return false;
        }
        
        return true;
    }
    
    // Save bill
    async saveBill() {
        if (!this.validateForm()) return;
        
        // Get customer info
        this.customer = {
            name: document.getElementById('customerName').value.trim(),
            phone: document.getElementById('customerPhone').value.trim(),
            address: document.getElementById('customerAddress').value.trim()
        };
        
        // Get payment info
        this.payment = {
            method: document.getElementById('paymentMethod').value,
            status: document.getElementById('paymentStatus').value,
            paidAmount: parseFloat(document.getElementById('paidAmount').value) || 0
        };
        
        // Get notes
        const notes = document.getElementById('notes').value.trim();
        
        // Prepare bill data
        const billData = {
            billType: this.billType,
            customerName: this.customer.name,
            customerPhone: this.customer.phone,
            customerAddress: this.customer.address,
            items: this.items.filter(item => item), // Remove empty items
            exchangeItems: this.exchangeItems.filter(item => item),
            paymentMethod: this.payment.method,
            paymentStatus: this.payment.status,
            paidAmount: this.payment.paidAmount,
            notes: notes
        };
        
        // Show loading
        const saveBtn = document.getElementById('saveBill');
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveBtn.disabled = true;
        
        try {
            const response = await fetch(`${this.apiBase}/bills`, {
                method: 'POST',
                headers: authManager.getAuthHeaders(),
                body: JSON.stringify(billData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('Bill saved successfully!');
                // Reset form
                this.resetForm();
                // Generate new bill number
                await this.generateBillNumber();
            } else {
                alert('Error saving bill: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error saving bill:', error);
            alert('Error saving bill. Please try again.');
        } finally {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }
    
    // Reset form
    resetForm() {
        // Clear items
        this.items = [];
        const itemsTbody = document.querySelector('#itemsTable tbody');
        if (itemsTbody) {
            itemsTbody.innerHTML = '';
        }
        
        // Clear exchange items
        this.exchangeItems = [];
        const exchangeTbody = document.querySelector('#exchangeItemsTable tbody');
        if (exchangeTbody) {
            exchangeTbody.innerHTML = '';
        }
        
        // Clear customer info
        document.getElementById('customerName').value = '';
        document.getElementById('customerPhone').value = '';
        document.getElementById('customerAddress').value = '';
        
        // Reset payment
        document.getElementById('paymentMethod').value = 'cash';
        document.getElementById('paymentStatus').value = 'paid';
        document.getElementById('paidAmount').value = '0';
        
        // Reset notes
        document.getElementById('notes').value = '';
        
        // Reset totals
        this.totals = {
            totalMetalValue: 0,
            totalMakingCharge: 0,
            totalBeforeTax: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            totalTax: 0,
            totalAmount: 0,
            totalExchangeValue: 0,
            netPayable: 0,
            balanceType: 'payable'
        };
        
        this.updateTotalsDisplay();
        
        // Add first item row
        this.addItemRow();
    }
    
    // Print bill
    printBill() {
        // Open print preview
        window.open(`print.html?bill=${this.currentBillNumber}`, '_blank');
    }
    
    // Display items (for view mode)
    displayItems() {
        const tbody = document.querySelector('#itemsTable tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        this.items.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.description}</td>
                <td>${item.metalType}</td>
                <td>${item.purity}</td>
                <td>${item.grossWeight.toFixed(3)}</td>
                <td>${item.netWeight.toFixed(3)}</td>
                <td>${item.makingChargeType === 'percentage' ? '%' : '₹'}</td>
                <td>${item.makingChargeValue.toFixed(2)}</td>
                <td>₹${item.ratePerGram.toFixed(2)}</td>
                <td>₹${item.metalValue.toFixed(2)}</td>
                <td>₹${item.makingCharge.toFixed(2)}</td>
                <td>₹${item.total.toFixed(2)}</td>
                <td></td>
            `;
            tbody.appendChild(row);
        });
    }
    
    // Display exchange items (for view mode)
    displayExchangeItems() {
        const tbody = document.querySelector('#exchangeItemsTable tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        this.exchangeItems.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.description || ''}</td>
                <td>${item.metalType}</td>
                <td>${item.purity}</td>
                <td>${item.weight.toFixed(3)}</td>
                <td>${item.wastageDeduction}%</td>
                <td>₹${item.ratePerGram.toFixed(2)}</td>
                <td>₹${item.exchangeValue.toFixed(2)}</td>
                <td></td>
            `;
            tbody.appendChild(row);
        });
    }
}

// Initialize billing system when page loads
document.addEventListener('DOMContentLoaded', async () => {
    window.billingSystem = new BillingSystem();
    await billingSystem.initialize();
});
