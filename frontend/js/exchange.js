// Exchange System Module

class ExchangeSystem {
    constructor() {
        this.apiBase = 'http://localhost:5000/api';
        this.token = window.auth.getToken();
        this.rates = {};
        this.exchangeCalculator = new ExchangeCalculator();
        this.init();
    }

    async init() {
        await this.loadRates();
        this.setupEventListeners();
        this.setupExchangeCalculator();
    }

    async loadRates() {
        try {
            const response = await fetch(`${this.apiBase}/rates`);
            const data = await response.json();
            
            if (data.success) {
                this.rates = data.rates.reduce((acc, rate) => {
                    acc[rate.metalType] = rate;
                    return acc;
                }, {});
                
                this.populateMetalDropdowns();
            }
        } catch (error) {
            console.error('Error loading rates:', error);
            showAlert('danger', 'Failed to load rates');
        }
    }

    populateMetalDropdowns() {
        const selects = document.querySelectorAll('.exchange-metal-type');
        selects.forEach(select => {
            select.innerHTML = Object.keys(this.rates)
                .map(metal => `<option value="${metal}">${metal}</option>`)
                .join('');
        });
    }

    setupEventListeners() {
        // Old item form
        document.getElementById('addOldItemBtn').addEventListener('click', () => {
            this.addOldItemRow();
        });

        // New item form
        document.getElementById('addNewItemBtn').addEventListener('click', () => {
            this.addNewItemRow();
        });

        // Calculate exchange button
        document.getElementById('calculateExchangeBtn').addEventListener('click', () => {
            this.calculateExchange();
        });

        // Proceed to billing button
        document.getElementById('proceedToBillingBtn').addEventListener('click', () => {
            this.proceedToBilling();
        });

        // Reset form button
        document.getElementById('resetExchangeBtn').addEventListener('click', () => {
            this.resetExchange();
        });

        // Metal type change handlers
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('exchange-metal-type')) {
                const rowId = e.target.closest('.item-row').id;
                this.updatePurities(e.target.value, rowId);
            }
        });
    }

    setupExchangeCalculator() {
        // Initialize exchange calculator UI
        const calculator = document.getElementById('exchangeCalculator');
        if (calculator) {
            calculator.innerHTML = `
                <div class="calculator-grid">
                    <div class="calculator-section">
                        <h4>Old Item Value</h4>
                        <div class="calc-form">
                            <div class="form-group">
                                <label>Metal Type</label>
                                <select class="form-control calc-metal" id="calcOldMetal">
                                    ${Object.keys(this.rates).map(metal => 
                                        `<option value="${metal}">${metal}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Purity</label>
                                <select class="form-control calc-purity" id="calcOldPurity"></select>
                            </div>
                            <div class="form-group">
                                <label>Weight (g/carat)</label>
                                <input type="number" class="form-control" id="calcOldWeight" step="0.001" min="0">
                            </div>
                            <div class="form-group">
                                <label>Wastage Deduction (%)</label>
                                <input type="number" class="form-control" id="calcWastage" step="0.1" min="0" max="100" value="2">
                            </div>
                            <div class="form-group">
                                <label>Melting Charges (₹)</label>
                                <input type="number" class="form-control" id="calcMelting" step="0.01" min="0" value="0">
                            </div>
                            <button class="btn btn-primary" onclick="exchangeSystem.calculateItemValue()">
                                Calculate Value
                            </button>
                        </div>
                    </div>
                    
                    <div class="calculator-section">
                        <h4>Calculation Result</h4>
                        <div class="calc-result">
                            <div class="result-row">
                                <span>Metal Value:</span>
                                <span id="calcMetalValue">₹0.00</span>
                            </div>
                            <div class="result-row">
                                <span>After Wastage:</span>
                                <span id="calcAfterWastage">₹0.00</span>
                            </div>
                            <div class="result-row">
                                <span>After Melting:</span>
                                <span id="calcAfterMelting">₹0.00</span>
                            </div>
                            <div class="result-row total">
                                <span>Net Value:</span>
                                <span id="calcNetValue">₹0.00</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Initialize purity dropdown
            const metalSelect = document.getElementById('calcOldMetal');
            this.updateCalculatorPurities(metalSelect.value);
        }
    }

    updatePurities(metalType, rowId) {
        const rate = this.rates[metalType];
        if (!rate) return;
        
        const puritySelect = document.querySelector(`#${rowId} .exchange-purity`);
        puritySelect.innerHTML = rate.purityLevels
            .map(purity => `<option value="${purity}">${purity}</option>`)
            .join('');
    }

    updateCalculatorPurities(metalType) {
        const rate = this.rates[metalType];
        if (!rate) return;
        
        const puritySelect = document.getElementById('calcOldPurity');
        puritySelect.innerHTML = rate.purityLevels
            .map(purity => `<option value="${purity}">${purity}</option>`)
            .join('');
    }

    addOldItemRow() {
        const container = document.getElementById('oldItemsContainer');
        const itemId = `old-item-${Date.now()}`;
        
        const row = document.createElement('div');
        row.className = 'item-row old-item';
        row.id = itemId;
        
        row.innerHTML = `
            <input type="text" class="form-control item-description" placeholder="Item Description">
            
            <select class="form-control exchange-metal-type">
                <option value="">Select Metal</option>
                ${Object.keys(this.rates).map(metal => 
                    `<option value="${metal}">${metal}</option>`
                ).join('')}
            </select>
            
            <select class="form-control exchange-purity">
                <option value="">Select Purity</option>
            </select>
            
            <input type="number" class="form-control weight" step="0.001" placeholder="Weight" min="0">
            
            <input type="number" class="form-control wastage" step="0.1" placeholder="Wastage %" min="0" max="100" value="2">
            
            <input type="number" class="form-control melting" step="0.01" placeholder="Melting Charges" min="0">
            
            <button class="btn btn-danger btn-sm" onclick="this.closest('.item-row').remove(); exchangeSystem.updateExchangeSummary()">
                ×
            </button>
        `;
        
        container.appendChild(row);
    }

    addNewItemRow() {
        const container = document.getElementById('newItemsContainer');
        const itemId = `new-item-${Date.now()}`;
        
        const row = document.createElement('div');
        row.className = 'item-row new-item';
        row.id = itemId;
        
        row.innerHTML = `
            <input type="text" class="form-control item-description" placeholder="New Item Description">
            
            <select class="form-control exchange-metal-type">
                <option value="">Select Metal</option>
                ${Object.keys(this.rates).map(metal => 
                    `<option value="${metal}">${metal}</option>`
                ).join('')}
            </select>
            
            <select class="form-control exchange-purity">
                <option value="">Select Purity</option>
            </select>
            
            <input type="number" class="form-control weight" step="0.001" placeholder="Weight" min="0">
            
            <input type="number" class="form-control making-charges" step="0.01" placeholder="Making Charges" min="0">
            
            <select class="form-control making-charges-type">
                <option value="percentage">%</option>
                <option value="fixed">₹</option>
            </select>
            
            <button class="btn btn-danger btn-sm" onclick="this.closest('.item-row').remove(); exchangeSystem.updateExchangeSummary()">
                ×
            </button>
        `;
        
        container.appendChild(row);
    }

    async calculateItemValue() {
        const metalType = document.getElementById('calcOldMetal').value;
        const purity = document.getElementById('calcOldPurity').value;
        const weight = parseFloat(document.getElementById('calcOldWeight').value) || 0;
        const wastage = parseFloat(document.getElementById('calcWastage').value) || 0;
        const melting = parseFloat(document.getElementById('calcMelting').value) || 0;

        if (!metalType || !purity || weight <= 0) {
            showAlert('warning', 'Please fill all required fields');
            return;
        }

        const rate = this.rates[metalType];
        if (!rate) {
            showAlert('danger', 'Rate not found for selected metal');
            return;
        }

        // Calculate metal value
        let metalValue = 0;
        if (rate.unit === 'kg') {
            metalValue = (rate.rate / 1000) * weight;
        } else if (rate.unit === 'carat') {
            metalValue = rate.rate * weight;
        }

        // Apply purity adjustment for gold
        if (metalType === 'Gold') {
            if (purity === '22K') metalValue = metalValue * 0.9167;
            else if (purity === '18K') metalValue = metalValue * 0.75;
            else if (purity === '14K') metalValue = metalValue * 0.5833;
        }

        // Apply wastage deduction
        const afterWastage = metalValue * ((100 - wastage) / 100);
        
        // Apply melting charges
        const netValue = Math.max(0, afterWastage - melting);

        // Update display
        document.getElementById('calcMetalValue').textContent = `₹${metalValue.toFixed(2)}`;
        document.getElementById('calcAfterWastage').textContent = `₹${afterWastage.toFixed(2)}`;
        document.getElementById('calcAfterMelting').textContent = `₹${netValue.toFixed(2)}`;
        document.getElementById('calcNetValue').textContent = `₹${netValue.toFixed(2)}`;

        // Add to old items
        this.addToOldItems(metalType, purity, weight, wastage, melting, netValue);
    }

    addToOldItems(metalType, purity, weight, wastage, melting, netValue) {
        const container = document.getElementById('oldItemsContainer');
        const itemId = `calc-item-${Date.now()}`;
        
        const row = document.createElement('div');
        row.className = 'item-row old-item';
        row.id = itemId;
        
        row.innerHTML = `
            <input type="text" class="form-control item-description" value="Calculated ${metalType} Item" readonly>
            
            <select class="form-control exchange-metal-type" disabled>
                <option value="${metalType}" selected>${metalType}</option>
            </select>
            
            <select class="form-control exchange-purity" disabled>
                <option value="${purity}" selected>${purity}</option>
            </select>
            
            <input type="number" class="form-control weight" value="${weight}" readonly>
            
            <input type="number" class="form-control wastage" value="${wastage}" readonly>
            
            <input type="number" class="form-control melting" value="${melting}" readonly>
            
            <div class="item-value">₹${netValue.toFixed(2)}</div>
            
            <button class="btn btn-danger btn-sm" onclick="this.closest('.item-row').remove(); exchangeSystem.updateExchangeSummary()">
                ×
            </button>
        `;
        
        container.appendChild(row);
        this.updateExchangeSummary();
    }

    updateExchangeSummary() {
        // Calculate old items total
        const oldItems = document.querySelectorAll('.old-item');
        let oldItemsTotal = 0;
        
        oldItems.forEach(item => {
            const valueElement = item.querySelector('.item-value');
            if (valueElement) {
                const value = parseFloat(valueElement.textContent.replace('₹', '')) || 0;
                oldItemsTotal += value;
            } else {
                // For manually entered items, calculate value
                const metalType = item.querySelector('.exchange-metal-type').value;
                const purity = item.querySelector('.exchange-purity').value;
                const weight = parseFloat(item.querySelector('.weight').value) || 0;
                const wastage = parseFloat(item.querySelector('.wastage').value) || 0;
                const melting = parseFloat(item.querySelector('.melting').value) || 0;
                
                if (metalType && purity && weight > 0) {
                    const rate = this.rates[metalType];
                    if (rate) {
                        let value = 0;
                        if (rate.unit === 'kg') {
                            value = (rate.rate / 1000) * weight;
                        } else if (rate.unit === 'carat') {
                            value = rate.rate * weight;
                        }
                        
                        // Apply purity adjustment
                        if (metalType === 'Gold') {
                            if (purity === '22K') value = value * 0.9167;
                            else if (purity === '18K') value = value * 0.75;
                            else if (purity === '14K') value = value * 0.5833;
                        }
                        
                        // Apply wastage and melting
                        value = value * ((100 - wastage) / 100);
                        value = Math.max(0, value - melting);
                        
                        oldItemsTotal += value;
                    }
                }
            }
        });
        
        // Calculate new items total
        const newItems = document.querySelectorAll('.new-item');
        let newItemsTotal = 0;
        
        newItems.forEach(item => {
            const metalType = item.querySelector('.exchange-metal-type').value;
            const weight = parseFloat(item.querySelector('.weight').value) || 0;
            const makingCharges = parseFloat(item.querySelector('.making-charges').value) || 0;
            const makingType = item.querySelector('.making-charges-type').value;
            
            if (metalType && weight > 0) {
                const rate = this.rates[metalType];
                if (rate) {
                    let itemValue = 0;
                    if (rate.unit === 'kg') {
                        itemValue = (rate.rate / 1000) * weight;
                    } else if (rate.unit === 'carat') {
                        itemValue = rate.rate * weight;
                    }
                    
                    // Apply making charges
                    let makingAmount = 0;
                    if (makingType === 'percentage') {
                        makingAmount = (itemValue * makingCharges) / 100;
                    } else {
                        makingAmount = makingCharges;
                    }
                    
                    newItemsTotal += itemValue + makingAmount;
                }
            }
        });
        
        // Calculate balance
        const balance = oldItemsTotal - newItemsTotal;
        
        // Update summary display
        document.getElementById('oldItemsTotal').textContent = `₹${oldItemsTotal.toFixed(2)}`;
        document.getElementById('newItemsTotal').textContent = `₹${newItemsTotal.toFixed(2)}`;
        
        if (balance >= 0) {
            document.getElementById('balanceRefundable').textContent = `₹${balance.toFixed(2)}`;
            document.getElementById('balancePayable').textContent = '₹0.00';
        } else {
            document.getElementById('balancePayable').textContent = `₹${Math.abs(balance).toFixed(2)}`;
            document.getElementById('balanceRefundable').textContent = '₹0.00';
        }
        
        // Enable/disable proceed button
        const proceedBtn = document.getElementById('proceedToBillingBtn');
        proceedBtn.disabled = oldItemsTotal <= 0 || newItemsTotal <= 0;
    }

    calculateExchange() {
        this.updateExchangeSummary();
        showAlert('success', 'Exchange calculated successfully');
    }

    proceedToBilling() {
        // Collect old items data
        const oldItems = [];
        document.querySelectorAll('.old-item').forEach(item => {
            const description = item.querySelector('.item-description').value;
            const metalType = item.querySelector('.exchange-metal-type').value;
            const purity = item.querySelector('.exchange-purity').value;
            const weight = parseFloat(item.querySelector('.weight').value) || 0;
            const wastage = parseFloat(item.querySelector('.wastage').value) || 0;
            const melting = parseFloat(item.querySelector('.melting').value) || 0;
            
            if (metalType && purity && weight > 0) {
                oldItems.push({
                    description: description || 'Old Item',
                    metalType,
                    purity,
                    weight,
                    wastageDeduction: wastage,
                    meltingCharges: melting
                });
            }
        });
        
        // Collect new items data
        const newItems = [];
        document.querySelectorAll('.new-item').forEach(item => {
            const description = item.querySelector('.item-description').value;
            const metalType = item.querySelector('.exchange-metal-type').value;
            const purity = item.querySelector('.exchange-purity').value;
            const weight = parseFloat(item.querySelector('.weight').value) || 0;
            const makingCharges = parseFloat(item.querySelector('.making-charges').value) || 0;
            const makingType = item.querySelector('.making-charges-type').value;
            
            if (metalType && purity && weight > 0) {
                newItems.push({
                    description: description || 'New Item',
                    metalType,
                    purity,
                    weight,
                    makingCharges,
                    makingChargesType: makingType
                });
            }
        });
        
        if (oldItems.length === 0 || newItems.length === 0) {
            showAlert('warning', 'Please add at least one old item and one new item');
            return;
        }
        
        // Store data for billing page
        localStorage.setItem('exchangeData', JSON.stringify({
            oldItems,
            newItems,
            timestamp: Date.now()
        }));
        
        // Redirect to billing page
        window.location.href = 'billing.html?exchange=true';
    }

    resetExchange() {
        if (confirm('Are you sure you want to reset the exchange form?')) {
            document.getElementById('oldItemsContainer').innerHTML = '';
            document.getElementById('newItemsContainer').innerHTML = '';
            
            // Reset calculator
            document.getElementById('calcOldWeight').value = '';
            document.getElementById('calcMetalValue').textContent = '₹0.00';
            document.getElementById('calcAfterWastage').textContent = '₹0.00';
            document.getElementById('calcAfterMelting').textContent = '₹0.00';
            document.getElementById('calcNetValue').textContent = '₹0.00';
            
            // Reset summary
            document.getElementById('oldItemsTotal').textContent = '₹0.00';
            document.getElementById('newItemsTotal').textContent = '₹0.00';
            document.getElementById('balanceRefundable').textContent = '₹0.00';
            document.getElementById('balancePayable').textContent = '₹0.00';
            
            // Disable proceed button
            document.getElementById('proceedToBillingBtn').disabled = true;
            
            showAlert('info', 'Exchange form reset successfully');
        }
    }
}

class ExchangeCalculator {
    constructor() {
        this.apiBase = 'http://localhost:5000/api';
    }
    
    async calculateNetValue(itemData) {
        try {
            const response = await fetch(`${this.apiBase}/rates/calculate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.auth.getToken()}`
                },
                body: JSON.stringify(itemData)
            });
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Calculate error:', error);
            return null;
        }
    }
}

// Initialize exchange system
document.addEventListener('DOMContentLoaded', () => {
    if (window.auth.isAuthenticated() && window.auth.isStaff()) {
        window.exchangeSystem = new ExchangeSystem();
    } else {
        window.location.href = 'login.html';
    }
});
