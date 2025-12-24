// frontend/js/exchange.js
/**
 * Exchange System - UI handling only, calculations in backend
 * STRICTLY FOLLOWS BUSINESS RULES
 */

class ExchangeSystem {
    constructor() {
        this.apiBase = 'http://localhost:5000/api';
        this.token = window.auth.getToken();
        this.oldItems = [];
        this.newItems = [];
        this.currentOldId = 1;
        this.currentNewId = 1;
        this.metalRates = {};
        this.exchangeSummary = null;
        
        this.init();
    }

    async init() {
        try {
            this.setupEventListeners();
            this.loadCalculator();
            await this.loadMetalRates();
        } catch (error) {
            console.error('Error initializing exchange system:', error);
            this.showAlert('danger', 'Failed to initialize exchange system');
        }
    }

    setupEventListeners() {
        // Add old item button
        document.getElementById('addOldItemBtn')?.addEventListener('click', () => {
            this.addOldItem();
        });
        
        // Add new item button
        document.getElementById('addNewItemBtn')?.addEventListener('click', () => {
            this.addNewItem();
        });
        
        // Calculate exchange button
        document.getElementById('calculateExchangeBtn')?.addEventListener('click', () => {
            this.calculateExchange();
        });
        
        // Proceed to billing button
        document.getElementById('proceedToBillingBtn')?.addEventListener('click', () => {
            this.proceedToBilling();
        });
        
        // Reset button
        document.getElementById('resetExchangeBtn')?.addEventListener('click', () => {
            this.resetExchange();
        });
        
        // Custom rate inputs
        document.getElementById('customGoldRate')?.addEventListener('change', (e) => {
            this.updateRate('gold', e.target.value);
        });
        
        document.getElementById('customSilverRate')?.addEventListener('change', (e) => {
            this.updateRate('silver', e.target.value);
        });
        
        document.getElementById('customDiamondRate')?.addEventListener('change', (e) => {
            this.updateRate('diamond', e.target.value);
        });
    }

    async loadMetalRates() {
        try {
            const response = await fetch(`${this.apiBase}/rates`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            if (data.success) {
                this.metalRates = data.rates;
                this.updateCalculatorRates();
            } else {
                throw new Error(data.message || 'Failed to load rates');
            }
        } catch (error) {
            console.error('Load rates error:', error);
            this.showAlert('warning', 'Using default rates. Please set current rates.');
        }
    }

    updateCalculatorRates() {
        // Update rate dropdowns in calculator
        const goldRateSelect = document.getElementById('goldRate');
        const silverRateSelect = document.getElementById('silverRate');
        const diamondRateSelect = document.getElementById('diamondRate');
        
        if (goldRateSelect) {
            goldRateSelect.innerHTML = '<option value="">Select Gold Rate</option>';
            if (this.metalRates.Gold) {
                Object.keys(this.metalRates.Gold).forEach(purity => {
                    goldRateSelect.innerHTML += `<option value="${this.metalRates.Gold[purity]}">Gold ${purity}</option>`;
                });
            }
        }
        
        if (silverRateSelect) {
            silverRateSelect.innerHTML = '<option value="">Select Silver Rate</option>';
            if (this.metalRates.Silver) {
                Object.keys(this.metalRates.Silver).forEach(purity => {
                    silverRateSelect.innerHTML += `<option value="${this.metalRates.Silver[purity]}">Silver ${purity}</option>`;
                });
            }
        }
        
        if (diamondRateSelect) {
            diamondRateSelect.innerHTML = '<option value="">Select Diamond Rate</option>';
            if (this.metalRates.Diamond) {
                Object.keys(this.metalRates.Diamond).forEach(quality => {
                    diamondRateSelect.innerHTML += `<option value="${this.metalRates.Diamond[quality]}">Diamond ${quality}</option>`;
                });
            }
        }
    }

    loadCalculator() {
        const calculator = document.getElementById('exchangeCalculator');
        if (!calculator) return;
        
        calculator.innerHTML = `
            <div class="calculator-grid">
                <div class="form-group">
                    <label>Gold Rate (per gram)</label>
                    <select class="form-control" id="goldRate">
                        <option value="">Select Gold Rate</option>
                    </select>
                    <input type="number" class="form-control mt-2" id="customGoldRate" 
                           placeholder="Or enter custom rate" step="0.01" min="0">
                </div>
                
                <div class="form-group">
                    <label>Silver Rate (per gram)</label>
                    <select class="form-control" id="silverRate">
                        <option value="">Select Silver Rate</option>
                    </select>
                    <input type="number" class="form-control mt-2" id="customSilverRate" 
                           placeholder="Or enter custom rate" step="0.01" min="0">
                </div>
                
                <div class="form-group">
                    <label>Diamond Rate (per carat)</label>
                    <select class="form-control" id="diamondRate">
                        <option value="">Select Diamond Rate</option>
                    </select>
                    <input type="number" class="form-control mt-2" id="customDiamondRate" 
                           placeholder="Or enter custom rate" step="0.01" min="0">
                </div>
                
                <div class="calc-result">
                    <h5>Current Rates</h5>
                    <div class="result-row">
                        <span>Gold:</span>
                        <span id="currentGoldRate">₹0.00</span>
                    </div>
                    <div class="result-row">
                        <span>Silver:</span>
                        <span id="currentSilverRate">₹0.00</span>
                    </div>
                    <div class="result-row">
                        <span>Diamond:</span>
                        <span id="currentDiamondRate">₹0.00</span>
                    </div>
                    <div class="result-row total">
                        <span>Exchange Rate (Market - 3%):</span>
                        <span id="exchangeRateNote">₹0.00</span>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners to dropdowns
        ['gold', 'silver', 'diamond'].forEach(metal => {
            const select = document.getElementById(`${metal}Rate`);
            if (select) {
                select.addEventListener('change', (e) => {
                    this.updateRate(metal, e.target.value);
                });
            }
        });
    }

    updateRate(metalType, rate) {
        const rateValue = parseFloat(rate) || 0;
        
        // Update display
        const displayElement = document.getElementById(`current${metalType.charAt(0).toUpperCase() + metalType.slice(1)}Rate`);
        if (displayElement) {
            displayElement.textContent = `₹${rateValue.toFixed(2)}`;
        }
        
        // Calculate and display exchange rate (Market Rate - 3%) - BUSINESS RULE
        const exchangeRate = rateValue * 0.97;
        const exchangeRateNote = document.getElementById('exchangeRateNote');
        if (exchangeRateNote) {
            exchangeRateNote.textContent = `₹${exchangeRate.toFixed(2)}`;
        }
        
        // Store rate in system
        this[`${metalType}Rate`] = rateValue;
    }

    addOldItem() {
        const container = document.getElementById('oldItemsContainer');
        if (!container) return;
        
        const itemId = `old-${this.currentOldId++}`;
        
        const itemRow = document.createElement('div');
        itemRow.className = 'item-row old-item';
        itemRow.id = itemId;
        
        itemRow.innerHTML = `
            <input type="text" class="form-control item-description" placeholder="Item Description" 
                   onchange="window.exchangeSystem.updateOldItem('${itemId}', 'description', this.value)">
            
            <select class="form-control exchange-metal-type" 
                    onchange="window.exchangeSystem.updateOldItem('${itemId}', 'metalType', this.value)">
                <option value="">Select Metal</option>
                <option value="Gold">Gold</option>
                <option value="Silver">Silver</option>
                <option value="Diamond">Diamond</option>
                <option value="Platinum">Platinum</option>
                <option value="Antique / Polki">Antique / Polki</option>
                <option value="Others">Others</option>
            </select>
            
            <input type="text" class="form-control exchange-purity" placeholder="Purity" 
                   onchange="window.exchangeSystem.updateOldItem('${itemId}', 'purity', this.value)">
            
            <input type="number" class="form-control weight" placeholder="Weight" step="0.001" min="0"
                   onchange="window.exchangeSystem.updateOldItem('${itemId}', 'weight', this.value)">
            
            <input type="number" class="form-control wastage" placeholder="Wastage %" step="0.01" min="0" max="100" value="2"
                   onchange="window.exchangeSystem.updateOldItem('${itemId}', 'wastage', this.value)">
            
            <input type="number" class="form-control melting" placeholder="Melting Charges" step="0.01" min="0"
                   onchange="window.exchangeSystem.updateOldItem('${itemId}', 'melting', this.value)">
            
            <button class="btn btn-danger btn-sm" onclick="window.exchangeSystem.removeOldItem('${itemId}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(itemRow);
        
        // Initialize old item object
        this.oldItems.push({
            id: itemId,
            description: '',
            metalType: '',
            purity: '',
            weight: 0,
            wastage: 2,
            melting: 0,
            value: 0
        });
        
        this.updateResponsiveLayout();
    }

    addNewItem() {
        const container = document.getElementById('newItemsContainer');
        if (!container) return;
        
        const itemId = `new-${this.currentNewId++}`;
        
        const itemRow = document.createElement('div');
        itemRow.className = 'item-row new-item';
        itemRow.id = itemId;
        
        itemRow.innerHTML = `
            <input type="text" class="form-control item-description" placeholder="Item Description" 
                   onchange="window.exchangeSystem.updateNewItem('${itemId}', 'description', this.value)">
            
            <select class="form-control exchange-metal-type" 
                    onchange="window.exchangeSystem.updateNewItem('${itemId}', 'metalType', this.value)">
                <option value="">Select Metal</option>
                <option value="Gold">Gold</option>
                <option value="Silver">Silver</option>
                <option value="Diamond">Diamond</option>
                <option value="Platinum">Platinum</option>
                <option value="Antique / Polki">Antique / Polki</option>
                <option value="Others">Others</option>
            </select>
            
            <input type="text" class="form-control exchange-purity" placeholder="Purity" 
                   onchange="window.exchangeSystem.updateNewItem('${itemId}', 'purity', this.value)">
            
            <input type="number" class="form-control weight" placeholder="Weight" step="0.001" min="0"
                   onchange="window.exchangeSystem.updateNewItem('${itemId}', 'weight', this.value)">
            
            <input type="number" class="form-control making-charges" placeholder="Making Charges" step="0.01" min="0"
                   onchange="window.exchangeSystem.updateNewItem('${itemId}', 'makingCharges', this.value)">
            
            <select class="form-control making-charges-type" 
                    onchange="window.exchangeSystem.updateNewItem('${itemId}', 'makingType', this.value)">
                <option value="percentage">%</option>
                <option value="fixed">Fixed</option>
                <option value="perGram">Per Gram</option>
            </select>
            
            <button class="btn btn-danger btn-sm" onclick="window.exchangeSystem.removeNewItem('${itemId}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(itemRow);
        
        // Initialize new item object
        this.newItems.push({
            id: itemId,
            description: '',
            metalType: '',
            purity: '',
            weight: 0,
            makingCharges: 0,
            makingType: 'percentage',
            value: 0
        });
        
        this.updateResponsiveLayout();
    }

    updateOldItem(itemId, field, value) {
        const itemIndex = this.oldItems.findIndex(item => item.id === itemId);
        if (itemIndex !== -1) {
            // Convert numeric fields
            if (['weight', 'wastage', 'melting'].includes(field)) {
                this.oldItems[itemIndex][field] = parseFloat(value) || 0;
            } else {
                this.oldItems[itemIndex][field] = value;
            }
        }
    }

    updateNewItem(itemId, field, value) {
        const itemIndex = this.newItems.findIndex(item => item.id === itemId);
        if (itemIndex !== -1) {
            // Convert numeric fields
            if (['weight', 'makingCharges'].includes(field)) {
                this.newItems[itemIndex][field] = parseFloat(value) || 0;
            } else {
                this.newItems[itemIndex][field] = value;
            }
        }
    }

    removeOldItem(itemId) {
        this.oldItems = this.oldItems.filter(item => item.id !== itemId);
        const element = document.getElementById(itemId);
        if (element) element.remove();
    }

    removeNewItem(itemId) {
        this.newItems = this.newItems.filter(item => item.id !== itemId);
        const element = document.getElementById(itemId);
        if (element) element.remove();
    }

    updateResponsiveLayout() {
        const oldItemRows = document.querySelectorAll('.old-item');
        const newItemRows = document.querySelectorAll('.new-item');
        const screenWidth = window.innerWidth;
        
        // Update old items layout
        oldItemRows.forEach(row => {
            if (screenWidth < 768) {
                row.style.gridTemplateColumns = '1fr';
            } else if (screenWidth < 1200) {
                row.style.gridTemplateColumns = 'repeat(4, 1fr)';
            } else {
                row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr 1fr 1fr auto';
            }
        });
        
        // Update new items layout
        newItemRows.forEach(row => {
            if (screenWidth < 768) {
                row.style.gridTemplateColumns = '1fr';
            } else if (screenWidth < 1200) {
                row.style.gridTemplateColumns = 'repeat(4, 1fr)';
            } else {
                row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr 1fr 1fr auto';
            }
        });
    }

    validateExchange() {
        // Validate rates are available
        if (!this.goldRate && !this.silverRate && !this.diamondRate) {
            this.showAlert('danger', 'Please set at least one metal rate');
            return false;
        }
        
        // Validate old items
        if (this.oldItems.length === 0) {
            this.showAlert('warning', 'Add at least one old item for exchange');
            return false;
        }
        
        // Validate new items
        if (this.newItems.length === 0) {
            this.showAlert('warning', 'Add at least one new item');
            return false;
        }
        
        // Validate all old items have required fields
        for (let i = 0; i < this.oldItems.length; i++) {
            const item = this.oldItems[i];
            
            if (!item.metalType || !item.purity) {
                this.showAlert('danger', `Old Item ${i + 1}: Metal type and purity are required`);
                return false;
            }
            
            if (!item.weight || item.weight <= 0) {
                this.showAlert('danger', `Old Item ${i + 1}: Weight must be greater than 0`);
                return false;
            }
        }
        
        // Validate all new items have required fields
        for (let i = 0; i < this.newItems.length; i++) {
            const item = this.newItems[i];
            
            if (!item.metalType || !item.purity) {
                this.showAlert('danger', `New Item ${i + 1}: Metal type and purity are required`);
                return false;
            }
            
            if (!item.weight || item.weight <= 0) {
                this.showAlert('danger', `New Item ${i + 1}: Weight must be greater than 0`);
                return false;
            }
        }
        
        return true;
    }

    async calculateExchange() {
        if (!this.validateExchange()) {
            return;
        }
        
        const btn = document.getElementById('calculateExchangeBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner"></span> Calculating...';
        btn.disabled = true;
        
        try {
            // Prepare data for backend calculation
            const exchangeData = {
                oldItems: this.oldItems,
                newItems: this.newItems,
                rates: {
                    gold: this.goldRate || 0,
                    silver: this.silverRate || 0,
                    diamond: this.diamondRate || 0
                }
            };
            
            // Send to backend for calculation (BUSINESS RULE: Calculation in backend)
            const response = await fetch(`${this.apiBase}/exchange/calculate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(exchangeData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Update UI with calculated values
                this.updateExchangeSummary(data.summary);
                
                // Enable proceed button
                document.getElementById('proceedToBillingBtn').disabled = false;
                
                // Store summary for billing
                this.exchangeSummary = data.summary;
                
                this.showAlert('success', 'Exchange calculated successfully');
            } else {
                throw new Error(data.message || 'Failed to calculate exchange');
            }
        } catch (error) {
            console.error('Calculate exchange error:', error);
            this.showAlert('danger', error.message || 'Failed to calculate exchange');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    getMetalRate(metalType) {
        switch(metalType) {
            case 'Gold': return this.goldRate || 0;
            case 'Silver': return this.silverRate || 0;
            case 'Diamond': return this.diamondRate || 0;
            default: return 0;
        }
    }

    updateExchangeSummary(summary) {
        if (!summary) return;
        
        // Update summary cards
        document.getElementById('oldItemsTotal').textContent = `₹${summary.oldItemsTotal.toFixed(2)}`;
        document.getElementById('newItemsTotal').textContent = `₹${summary.newItemsTotal.toFixed(2)}`;
        
        // Calculate balance
        let balancePayable = 0;
        let balanceRefundable = 0;
        
        if (summary.newItemsTotal > summary.oldItemsTotal) {
            balancePayable = summary.newItemsTotal - summary.oldItemsTotal;
            document.getElementById('balancePayable').textContent = `₹${balancePayable.toFixed(2)}`;
            document.getElementById('balanceRefundable').textContent = '₹0.00';
        } else {
            balanceRefundable = summary.oldItemsTotal - summary.newItemsTotal;
            document.getElementById('balancePayable').textContent = '₹0.00';
            document.getElementById('balanceRefundable').textContent = `₹${balanceRefundable.toFixed(2)}`;
        }
        
        // Update exchange summary display
        const exchangeSummary = document.getElementById('exchangeSummary');
        if (exchangeSummary) {
            exchangeSummary.style.display = 'block';
            document.getElementById('balancePay').textContent = `₹${balancePayable.toFixed(2)}`;
            document.getElementById('balanceRefund').textContent = `₹${balanceRefundable.toFixed(2)}`;
        }
    }

    proceedToBilling() {
        if (!this.exchangeSummary) {
            this.showAlert('warning', 'Please calculate exchange first');
            return;
        }
        
        // Prepare exchange data for billing page
        const exchangeData = {
            oldItems: this.oldItems.map(item => ({
                description: item.description,
                metalType: item.metalType,
                purity: item.purity,
                weight: item.weight,
                wastage: item.wastage,
                meltingCharges: item.melting
            })),
            newItems: this.newItems.map(item => ({
                description: item.description,
                metalType: item.metalType,
                purity: item.purity,
                weight: item.weight,
                makingCharges: item.makingCharges,
                makingType: item.makingType
            })),
            summary: this.exchangeSummary,
            rates: {
                gold: this.goldRate,
                silver: this.silverRate,
                diamond: this.diamondRate
            }
        };
        
        // Store exchange data in localStorage for billing page
        localStorage.setItem('exchangeData', JSON.stringify(exchangeData));
        localStorage.setItem('exchangeTimestamp', Date.now());
        
        // Redirect to billing page
        window.location.href = 'billing.html?exchange=true';
    }

    resetExchange() {
        if (!confirm('Are you sure you want to reset the exchange? All data will be lost.')) {
            return;
        }
        
        this.oldItems = [];
        this.newItems = [];
        this.currentOldId = 1;
        this.currentNewId = 1;
        this.exchangeSummary = null;
        
        // Clear containers
        const oldContainer = document.getElementById('oldItemsContainer');
        const newContainer = document.getElementById('newItemsContainer');
        
        if (oldContainer) oldContainer.innerHTML = '';
        if (newContainer) newContainer.innerHTML = '';
        
        // Reset summary display
        document.getElementById('oldItemsTotal').textContent = '₹0.00';
        document.getElementById('newItemsTotal').textContent = '₹0.00';
        document.getElementById('balancePayable').textContent = '₹0.00';
        document.getElementById('balanceRefundable').textContent = '₹0.00';
        
        // Hide exchange summary
        const exchangeSummary = document.getElementById('exchangeSummary');
        if (exchangeSummary) exchangeSummary.style.display = 'none';
        
        // Disable proceed button
        document.getElementById('proceedToBillingBtn').disabled = true;
        
        // Reset rate inputs
        ['gold', 'silver', 'diamond'].forEach(metal => {
            const select = document.getElementById(`${metal}Rate`);
            const input = document.getElementById(`custom${metal.charAt(0).toUpperCase() + metal.slice(1)}Rate`);
            const display = document.getElementById(`current${metal.charAt(0).toUpperCase() + metal.slice(1)}Rate`);
            
            if (select) select.value = '';
            if (input) input.value = '';
            if (display) display.textContent = '₹0.00';
            
            this[`${metal}Rate`] = 0;
        });
        
        // Reset exchange rate note
        const exchangeRateNote = document.getElementById('exchangeRateNote');
        if (exchangeRateNote) exchangeRateNote.textContent = '₹0.00';
        
        this.showAlert('info', 'Exchange data reset successfully');
    }

    showAlert(type, message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="close" onclick="this.parentElement.remove()">&times;</button>
        `;
        
        const container = document.getElementById('alertContainer');
        if (container) {
            container.appendChild(alertDiv);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (alertDiv.parentElement) {
                    alertDiv.remove();
                }
            }, 5000);
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (window.auth && window.auth.isAuthenticated && window.auth.isAuthenticated()) {
        if (window.auth.isStaff && window.auth.isStaff()) {
            window.exchangeSystem = new ExchangeSystem();
        } else {
            window.location.href = 'index.html';
            alert('Access denied. Staff privileges required.');
        }
    } else {
        window.location.href = 'login.html';
    }
});

// Make functions globally accessible
window.updateOldItem = (itemId, field, value) => {
    if (window.exchangeSystem) {
        window.exchangeSystem.updateOldItem(itemId, field, value);
    }
};

window.updateNewItem = (itemId, field, value) => {
    if (window.exchangeSystem) {
        window.exchangeSystem.updateNewItem(itemId, field, value);
    }
};

window.removeOldItem = (itemId) => {
    if (window.exchangeSystem) {
        window.exchangeSystem.removeOldItem(itemId);
    }
};

window.removeNewItem = (itemId) => {
    if (window.exchangeSystem) {
        window.exchangeSystem.removeNewItem(itemId);
    }
};

window.updateRate = (metalType, rate) => {
    if (window.exchangeSystem) {
        window.exchangeSystem.updateRate(metalType, rate);
    }
};
