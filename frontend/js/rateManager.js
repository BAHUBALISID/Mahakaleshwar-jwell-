class RateManager {
    constructor() {
        this.apiBase = 'http://localhost:5000/api';
        this.token = window.auth.getToken();
        this.init();
    }

    async init() {
        await this.loadRates();
        this.setupEventListeners();
    }

    async loadRates() {
        try {
            const response = await fetch(`${this.apiBase}/rates`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                if (data.rates.length === 0) {
                    this.showEmptyState();
                } else {
                    this.displayRates(data.rates);
                }
            } else {
                this.showEmptyState();
            }
        } catch (error) {
            console.error('Error loading rates:', error);
            this.showEmptyState();
        }
    }

    showEmptyState() {
        const container = document.getElementById('ratesTableBody');
        if (container) {
            container.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-danger">
                        <i class="fas fa-exclamation-triangle"></i>
                        No rates set yet. Default rates will be used for billing.
                        <br>
                        <small>Admin must set purity-wise rates below.</small>
                    </td>
                </tr>
            `;
        }
    }

    displayRates(rates) {
        const container = document.getElementById('ratesTableBody');
        if (!container) return;
        
        // Group by metal type
        const groupedRates = rates.reduce((acc, rate) => {
            if (!acc[rate.metalType]) acc[rate.metalType] = [];
            acc[rate.metalType].push(rate);
            return acc;
        }, {});
        
        let html = '';
        
        Object.entries(groupedRates).forEach(([metalType, metalRates]) => {
            metalRates.forEach((rate, index) => {
                const perGram = rate.unit === 'kg' ? rate.rate / 1000 : rate.rate;
                const perCarat = rate.unit === 'carat' ? rate.rate : 'N/A';
                
                html += `
                    <tr>
                        <td>${metalType}</td>
                        <td>${rate.purity}</td>
                        <td>
                            <input type="number" 
                                   class="form-control rate-input" 
                                   data-id="${rate._id}"
                                   data-metal="${metalType}"
                                   data-purity="${rate.purity}"
                                   value="${rate.rate}"
                                   step="0.01"
                                   min="0">
                        </td>
                        <td>${rate.unit}</td>
                        <td>₹${perGram.toFixed(2)}/${rate.unit === 'kg' ? 'g' : 'unit'}</td>
                        <td>
                            <button class="btn btn-primary btn-sm update-rate-btn" 
                                    data-id="${rate._id}">
                                Update
                            </button>
                        </td>
                    </tr>
                `;
            });
        });
        
        container.innerHTML = html;
        
        // Add event listeners to update buttons
        container.querySelectorAll('.update-rate-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const rateId = e.target.dataset.id;
                const input = container.querySelector(`.rate-input[data-id="${rateId}"]`);
                this.updateRate(rateId, input.value);
            });
        });
        
        // Allow pressing Enter to update
        container.querySelectorAll('.rate-input').forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const rateId = e.target.dataset.id;
                    this.updateRate(rateId, e.target.value);
                }
            });
        });
    }

    setupEventListeners() {
        // Add new rate button
        const addRateBtn = document.getElementById('addRateBtn');
        if (addRateBtn) {
            addRateBtn.addEventListener('click', () => {
                this.showAddRateModal();
            });
        }
    }

    async updateRate(rateId, newRate) {
        if (!newRate || parseFloat(newRate) <= 0) {
            this.showAlert('danger', 'Please enter a valid rate');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/rates/${rateId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ rate: parseFloat(newRate) })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showAlert('success', 'Rate updated successfully');
                // Refresh rates
                await this.loadRates();
                
                // Refresh rates in other open pages
                if (window.billingSystem) {
                    await window.billingSystem.loadRates();
                }
                if (window.exchangeSystem) {
                    await window.exchangeSystem.loadRates();
                }
            } else {
                this.showAlert('danger', data.message || 'Failed to update rate');
            }
        } catch (error) {
            console.error('Update rate error:', error);
            this.showAlert('danger', 'Failed to update rate');
        }
    }

    showAddRateModal() {
        // Implementation for adding new rate
        // This would show a modal to add rates for new metal/purity combinations
    }

    showAlert(type, message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="close" data-dismiss="alert">&times;</button>
        `;
        
        const container = document.getElementById('alertContainer') || document.body;
        container.appendChild(alertDiv);
        
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }
}

// Initialize rate manager on admin page
if (document.getElementById('ratesTableBody')) {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.auth.isAuthenticated() && window.auth.isAdmin()) {
            window.rateManager = new RateManager();
        }
    });
}
