// Exchange System JavaScript
class ExchangeSystem {
    constructor() {
        this.exchangeItems = [];
        this.newItems = [];
        this.currentRates = null;
        this.customer = {
            name: '',
            phone: '',
            address: ''
        };
        this.totals = {
            oldItemsValue: 0,
            newItemsValue: 0,
            netPayable: 0,
            balanceType: 'payable' // payable or refundable
        };
        
        this.apiBase = window.location.origin.includes('localhost') 
            ? 'http://localhost:5000/api' 
            : '/api';
    }
    
    // Initialize exchange system
    async initialize() {
        if (!authManager.checkAuth()) return false;
        
        // Load current rates
        await this.loadRates();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Add first exchange item row
        this.addExchangeItemRow();
        
        // Add first new item row
        this.addNewItemRow();
        
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
    
    // Display rates
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
    
    // Setup event listeners
    setupEventListeners() {
        // Add exchange item button
        const addExchangeBtn = document.getElementById('addExchangeItem');
        if (addExchangeBtn) {
            addExchangeBtn.addEventListener('click', () => this.addExchangeItemRow());
        }
        
        // Add new item button
        const addNewItemBtn = document.getElementById('addNewItem');
        if (addNewItemBtn) {
            addNewItemBtn.addEventListener('click', () => this.addNewItemRow());
        }
        
        // Calculate button
        const calculateBtn = document.getElementById('calculateExchange');
        if (calculateBtn) {
            calculateBtn.addEventListener('click', () => this.updateTotals());
        }
        
        // Save exchange button
        const saveBtn = document.getElementById('saveExchange');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveExchange());
        }
        
        // Print button
        const printBtn = document.getElementById('printExchange');
        if (printBtn) {
            printBtn.addEventListener('click', () => this.printExchange());
        }
        
        // Metal type change listeners will be added in row creation
    }
    
    // Add exchange item row (old item)
    addExchangeItemRow() {
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
                <input type="number" class="form-control exchange-wastage" step="0.01" placeholder="0" value="2" min="0" max="100">
                <small class="text-muted">%</small>
            </td>
            <td class="exchange-rate-per-gram">₹0.00</td>
            <td class="exchange-item-value">₹0.00</td>
            <td>
                <button type="button" class="btn-danger btn-sm" onclick="exchangeSystem.removeExchangeItemRow(this)">
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
        metalTypeSelect.addEventListener('change', () => this.updateExchangePurityOptions(row));
        
        const inputs = row.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('change', () => this.calculateExchangeItem(row));
            input.addEventListener('input', () => this.calculateExchangeItem(row));
        });
        
        // Trigger initial purity options update
        this.updateExchangePurityOptions(row);
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
        row.querySelector('.exchange-item-value').textContent = `₹${exchangeValue.toFixed(2)}`;
        
        // Store item data
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
        
        // Update totals
        this.updateTotals();
    }
    
    // Remove exchange item row
    removeExchangeItemRow(button) {
        const row = button.closest('.exchange-item-row');
        const itemIndex = Array.from(row.parentNode.children).indexOf(row);
        
        // Remove from array
        this.exchangeItems.splice(itemIndex, 1);
        
        // Remove row from DOM
        row.remove();
        
        // Update totals
        this.updateTotals();
    }
    
    // Add new item row
    addNewItemRow() {
        const tbody = document.querySelector('#newItemsTable tbody');
        if (!tbody) return;
        
        const row = document.createElement('tr');
        row.className = 'new-item-row';
        row.innerHTML = `
            <td>
                <input type="text" class="form-control new-item-description" placeholder="Item description" required>
            </td>
            <td>
                <select class="form-control new-item-metal-type" required>
                    <option value="">Select</option>
                    <option value="gold">Gold</option>
                    <option value="silver">Silver</option>
                </select>
            </td>
            <td>
                <select class="form-control new-item-purity" required>
                    <option value="">Select Purity</option>
                </select>
            </td>
            <td>
                <input type="number" class="form-control new-item-gross-weight" step="0.001" placeholder="0.000" required>
            </td>
            <td>
                <input type="number" class="form-control new-item-net-weight" step="0.001" placeholder="0.000" required>
            </td>
            <td>
                <select class="form-control new-item-making-type">
                    <option value="percentage">%</option>
                    <option value="fixed">₹</option>
                </select>
            </td>
            <td>
                <input type="number" class="form-control new-item-making-value" step="0.01" placeholder="0.00" required>
            </td>
            <td class="new-item-rate-per-gram">₹0.00</td>
            <td class="new-item-metal-value">₹0.00</td>
            <td class="new-item-making-charge">₹0.00</td>
            <td class="new-item-total">₹0.00</td>
            <td>
                <button type="button" class="btn-danger btn-sm" onclick="exchangeSystem.removeNewItemRow(this)">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
        
        // Set up event listeners
        this.setupNewItemRowListeners(row);
    }
    
    // Setup event listeners for new item row
    setupNewItemRowListeners(row) {
        const metalTypeSelect = row.querySelector('.new-item-metal-type');
        metalTypeSelect.addEventListener('change', () => this.updateNewItemPurityOptions(row));
        
        const inputs = row.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('change', () => this.calculateNewItem(row));
            input.addEventListener('input', () => this.calculateNewItem(row));
        });
        
        // Trigger initial purity options update
        this.updateNewItemPurityOptions(row);
    }
    
    // Update purity options for new item
