// Admin Dashboard Module

class AdminDashboard {
    constructor() {
        this.apiBase = 'http://localhost:5000/api';
        this.token = window.auth.getToken();
        this.charts = {};
        
        this.init();
    }

    async init() {
        try {
            this.setupEventListeners();
            this.setupDateFilters();
            await this.loadDashboardData();
            this.initCharts();
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            this.showAlert('danger', 'Failed to initialize dashboard');
        }
    }

    setupEventListeners() {
        // Time filter buttons
        document.querySelectorAll('.time-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.time-filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.loadDashboardData(e.target.dataset.filter);
            });
        });

        // Apply date filter
        document.getElementById('applyDateFilter')?.addEventListener('click', () => {
            const startDate = document.getElementById('startDate')?.value;
            const endDate = document.getElementById('endDate')?.value;
            if (startDate && endDate) {
                this.loadDashboardData('custom', startDate, endDate);
            }
        });

        // Refresh dashboard
        document.getElementById('refreshDashboardBtn')?.addEventListener('click', () => this.refreshDashboard());

        // Manage rates button
        document.getElementById('manageRatesBtn')?.addEventListener('click', () => this.showRatesModal());

        // Manage users button
        document.getElementById('manageUsersBtn')?.addEventListener('click', () => this.showUsersModal());

        // Export sales
        document.getElementById('exportSalesBtn')?.addEventListener('click', () => this.exportSales());

        // Export customers
        document.getElementById('exportCustomersBtn')?.addEventListener('click', () => this.exportCustomers());

        // Close modal handlers
        document.querySelectorAll('.modal .close').forEach(closeBtn => {
            closeBtn.addEventListener('click', function() {
                this.closest('.modal').classList.remove('show');
            });
        });

        // Close modal on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', function(e) {
                if (e.target === this) {
                    this.classList.remove('show');
                }
            });
        });
    }

    setupDateFilters() {
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');
        
        if (startDate && endDate) {
            // Set default dates (current month)
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            
            startDate.value = firstDay.toISOString().split('T')[0];
            endDate.value = lastDay.toISOString().split('T')[0];
        }
    }

    async loadDashboardData(timeFilter = 'current_month', startDate = null, endDate = null) {
        try {
            let url = `${this.apiBase}/admin/dashboard-stats`;
            const params = [];
            
            if (timeFilter) params.push(`timeFilter=${timeFilter}`);
            if (startDate && endDate) {
                params.push(`startDate=${startDate}`);
                params.push(`endDate=${endDate}`);
            }
            
            if (params.length > 0) {
                url += '?' + params.join('&');
            }
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.updateDashboardStats(data.stats);
                this.updateCharts(data.charts);
            } else {
                throw new Error(data.message || 'Failed to load dashboard data');
            }
        } catch (error) {
            console.error('Load dashboard error:', error);
            this.showAlert('danger', 'Failed to load dashboard data');
        }
    }

    async refreshDashboard() {
        const btn = document.getElementById('refreshDashboardBtn');
        const originalHtml = btn.innerHTML;
        
        btn.innerHTML = '<span class="spinner"></span> Refreshing...';
        btn.disabled = true;
        
        try {
            await this.loadDashboardData();
            await this.loadRecentBills();
            await this.loadAIInsights();
            this.showAlert('success', 'Dashboard refreshed successfully');
        } catch (error) {
            console.error('Refresh dashboard error:', error);
            this.showAlert('danger', 'Failed to refresh dashboard');
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }

    async loadRecentBills() {
        try {
            const response = await fetch(`${this.apiBase}/bills/recent`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.updateRecentBills(data.bills);
            }
        } catch (error) {
            console.error('Load recent bills error:', error);
        }
    }

    async loadAIInsights() {
        try {
            const response = await fetch(`${this.apiBase}/ai/insights`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.updateAIInsights(data.insights);
            }
        } catch (error) {
            console.error('Load AI insights error:', error);
        }
    }

    updateDashboardStats(stats) {
        if (!stats) return;
        
        document.getElementById('totalSales')?.textContent = `₹${stats.totalSales?.toLocaleString() || '0'}`;
        document.getElementById('totalBills')?.textContent = stats.totalBills || '0';
        document.getElementById('averageBill')?.textContent = `₹${(stats.averageBill || 0).toFixed(2)}`;
        document.getElementById('exchangeBills')?.textContent = stats.exchangeBills || '0';
        
        // Update sales growth
        const salesGrowth = document.getElementById('salesGrowth');
        if (salesGrowth) {
            const growth = stats.salesGrowth || 0;
            if (growth >= 0) {
                salesGrowth.innerHTML = `<span class="stat-change">+${growth.toFixed(1)}%</span> vs last month`;
            } else {
                salesGrowth.innerHTML = `<span class="stat-change" style="color: #dc3545;">${growth.toFixed(1)}%</span> vs last month`;
            }
        }
    }

    updateCharts(chartData) {
        if (!chartData) return;
        
        // Sales trend chart
        if (chartData.salesTrend) {
            this.createSalesTrendChart(chartData.salesTrend);
        }
        
        // Metal distribution chart
        if (chartData.metalDistribution) {
            this.createMetalDistributionChart(chartData.metalDistribution);
        }
        
        // Payment mode chart
        if (chartData.paymentModes) {
            this.createPaymentModeChart(chartData.paymentModes);
        }
    }

    createSalesTrendChart(data) {
        const ctx = document.getElementById('salesTrendChart');
        if (!ctx) return;
        
        // Destroy existing chart
        if (this.charts.salesTrend) {
            this.charts.salesTrend.destroy();
        }
        
        this.charts.salesTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels || [],
                datasets: [{
                    label: 'Sales (₹)',
                    data: data.values || [],
                    borderColor: '#D4AF37',
                    backgroundColor: 'rgba(212, 175, 55, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Sales Trend'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₹' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    createMetalDistributionChart(data) {
        const ctx = document.getElementById('metalDistributionChart');
        if (!ctx) return;
        
        if (this.charts.metalDistribution) {
            this.charts.metalDistribution.destroy();
        }
        
        this.charts.metalDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels || [],
                datasets: [{
                    data: data.values || [],
                    backgroundColor: [
                        '#FFD700', // Gold
                        '#C0C0C0', // Silver
                        '#B9F2FF', // Diamond
                        '#E5E4E2', // Platinum
                        '#6C757D'  // Others
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    title: {
                        display: true,
                        text: 'Sales by Metal Type'
                    }
                }
            }
        });
    }

    createPaymentModeChart(data) {
        const ctx = document.getElementById('paymentModeChart');
        if (!ctx) return;
        
        if (this.charts.paymentMode) {
            this.charts.paymentMode.destroy();
        }
        
        this.charts.paymentMode = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels || [],
                datasets: [{
                    label: 'Payment Distribution',
                    data: data.values || [],
                    backgroundColor: [
                        '#28a745', // Cash
                        '#007bff', // Card
                        '#6f42c1', // UPI
                        '#17a2b8', // Bank Transfer
                        '#ffc107'  // Credit
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Payment Mode Distribution'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    updateRecentBills(bills) {
        const tbody = document.getElementById('recentBills');
        if (!tbody) return;
        
        if (!bills || bills.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No recent bills</td></tr>';
            return;
        }
        
        let html = '';
        
        bills.forEach(bill => {
            const statusClass = bill.status === 'paid' ? 'status-success' : 'status-warning';
            const statusText = bill.status === 'paid' ? 'Paid' : 'Pending';
            
            html += `
                <tr style="cursor: pointer;" onclick="window.adminDashboard.showBillDetails('${bill._id}')">
                    <td>${bill.billNumber}</td>
                    <td>${bill.customer?.name || 'N/A'}</td>
                    <td>₹${(bill.summary?.grandTotal || 0).toFixed(2)}</td>
                    <td>${new Date(bill.date).toLocaleDateString()}</td>
                    <td>${bill.paymentMode || 'Cash'}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    }

    updateAIInsights(insights) {
        const container = document.getElementById('aiInsights');
        if (!container) return;
        
        if (!insights || insights.length === 0) {
            container.innerHTML = '<div class="insight-section"><p>No insights available for this period.</p></div>';
            return;
        }
        
        let html = '';
        
        insights.forEach(insight => {
            html += `
                <div class="insight-section">
                    <h4><i class="fas fa-${insight.icon || 'lightbulb'}"></i> ${insight.title || 'Insight'}</h4>
                    <p>${insight.description || 'No description available'}</p>
                    ${insight.recommendations ? `
                        <ul>
                            ${insight.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                        </ul>
                    ` : ''}
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        const insightTime = document.getElementById('insightTime');
        if (insightTime) {
            insightTime.textContent = 'Updated ' + new Date().toLocaleTimeString();
        }
    }

    async showRatesModal() {
        try {
            const response = await fetch(`${this.apiBase}/rates/all`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.updateRatesTable(data.rates);
                document.getElementById('ratesModal').classList.add('show');
            } else {
                throw new Error(data.message || 'Failed to load rates');
            }
        } catch (error) {
            console.error('Load rates error:', error);
            this.showAlert('danger', 'Failed to load rates');
        }
    }

    updateRatesTable(rates) {
        const tbody = document.getElementById('ratesTableBody');
        if (!tbody) return;
        
        if (!rates || rates.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No rates found</td></tr>';
            return;
        }
        
        let html = '';
        
        // Define metal purities as per BUSINESS RULES (same as billing.js)
        const metalPurities = {
            'Gold': ['24K', '22K', '18K', '14K'],
            'Silver': ['999', '925', '900', '850', '800'],
            'Diamond': ['SI1', 'VS1', 'VVS1', 'IF', 'FL'],
            'Platinum': ['999', '950', '900', '850'],
            'Others': ['Standard']
        };
        
        // Create rows for each metal and purity
        Object.keys(metalPurities).forEach(metalType => {
            metalPurities[metalType].forEach(purity => {
                const existingRate = rates.find(r => r.metalType === metalType && r.purity === purity);
                const rateId = existingRate ? existingRate._id : 'new';
                const rateValue = existingRate ? existingRate.rate : '';
                const unit = metalType === 'Diamond' ? 'carat' : 'gram';
                const displayRate = rateValue ? `₹${rateValue.toFixed(2)}` : 'N/A';
                
                html += `
                    <tr>
                        <td>${metalType}</td>
                        <td>${purity}</td>
                        <td>
                            <input type="number" 
                                   class="form-control rate-input" 
                                   id="rate-${metalType}-${purity}" 
                                   value="${rateValue}" 
                                   placeholder="Enter rate"
                                   step="0.01"
                                   min="0">
                        </td>
                        <td>${unit}</td>
                        <td>
                            <span id="perGram-${metalType}-${purity}">${displayRate}</span>
                        </td>
                        <td>
                            <button class="btn btn-primary btn-sm" 
                                    onclick="window.adminDashboard.saveRate('${metalType}', '${purity}', '${rateId}')">
                                <i class="fas fa-save"></i> Save
                            </button>
                        </td>
                    </tr>
                `;
            });
        });
        
        tbody.innerHTML = html;
    }

    async saveRate(metalType, purity, rateId) {
        const input = document.getElementById(`rate-${metalType}-${purity}`);
        if (!input) {
            this.showAlert('danger', 'Rate input not found');
            return;
        }
        
        const rate = parseFloat(input.value);
        
        if (!rate || rate <= 0) {
            this.showAlert('danger', 'Please enter a valid rate greater than 0');
            return;
        }
        
        try {
            const url = rateId === 'new' 
                ? `${this.apiBase}/rates` 
                : `${this.apiBase}/rates/${rateId}`;
            
            const method = rateId === 'new' ? 'POST' : 'PUT';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    metalType,
                    purity,
                    rate,
                    unit: metalType === 'Diamond' ? 'carat' : 'gram'
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Update per gram display
                const displayElement = document.getElementById(`perGram-${metalType}-${purity}`);
                if (displayElement) {
                    displayElement.textContent = `₹${rate.toFixed(2)}`;
                }
                this.showAlert('success', 'Rate saved successfully');
            } else {
                throw new Error(data.message || 'Failed to save rate');
            }
        } catch (error) {
            console.error('Save rate error:', error);
            this.showAlert('danger', 'Failed to save rate');
        }
    }

    async showUsersModal() {
        try {
            const response = await fetch(`${this.apiBase}/users`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.updateUsersTable(data.users);
                document.getElementById('usersModal').classList.add('show');
            } else {
                throw new Error(data.message || 'Failed to load users');
            }
        } catch (error) {
            console.error('Load users error:', error);
            this.showAlert('danger', 'Failed to load users');
        }
    }

    updateUsersTable(users) {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        
        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No users found</td></tr>';
            return;
        }
        
        let html = '';
        
        users.forEach(user => {
            const statusClass = user.active ? 'status-success' : 'status-danger';
            const statusText = user.active ? 'Active' : 'Inactive';
            
            html += `
                <tr>
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td><span class="badge ${user.role === 'admin' ? 'badge-primary' : 'badge-secondary'}">${user.role}</span></td>
                    <td>${user.mobile || 'N/A'}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="btn btn-warning btn-sm" onclick="window.adminDashboard.editUser('${user._id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-sm ml-1" onclick="window.adminDashboard.deleteUser('${user._id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    }

    editUser(userId) {
        this.showAlert('info', 'Edit user feature will be implemented in next version');
    }

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.showAlert('success', 'User deleted successfully');
                this.showUsersModal(); // Refresh users list
            } else {
                throw new Error(data.message || 'Failed to delete user');
            }
        } catch (error) {
            console.error('Delete user error:', error);
            this.showAlert('danger', 'Failed to delete user');
        }
    }

    async showBillDetails(billId) {
        try {
            const response = await fetch(`${this.apiBase}/bills/${billId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.updateBillDetailsModal(data.bill);
                document.getElementById('billDetailsModal').classList.add('show');
            } else {
                throw new Error(data.message || 'Failed to load bill details');
            }
        } catch (error) {
            console.error('Load bill details error:', error);
            this.showAlert('danger', 'Failed to load bill details');
        }
    }

    updateBillDetailsModal(bill) {
        if (!bill) return;
        
        document.getElementById('billDetailNumber').textContent = bill.billNumber || 'N/A';
        document.getElementById('billDetailDate').textContent = new Date(bill.date).toLocaleDateString();
        document.getElementById('billDetailCustomer').textContent = bill.customer?.name || 'N/A';
        document.getElementById('billDetailMobile').textContent = bill.customer?.mobile || 'N/A';
        document.getElementById('billDetailAddress').textContent = bill.customer?.address || 'N/A';
        document.getElementById('billDetailTotal').textContent = `₹${(bill.summary?.grandTotal || 0).toFixed(2)}`;
        document.getElementById('billDetailPayment').textContent = bill.paymentMode || 'Cash';
        
        // Update items
        const itemsTbody = document.getElementById('billDetailItems');
        if (itemsTbody) {
            let itemsHtml = '';
            
            if (bill.items && bill.items.length > 0) {
                bill.items.forEach(item => {
                    if (!item.isExchange) {
                        itemsHtml += `
                            <tr>
                                <td>${item.product || 'N/A'}</td>
                                <td>${item.metalType} ${item.purity}</td>
                                <td>${(item.ntWt || 0).toFixed(3)} g</td>
                                <td>₹${(item.totalValue || 0).toFixed(2)}</td>
                            </tr>
                        `;
                    }
                });
            } else {
                itemsHtml = '<tr><td colspan="4" class="text-center">No items found</td></tr>';
            }
            
            itemsTbody.innerHTML = itemsHtml;
        }
        
        // Check for exchange items
        const hasExchange = bill.items?.some(item => item.isExchange);
        const exchangeDiv = document.getElementById('billDetailExchange');
        
        if (exchangeDiv) {
            if (hasExchange) {
                exchangeDiv.style.display = 'block';
                document.getElementById('billDetailOldItems').textContent = 
                    `₹${(bill.summary?.exchangeValue || 0).toFixed(2)}`;
                
                if (bill.summary?.balancePayable > 0) {
                    document.getElementById('billDetailBalance').textContent = 
                        `₹${bill.summary.balancePayable.toFixed(2)} Payable`;
                } else {
                    document.getElementById('billDetailBalance').textContent = 
                        `₹${(bill.summary?.balanceRefundable || 0).toFixed(2)} Refundable`;
                }
            } else {
                exchangeDiv.style.display = 'none';
            }
        }
    }

    async exportSales() {
        try {
            const response = await fetch(`${this.apiBase}/reports/export/sales`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `sales-report-${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.showAlert('success', 'Sales report exported successfully');
            } else {
                throw new Error('Export failed');
            }
        } catch (error) {
            console.error('Export sales error:', error);
            this.showAlert('danger', 'Failed to export sales report');
        }
    }

    async exportCustomers() {
        try {
            const response = await fetch(`${this.apiBase}/reports/export/customers`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `customers-report-${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.showAlert('success', 'Customers report exported successfully');
            } else {
                throw new Error('Export failed');
            }
        } catch (error) {
            console.error('Export customers error:', error);
            this.showAlert('danger', 'Failed to export customers report');
        }
    }

    initCharts() {
        // Initialize charts if data exists
        if (typeof Chart !== 'undefined') {
            // Charts will be created when data is loaded
        } else {
            console.warn('Chart.js not loaded');
        }
    }

    showAlert(type, message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="close" data-dismiss="alert">&times;</button>
        `;
        
        const container = document.getElementById('alertContainer');
        if (container) {
            container.appendChild(alertDiv);
            
            setTimeout(() => {
                if (alertDiv.parentElement) {
                    alertDiv.classList.remove('show');
                    setTimeout(() => alertDiv.remove(), 150);
                }
            }, 5000);
        }
    }

    showLoading(show) {
        const loadingElement = document.getElementById('dashboardLoading');
        const contentElement = document.getElementById('dashboardContent');
        
        if (loadingElement && contentElement) {
            if (show) {
                loadingElement.style.display = 'flex';
                contentElement.style.opacity = '0.5';
                contentElement.style.pointerEvents = 'none';
            } else {
                loadingElement.style.display = 'none';
                contentElement.style.opacity = '1';
                contentElement.style.pointerEvents = 'auto';
            }
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (window.auth && window.auth.isAuthenticated && window.auth.isAuthenticated()) {
        if (window.auth.isAdmin && window.auth.isAdmin()) {
            window.adminDashboard = new AdminDashboard();
        } else {
            window.location.href = 'index.html';
            alert('Access denied. Admin privileges required.');
        }
    } else {
        window.location.href = 'login.html';
    }
});

// Make functions globally accessible
window.showBillDetails = (billId) => {
    if (window.adminDashboard) {
        window.adminDashboard.showBillDetails(billId);
    }
};

window.saveRate = (metalType, purity, rateId) => {
    if (window.adminDashboard) {
        window.adminDashboard.saveRate(metalType, purity, rateId);
    }
};

window.editUser = (userId) => {
    if (window.adminDashboard) {
        window.adminDashboard.editUser(userId);
    }
};

window.deleteUser = (userId) => {
    if (window.adminDashboard) {
        window.adminDashboard.deleteUser(userId);
    }
};
