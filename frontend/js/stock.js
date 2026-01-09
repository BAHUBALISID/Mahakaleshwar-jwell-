class StockSystem {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || '{}');
        this.currentStock = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadStock();
        await this.loadStockAlerts();
        this.initializeStockChart();
    }

    setupEventListeners() {
        // Stock actions
        document.getElementById('addStockBtn').addEventListener('click', () => this.showStockModal());
        document.getElementById('saveStockBtn').addEventListener('click', () => this.saveStock());
        document.getElementById('stockForm').addEventListener('submit', (e) => e.preventDefault());

        // Search and filter
        document.getElementById('stockSearch').addEventListener('input', (e) => this.filterStock(e.target.value));
        document.getElementById('filterMetal').addEventListener('change', () => this.filterStock());
        document.getElementById('filterLowStock').addEventListener('change', () => this.filterStock());

        // Stock adjustments
        document.getElementById('adjustStockBtn').addEventListener('click', () => this.showAdjustmentModal());
        document.getElementById('saveAdjustmentBtn').addEventListener('click', () => this.saveAdjustment());
        document.getElementById('adjustmentForm').addEventListener('submit', (e) => e.preventDefault());

        // Stock transfers
        document.getElementById('transferStockBtn').addEventListener('click', () => this.showTransferModal());
        document.getElementById('saveTransferBtn').addEventListener('click', () => this.saveTransfer());
        document.getElementById('transferForm').addEventListener('submit', (e) => e.preventDefault());

        // Stock reconciliation
        document.getElementById('reconcileBtn').addEventListener('click', () => this.showReconciliationModal());
        document.getElementById('saveReconciliationBtn').addEventListener('click', () => this.saveReconciliation());
        document.getElementById('reconciliationForm').addEventListener('submit', (e) => e.preventDefault());

        // Export buttons
        document.getElementById('exportStockExcel').addEventListener('click', () => this.exportExcel());
        document.getElementById('printStock').addEventListener('click', () => this.printStock());
        document.getElementById('refreshStock').addEventListener('click', () => this.refreshStock());
    }

    async loadStock() {
        try {
            const response = await fetch('/api/stock', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            if (data.success) {
                this.stockData = data.stock;
                this.updateStockTable(data.stock);
                this.updateStockSummary(data.stock);
                this.updateStockChart(data.stock);
            }
        } catch (error) {
            console.error('Load stock error:', error);
            this.showError('Failed to load stock data');
        }
    }

    async loadStockAlerts() {
        try {
            const response = await fetch('/api/stock/alerts', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            if (data.success) {
                this.updateStockAlerts(data.alerts);
            }
        } catch (error) {
            console.error('Load stock alerts error:', error);
        }
    }

    updateStockTable(stock) {
        const tbody = document.getElementById('stockTableBody');
        if (!tbody) return;

        if (stock.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center">No stock items found</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = stock.map(item => `
            <tr data-id="${item._id}" class="${item.isLowStock ? 'low-stock' : ''}">
                <td>
                    <div class="stock-item">
                        <div class="stock-name">${item.productName}</div>
                        <div class="stock-metal">${item.metalType} ${item.purity}</div>
                    </div>
                </td>
                <td>${item.quantity}</td>
                <td>${item.weight.toFixed(3)}g</td>
                <td>₹${item.costPrice ? item.costPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</td>
                <td>₹${item.sellingReferencePrice ? item.sellingReferencePrice.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</td>
                <td>
                    <span class="badge ${item.isLowStock ? 'badge-danger' : 'badge-success'}">
                        ${item.isLowStock ? 'Low' : 'Normal'}
                    </span>
                </td>
                <td>${item.lowStockThreshold}</td>
                <td>${item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString('en-IN') : '-'}</td>
                <td>
                    <div class="stock-actions">
                        <button class="btn-action" onclick="stockSystem.editStock('${item._id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action" onclick="stockSystem.adjustStock('${item._id}')" title="Adjust">
                            <i class="fas fa-adjust"></i>
                        </button>
                        <button class="btn-action" onclick="stockSystem.viewHistory('${item._id}')" title="History">
                            <i class="fas fa-history"></i>
                        </button>
                        <button class="btn-action btn-danger" onclick="stockSystem.deleteStock('${item._id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    updateStockSummary(stock) {
        const summary = {
            totalItems: stock.length,
            totalQuantity: stock.reduce((sum, item) => sum + item.quantity, 0),
            totalWeight: stock.reduce((sum, item) => sum + item.weight, 0),
            totalValue: stock.reduce((sum, item) => sum + (item.weight * (item.sellingReferencePrice || 0)), 0),
            lowStockCount: stock.filter(item => item.isLowStock).length,
            zeroStockCount: stock.filter(item => item.quantity === 0).length
        };

        document.getElementById('totalStockItems').textContent = summary.totalItems.toLocaleString('en-IN');
        document.getElementById('totalStockQuantity').textContent = summary.totalQuantity.toLocaleString('en-IN');
        document.getElementById('totalStockWeight').textContent = summary.totalWeight.toFixed(3) + 'g';
        document.getElementById('totalStockValue').textContent = '₹' + summary.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 });
        document.getElementById('lowStockCount').textContent = summary.lowStockCount.toLocaleString('en-IN');
        document.getElementById('zeroStockCount').textContent = summary.zeroStockCount.toLocaleString('en-IN');
    }

    updateStockAlerts(alerts) {
        const alertsContainer = document.getElementById('stockAlerts');
        if (!alertsContainer) return;

        let alertsHTML = '';

        // Out of stock alerts
        if (alerts.outOfStock && alerts.outOfStock.count > 0) {
            alertsHTML += `
                <div class="alert alert-danger">
                    <h5><i class="fas fa-exclamation-triangle"></i> Out of Stock (${alerts.outOfStock.count})</h5>
                    <ul class="mb-0">
                        ${alerts.outOfStock.items.map(item => `
                            <li>${item.product} (${item.metal}) - ${item.quantity} left</li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        // Low stock alerts
        if (alerts.lowStock && alerts.lowStock.count > 0) {
            alertsHTML += `
                <div class="alert alert-warning">
                    <h5><i class="fas fa-exclamation-circle"></i> Low Stock (${alerts.lowStock.count})</h5>
                    <ul class="mb-0">
                        ${alerts.lowStock.items.map(item => `
                            <li>${item.product} (${item.metal}) - ${item.quantity} left (Threshold: ${item.daysToStockOut} days)</li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        // Slow moving items
        if (alerts.slowMoving && alerts.slowMoving.count > 0) {
            alertsHTML += `
                <div class="alert alert-info">
                    <h5><i class="fas fa-info-circle"></i> Slow Moving Items (${alerts.slowMoving.count})</h5>
                    <ul class="mb-0">
                        ${alerts.slowMoving.items.map(item => `
                            <li>${item.product} (${item.metal}) - No sales in 30 days</li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        if (!alertsHTML) {
            alertsHTML = `
                <div class="alert alert-success">
                    <h5><i class="fas fa-check-circle"></i> All Stock Levels Normal</h5>
                    <p>No stock alerts at this time.</p>
                </div>
            `;
        }

        alertsContainer.innerHTML = alertsHTML;
    }

    initializeStockChart() {
        const stockCtx = document.getElementById('stockChart');
        if (!stockCtx) return;

        this.stockChart = new Chart(stockCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Stock Value (₹)',
                    data: [],
                    backgroundColor: '#D4AF37',
                    borderColor: '#B8860B',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Stock Value by Metal Type'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₹' + value.toLocaleString('en-IN');
                            }
                        }
                    }
                }
            }
        });
    }

    updateStockChart(stock) {
        if (!this.stockChart || !stock || stock.length === 0) return;

        // Group by metal type
        const metalGroups = {};
        stock.forEach(item => {
            const metal = item.metalType;
            if (!metalGroups[metal]) {
                metalGroups[metal] = 0;
            }
            metalGroups[metal] += item.weight * (item.sellingReferencePrice || 0);
        });

        const labels = Object.keys(metalGroups);
        const data = Object.values(metalGroups);

        this.stockChart.data.labels = labels;
        this.stockChart.data.datasets[0].data = data;
        this.stockChart.update();
    }

    filterStock(searchTerm = '') {
        const metalFilter = document.getElementById('filterMetal').value;
        const lowStockOnly = document.getElementById('filterLowStock').checked;

        if (!this.stockData) return;

        let filtered = [...this.stockData];

        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(item =>
                item.productName.toLowerCase().includes(term) ||
                item.metalType.toLowerCase().includes(term) ||
                item.purity.toLowerCase().includes(term)
            );
        }

        // Apply metal filter
        if (metalFilter) {
            filtered = filtered.filter(item => item.metalType === metalFilter);
        }

        // Apply low stock filter
        if (lowStockOnly) {
            filtered = filtered.filter(item => item.isLowStock);
        }

        this.updateStockTable(filtered);
        this.updateStockSummary(filtered);
    }

    showStockModal(stock = null) {
        const modal = document.getElementById('stockModal');
        const title = document.getElementById('stockModalTitle');
        const form = document.getElementById('stockForm');

        // Load metal types for dropdown
        this.loadMetalTypes();

        if (stock) {
            title.textContent = 'Edit Stock Item';
            form.dataset.id = stock._id;
            document.getElementById('stockMetalType').value = stock.metalType;
            document.getElementById('stockPurity').value = stock.purity;
            document.getElementById('stockProductName').value = stock.productName;
            document.getElementById('stockQuantity').value = stock.quantity;
            document.getElementById('stockWeight').value = stock.weight;
            document.getElementById('stockCostPrice').value = stock.costPrice || '';
            document.getElementById('stockSellingPrice').value = stock.sellingReferencePrice || '';
            document.getElementById('stockLowStockThreshold').value = stock.lowStockThreshold || 5;
            document.getElementById('stockNotes').value = stock.notes || '';
        } else {
            title.textContent = 'Add New Stock';
            form.dataset.id = '';
            form.reset();
            document.getElementById('stockLowStockThreshold').value = 5;
        }

        modal.style.display = 'block';
    }

    async loadMetalTypes() {
        try {
            const response = await fetch('/api/rates/active', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            if (data.success) {
                this.populateMetalDropdown(data.rates);
            }
        } catch (error) {
            console.error('Load metal types error:', error);
        }
    }

    populateMetalDropdown(rates) {
        const metalSelect = document.getElementById('stockMetalType');
        const puritySelect = document.getElementById('stockPurity');

        metalSelect.innerHTML = '<option value="">Select Metal</option>';
        puritySelect.innerHTML = '<option value="">Select Purity</option>';

        const metals = new Set();
        Object.keys(rates).forEach(metal => {
            metals.add(metal);
        });

        metals.forEach(metal => {
            const option = document.createElement('option');
            option.value = metal;
            option.textContent = metal;
            metalSelect.appendChild(option);
        });

        // Update purity when metal changes
        metalSelect.addEventListener('change', (e) => {
            const selectedMetal = e.target.value;
            puritySelect.innerHTML = '<option value="">Select Purity</option>';
            puritySelect.disabled = !selectedMetal;

            if (selectedMetal && rates[selectedMetal]) {
                rates[selectedMetal].forEach(purity => {
                    const option = document.createElement('option');
                    option.value = purity.purity;
                    option.textContent = purity.purity;
                    puritySelect.appendChild(option);
                });
            }
        });
    }

    async saveStock() {
        const form = document.getElementById('stockForm');
        const id = form.dataset.id;
        const saveBtn = document.getElementById('saveStockBtn');

        const stockData = {
            metalType: document.getElementById('stockMetalType').value,
            purity: document.getElementById('stockPurity').value,
            productName: document.getElementById('stockProductName').value,
            quantity: parseInt(document.getElementById('stockQuantity').value) || 0,
            weight: parseFloat(document.getElementById('stockWeight').value) || 0,
            costPrice: parseFloat(document.getElementById('stockCostPrice').value) || undefined,
            sellingReferencePrice: parseFloat(document.getElementById('stockSellingPrice').value) || undefined,
            lowStockThreshold: parseInt(document.getElementById('stockLowStockThreshold').value) || 5,
            notes: document.getElementById('stockNotes').value
        };

        // Validation
        if (!stockData.metalType || !stockData.purity || !stockData.productName) {
            this.showError('Please fill all required fields');
            return;
        }

        if (stockData.quantity < 0) {
            this.showError('Quantity cannot be negative');
            return;
        }

        if (stockData.weight < 0) {
            this.showError('Weight cannot be negative');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            const url = id ? `/api/stock/${id}` : '/api/stock';
            const method = id ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(stockData)
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess(`Stock ${id ? 'updated' : 'added'} successfully`);
                this.closeModal('stockModal');
                await this.loadStock();
                await this.loadStockAlerts();
            } else {
                this.showError(data.error || 'Failed to save stock');
            }
        } catch (error) {
            console.error('Save stock error:', error);
            this.showError('Error saving stock');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Stock';
        }
    }

    async editStock(stockId) {
        try {
            const response = await fetch(`/api/stock/${stockId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            if (data.success) {
                this.showStockModal(data.stock);
            }
        } catch (error) {
            console.error('Edit stock error:', error);
            this.showError('Error loading stock details');
        }
    }

    async deleteStock(stockId) {
        if (!confirm('Are you sure you want to delete this stock item? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/stock/${stockId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            if (data.success) {
                this.showSuccess('Stock item deleted successfully');
                await this.loadStock();
                await this.loadStockAlerts();
            } else {
                this.showError(data.error || 'Failed to delete stock');
            }
        } catch (error) {
            console.error('Delete stock error:', error);
            this.showError('Error deleting stock');
        }
    }

    async adjustStock(stockId) {
        try {
            const response = await fetch(`/api/stock/${stockId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            if (data.success) {
                this.currentStock = data.stock;
                this.showAdjustmentModal(data.stock);
            }
        } catch (error) {
            console.error('Adjust stock error:', error);
            this.showError('Error loading stock details');
        }
    }

    showAdjustmentModal(stock = null) {
        const modal = document.getElementById('adjustmentModal');
        const form = document.getElementById('adjustmentForm');

        if (stock) {
            form.dataset.id = stock._id;
            document.getElementById('adjustProductName').value = stock.productName;
            document.getElementById('adjustCurrentQuantity').value = stock.quantity;
            document.getElementById('adjustCurrentWeight').value = stock.weight.toFixed(3);
        }

        modal.style.display = 'block';
    }

    async saveAdjustment() {
        const form = document.getElementById('adjustmentForm');
        const stockId = form.dataset.id;
        const saveBtn = document.getElementById('saveAdjustmentBtn');

        const adjustmentData = {
            adjustmentType: document.getElementById('adjustmentType').value,
            quantity: parseInt(document.getElementById('adjustQuantity').value) || 0,
            weight: parseFloat(document.getElementById('adjustWeight').value) || 0,
            reason: document.getElementById('adjustmentReason').value
        };

        // Validation
        if (!adjustmentData.adjustmentType) {
            this.showError('Please select adjustment type');
            return;
        }

        if (adjustmentData.quantity < 0) {
            this.showError('Quantity cannot be negative');
            return;
        }

        if (adjustmentData.weight < 0) {
            this.showError('Weight cannot be negative');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            const response = await fetch(`/api/stock/${stockId}/adjust`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(adjustmentData)
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Stock adjustment saved successfully');
                this.closeModal('adjustmentModal');
                await this.loadStock();
                await this.loadStockAlerts();
            } else {
                this.showError(data.error || 'Failed to save adjustment');
            }
        } catch (error) {
            console.error('Save adjustment error:', error);
            this.showError('Error saving adjustment');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Adjustment';
        }
    }

    async viewHistory(stockId) {
        try {
            const response = await fetch(`/api/stock/${stockId}/history`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            if (data.success) {
                this.showHistoryModal(data.transactions, data.stock);
            }
        } catch (error) {
            console.error('View history error:', error);
            this.showError('Error loading stock history');
        }
    }

    showHistoryModal(transactions, stock) {
        const modal = document.getElementById('historyModal');
        const tbody = document.getElementById('historyTableBody');

        document.getElementById('historyProductName').textContent = 
            `${stock.productName} (${stock.metalType} ${stock.purity})`;

        if (transactions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">No transaction history</td>
                </tr>
            `;
        } else {
            tbody.innerHTML = transactions.map(trans => `
                <tr>
                    <td>${new Date(trans.createdAt).toLocaleString('en-IN')}</td>
                    <td>
                        <span class="badge ${trans.transactionType === 'in' ? 'badge-success' : trans.transactionType === 'out' ? 'badge-danger' : 'badge-warning'}">
                            ${trans.transactionType.toUpperCase()}
                        </span>
                    </td>
                    <td>${trans.quantity}</td>
                    <td>${trans.weight.toFixed(3)}g</td>
                    <td>${trans.billNumber || '-'}</td>
                    <td>${trans.notes || '-'}</td>
                </tr>
            `).join('');
        }

        modal.style.display = 'block';
    }

    showReconciliationModal(stock = null) {
        const modal = document.getElementById('reconciliationModal');
        const form = document.getElementById('reconciliationForm');

        if (stock) {
            form.dataset.id = stock._id;
            document.getElementById('reconcileProductName').value = stock.productName;
            document.getElementById('reconcileSystemQuantity').value = stock.quantity;
            document.getElementById('reconcileSystemWeight').value = stock.weight.toFixed(3);
        }

        modal.style.display = 'block';
    }

    async saveReconciliation() {
        const form = document.getElementById('reconciliationForm');
        const stockId = form.dataset.id;
        const saveBtn = document.getElementById('saveReconciliationBtn');

        const reconciliationData = {
            actualQuantity: parseInt(document.getElementById('reconcileActualQuantity').value) || 0,
            actualWeight: parseFloat(document.getElementById('reconcileActualWeight').value) || 0,
            notes: document.getElementById('reconciliationNotes').value
        };

        // Validation
        if (reconciliationData.actualQuantity < 0) {
            this.showError('Actual quantity cannot be negative');
            return;
        }

        if (reconciliationData.actualWeight < 0) {
            this.showError('Actual weight cannot be negative');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reconciling...';

        try {
            const response = await fetch(`/api/stock/${stockId}/reconcile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(reconciliationData)
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Stock reconciled successfully');
                this.closeModal('reconciliationModal');
                await this.loadStock();
                await this.loadStockAlerts();
            } else {
                this.showError(data.error || 'Failed to reconcile stock');
            }
        } catch (error) {
            console.error('Save reconciliation error:', error);
            this.showError('Error reconciling stock');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Reconciliation';
        }
    }

    async exportExcel() {
        const exportBtn = document.getElementById('exportStockExcel');
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';

        try {
            const response = await fetch('/api/stock/export', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `SMJ_Stock_${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            } else {
                this.showError('Failed to export stock');
            }
        } catch (error) {
            console.error('Export stock error:', error);
            this.showError('Error exporting stock');
        } finally {
            exportBtn.disabled = false;
            exportBtn.innerHTML = '<i class="fas fa-file-excel"></i> Export Excel';
        }
    }

    printStock() {
        window.print();
    }

    async refreshStock() {
        const refreshBtn = document.getElementById('refreshStock');
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';

        await this.loadStock();
        await this.loadStockAlerts();

        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
        this.showSuccess('Stock data refreshed successfully');
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    showSuccess(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-success alert-dismissible';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="close" onclick="this.parentElement.remove()">&times;</button>
        `;
        
        const container = document.querySelector('.main-content') || document.body;
        container.insertBefore(alertDiv, container.firstChild);
        
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }

    showError(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-danger alert-dismissible';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="close" onclick="this.parentElement.remove()">&times;</button>
        `;
        
        const container = document.querySelector('.main-content') || document.body;
        container.insertBefore(alertDiv, container.firstChild);
        
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }
}

// Initialize stock system
let stockSystem;
document.addEventListener('DOMContentLoaded', () => {
    stockSystem = new StockSystem();
    
    // Close modal when clicking X
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });

    // Close modal when clicking outside
    window.onclick = function(event) {
        document.querySelectorAll('.modal').forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    };
});
