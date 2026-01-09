/**
 * Admin Dashboard with Rate Management
 */

class AdminDashboard {
  constructor() {
    this.apiBase = 'http://localhost:5000/api';
    this.token = window.auth.getToken();
    this.charts = {};
    
    this.init();
  }
  
  async init() {
    if (!window.auth.isAdmin()) {
      window.location.href = 'index.html';
      return;
    }
    
    this.setupEventListeners();
    await this.loadDashboardData();
    this.setupModals();
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
    
    // Refresh button
    document.getElementById('refreshDashboardBtn')?.addEventListener('click', () => {
      this.loadDashboardData();
    });
    
    // Apply date filter
    document.getElementById('applyDateFilter')?.addEventListener('click', () => {
      this.loadCustomDateRangeData();
    });
    
    // Quick action buttons
    document.getElementById('manageRatesBtn')?.addEventListener('click', () => {
      this.showRatesModal();
    });
    
    document.getElementById('manageUsersBtn')?.addEventListener('click', () => {
      this.showUsersModal();
    });
    
    document.getElementById('exportSalesBtn')?.addEventListener('click', () => {
      this.exportSalesData();
    });
    
    document.getElementById('exportCustomersBtn')?.addEventListener('click', () => {
      this.exportCustomersData();
    });
    
    // Close modals
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
      closeBtn.addEventListener('click', function() {
        const modal = this.closest('.modal');
        if (modal) modal.classList.remove('show');
      });
    });
  }
  
  setupModals() {
    // Close modal on outside click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', function(e) {
        if (e.target === this) {
          this.classList.remove('show');
        }
      });
    });
  }
  
  async loadDashboardData(timeFilter = 'current_month') {
    this.showLoading(true);
    
    try {
      let url = `${this.apiBase}/reports/dashboard`;
      if (timeFilter !== 'custom') {
        url += `?timeFilter=${timeFilter}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.updateDashboardUI(data.dashboard);
        this.updateCharts(data.charts);
        this.updateRecentBills(data.recentBills);
        this.updateAIInsights(data.aiInsights);
      }
    } catch (error) {
      console.error('Load dashboard error:', error);
      this.showAlert('danger', 'Failed to load dashboard data');
    } finally {
      this.showLoading(false);
    }
  }
  
  async loadCustomDateRangeData() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
      this.showAlert('warning', 'Please select both start and end dates');
      return;
    }
    
    this.showLoading(true);
    
    try {
      const response = await fetch(
        `${this.apiBase}/reports/dashboard?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        this.updateDashboardUI(data.dashboard);
        this.updateCharts(data.charts);
      }
    } catch (error) {
      console.error('Load custom range error:', error);
      this.showAlert('danger', 'Failed to load data for selected range');
    } finally {
      this.showLoading(false);
    }
  }
  
  updateDashboardUI(dashboard) {
    // Update stats cards
    document.getElementById('totalSales').textContent = `₹${dashboard.totalSales.toLocaleString()}`;
    document.getElementById('totalBills').textContent = dashboard.totalBills.toLocaleString();
    document.getElementById('averageBill').textContent = `₹${dashboard.averageBillValue.toFixed(2)}`;
    document.getElementById('exchangeBills').textContent = dashboard.exchangeBills.toLocaleString();
    
    // Update sales growth
    const salesGrowth = document.getElementById('salesGrowth');
    if (dashboard.salesGrowth >= 0) {
      salesGrowth.textContent = `+${dashboard.salesGrowth.toFixed(1)}% vs last period`;
      salesGrowth.className = 'stat-change text-success';
    } else {
      salesGrowth.textContent = `${dashboard.salesGrowth.toFixed(1)}% vs last period`;
      salesGrowth.className = 'stat-change text-danger';
    }
  }
  
  updateCharts(chartData) {
    // Sales trend chart
    this.updateSalesTrendChart(chartData.salesTrend);
    
    // Metal distribution chart
    this.updateMetalDistributionChart(chartData.metalDistribution);
    
    // Payment mode chart
    this.updatePaymentModeChart(chartData.paymentModes);
  }
  
  updateSalesTrendChart(data) {
    const ctx = document.getElementById('salesTrendChart');
    if (!ctx) return;
    
    if (this.charts.salesTrend) {
      this.charts.salesTrend.destroy();
    }
    
    this.charts.salesTrend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Sales (₹)',
          data: data.values,
          borderColor: '#D4AF37',
          backgroundColor: 'rgba(212, 175, 55, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => `₹${context.raw.toLocaleString()}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => `₹${value.toLocaleString()}`
            }
          }
        }
      }
    });
  }
  
  updateMetalDistributionChart(data) {
    const ctx = document.getElementById('metalDistributionChart');
    if (!ctx) return;
    
    const metals = Object.keys(data);
    const values = Object.values(data);
    
    // Colors for different metals
    const colors = {
      'Gold': '#FFD700',
      'Silver': '#C0C0C0',
      'Diamond': '#B9F2FF',
      'Platinum': '#E5E4E2',
      'Antique / Polki': '#CD7F32',
      'Others': '#6C757D'
    };
    
    const backgroundColors = metals.map(metal => colors[metal] || '#6C757D');
    
    if (this.charts.metalDistribution) {
      this.charts.metalDistribution.destroy();
    }
    
    this.charts.metalDistribution = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: metals,
        datasets: [{
          data: values,
          backgroundColor: backgroundColors,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right'
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.raw;
                const total = values.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${context.label}: ₹${value.toLocaleString()} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }
  
  updatePaymentModeChart(data) {
    const ctx = document.getElementById('paymentModeChart');
    if (!ctx) return;
    
    const modes = Object.keys(data);
    const counts = Object.values(data);
    
    const colors = {
      'cash': '#28a745',
      'card': '#007bff',
      'upi': '#6f42c1',
      'bank_transfer': '#17a2b8',
      'credit': '#fd7e14'
    };
    
    const backgroundColors = modes.map(mode => colors[mode] || '#6C757D');
    
    if (this.charts.paymentMode) {
      this.charts.paymentMode.destroy();
    }
    
    this.charts.paymentMode = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: modes.map(mode => mode.charAt(0).toUpperCase() + mode.slice(1)),
        datasets: [{
          data: counts,
          backgroundColor: backgroundColors,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right'
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.raw;
                const total = counts.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${context.label}: ${value} bills (${percentage}%)`;
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
    
    let html = '';
    
    bills.forEach(bill => {
      const date = new Date(bill.billDate).toLocaleDateString();
      const time = new Date(bill.billDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      html += `
        <tr onclick="window.adminDashboard.showBillDetails('${bill._id}')" style="cursor: pointer;">
          <td><strong>${bill.billNumber}</strong></td>
          <td>${bill.customer.name}</td>
          <td>₹${bill.summary.grandTotal.toLocaleString()}</td>
          <td>${date}<br><small>${time}</small></td>
          <td>
            <span class="badge ${this.getPaymentModeClass(bill.paymentMode)}">
              ${bill.paymentMode.toUpperCase()}
            </span>
          </td>
          <td>
            <span class="status-badge status-success">Paid</span>
          </td>
        </tr>
      `;
    });
    
    tbody.innerHTML = html || '<tr><td colspan="6" class="text-center">No recent bills</td></tr>';
  }
  
  updateAIInsights(insights) {
    const container = document.getElementById('aiInsights');
    if (!container) return;
    
    const timeElement = document.getElementById('insightTime');
    if (timeElement) {
      timeElement.textContent = `Generated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    container.innerHTML = `
      <div class="insight-section">
        <h4><i class="fas fa-chart-line"></i> Performance Summary</h4>
        <p>${insights.summary || 'No insights available for the selected period.'}</p>
      </div>
      
      <div class="insight-section">
        <h4><i class="fas fa-lightbulb"></i> Recommendations</h4>
        <ul>
          ${(insights.recommendations || []).map(rec => `<li>${rec}</li>`).join('')}
        </ul>
      </div>
      
      ${insights.risks ? `
        <div class="insight-section">
          <h4><i class="fas fa-exclamation-triangle"></i> Areas for Improvement</h4>
          <p>${insights.risks}</p>
        </div>
      ` : ''}
    `;
  }
  
  async showRatesModal() {
    const modal = document.getElementById('ratesModal');
    if (!modal) return;
    
    try {
      const response = await fetch(`${this.apiBase}/rates`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.populateRatesTable(data.rates);
        modal.classList.add('show');
      }
    } catch (error) {
      console.error('Load rates error:', error);
      this.showAlert('danger', 'Failed to load rates');
    }
  }
  
  populateRatesTable(rates) {
    const tbody = document.getElementById('ratesTableBody');
    if (!tbody) return;
    
    let html = '';
    
    rates.forEach((rate, index) => {
      const lastUpdated = new Date(rate.lastUpdated).toLocaleDateString();
      const updatedBy = rate.updatedBy?.name || 'System';
      
      html += `
        <tr data-rate-id="${rate._id}">
          <td>${rate.metalType}</td>
          <td>${rate.purity}</td>
          <td>
            <input type="number" class="form-control rate-input" 
                   value="${rate.rate}" 
                   data-original="${rate.rate}"
                   step="0.01" min="0"
                   onchange="window.adminDashboard.onRateChange('${rate._id}', this.value)">
          </td>
          <td>${rate.unit}</td>
          <td>
            <span class="badge ${rate.gstApplicable ? 'badge-primary' : 'badge-secondary'}">
              ${rate.gstApplicable ? 'GST Applicable' : 'No GST'}
            </span>
          </td>
          <td>
            <div class="btn-group">
              <button class="btn btn-sm btn-success" 
                      onclick="window.adminDashboard.saveRate('${rate._id}')"
                      style="display: none;">
                <i class="fas fa-check"></i>
              </button>
              <button class="btn btn-sm btn-warning" 
                      onclick="window.adminDashboard.toggleRateStatus('${rate._id}', ${!rate.isActive})">
                <i class="fas fa-power-off"></i>
              </button>
              <button class="btn btn-sm btn-danger" 
                      onclick="window.adminDashboard.deleteRate('${rate._id}')">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });
    
    tbody.innerHTML = html || '<tr><td colspan="6" class="text-center">No rates found</td></tr>';
  }
  
  onRateChange(rateId, newValue) {
    const row = document.querySelector(`[data-rate-id="${rateId}"]`);
    if (!row) return;
    
    const saveBtn = row.querySelector('.btn-success');
    const input = row.querySelector('.rate-input');
    const originalValue = parseFloat(input.dataset.original);
    
    if (parseFloat(newValue) !== originalValue) {
      saveBtn.style.display = 'inline-block';
    } else {
      saveBtn.style.display = 'none';
    }
  }
  
  async saveRate(rateId) {
    const row = document.querySelector(`[data-rate-id="${rateId}"]`);
    if (!row) return;
    
    const input = row.querySelector('.rate-input');
    const newRate = parseFloat(input.value);
    
    if (isNaN(newRate) || newRate < 0) {
      this.showAlert('warning', 'Please enter a valid rate');
      return;
    }
    
    try {
      const response = await fetch(`${this.apiBase}/rates/${rateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ rate: newRate })
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.showAlert('success', 'Rate updated successfully');
        input.dataset.original = newRate;
        row.querySelector('.btn-success').style.display = 'none';
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Save rate error:', error);
      this.showAlert('danger', error.message || 'Failed to update rate');
    }
  }
  
  async toggleRateStatus(rateId, newStatus) {
    try {
      const response = await fetch(`${this.apiBase}/rates/${rateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ isActive: newStatus })
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.showAlert('success', `Rate ${newStatus ? 'activated' : 'deactivated'} successfully`);
        this.showRatesModal(); // Refresh the modal
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Toggle rate status error:', error);
      this.showAlert('danger', error.message || 'Failed to update rate status');
    }
  }
  
  async deleteRate(rateId) {
    if (!confirm('Are you sure you want to delete this rate? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`${this.apiBase}/rates/${rateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.showAlert('success', 'Rate deleted successfully');
        this.showRatesModal(); // Refresh the modal
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Delete rate error:', error);
      this.showAlert('danger', error.message || 'Failed to delete rate');
    }
  }
  
  async showUsersModal() {
    const modal = document.getElementById('usersModal');
    if (!modal) return;
    
    try {
      const response = await fetch(`${this.apiBase}/auth/users`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.populateUsersTable(data.users);
        modal.classList.add('show');
      }
    } catch (error) {
      console.error('Load users error:', error);
      this.showAlert('danger', 'Failed to load users');
    }
  }
  
  populateUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    let html = '';
    
    users.forEach(user => {
      const createdAt = new Date(user.createdAt).toLocaleDateString();
      
      html += `
        <tr>
          <td>
            <strong>${user.name}</strong>
            ${user._id === window.auth.getUser()?.id ? '<span class="badge badge-primary ml-1">You</span>' : ''}
          </td>
          <td>${user.email}</td>
          <td>
            <span class="badge ${this.getRoleClass(user.role)}">
              ${user.role.toUpperCase()}
            </span>
          </td>
          <td>${user.mobile || 'N/A'}</td>
          <td>
            <span class="status-badge ${user.isActive ? 'status-success' : 'status-danger'}">
              ${user.isActive ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td>
            <div class="btn-group">
              <button class="btn btn-sm btn-warning" 
                      onclick="window.adminDashboard.editUser('${user._id}')">
                <i class="fas fa-edit"></i>
              </button>
              ${user._id !== window.auth.getUser()?.id ? `
                <button class="btn btn-sm btn-danger" 
                        onclick="window.adminDashboard.deleteUser('${user._id}')">
                  <i class="fas fa-trash"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    });
    
    tbody.innerHTML = html || '<tr><td colspan="6" class="text-center">No users found</td></tr>';
  }
  
  async showBillDetails(billId) {
    const modal = document.getElementById('billDetailsModal');
    if (!modal) return;
    
    try {
      const response = await fetch(`${this.apiBase}/bills/${billId}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.populateBillDetails(data.bill);
        modal.classList.add('show');
      }
    } catch (error) {
      console.error('Load bill details error:', error);
      this.showAlert('danger', 'Failed to load bill details');
    }
  }
  
  populateBillDetails(bill) {
    document.getElementById('billDetailNumber').textContent = bill.billNumber;
    document.getElementById('billDetailDate').textContent = new Date(bill.billDate).toLocaleString();
    document.getElementById('billDetailCustomer').textContent = bill.customer.name;
    document.getElementById('billDetailMobile').textContent = bill.customer.mobile;
    document.getElementById('billDetailAddress').textContent = bill.customer.address || 'N/A';
    document.getElementById('billDetailTotal').textContent = `₹${bill.summary.grandTotal.toLocaleString()}`;
    document.getElementById('billDetailPayment').textContent = bill.paymentMode.toUpperCase();
    
    // Populate items
    const itemsTbody = document.getElementById('billDetailItems');
    let itemsHtml = '';
    
    bill.items.forEach(item => {
      if (!item.isExchange) {
        itemsHtml += `
          <tr>
            <td>${item.product || 'N/A'}</td>
            <td>${item.metalType} ${item.purity}</td>
            <td>${item.ntWt?.toFixed(3)} g</td>
            <td>₹${item.totalValue?.toFixed(2)}</td>
          </tr>
        `;
      }
    });
    
    itemsTbody.innerHTML = itemsHtml;
    
    // Show exchange details if any
    const exchangeSection = document.getElementById('billDetailExchange');
    const exchangeItems = bill.items.filter(item => item.isExchange);
    
    if (exchangeItems.length > 0) {
      const exchangeValue = exchangeItems.reduce((sum, item) => sum + (item.totalValue || 0), 0);
      const balance = bill.summary.grandTotal >= 0 ? 
        `₹${bill.summary.grandTotal.toLocaleString()} Payable` : 
        `₹${Math.abs(bill.summary.grandTotal).toLocaleString()} Refundable`;
      
      document.getElementById('billDetailOldItems').textContent = `₹${exchangeValue.toLocaleString()}`;
      document.getElementById('billDetailBalance').textContent = balance;
      exchangeSection.style.display = 'block';
    } else {
      exchangeSection.style.display = 'none';
    }
  }
  
  async exportSalesData() {
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
        a.download = `sales-export-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        this.showAlert('success', 'Sales data exported successfully');
      }
    } catch (error) {
      console.error('Export sales error:', error);
      this.showAlert('danger', 'Failed to export sales data');
    }
  }
  
  async exportCustomersData() {
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
        a.download = `customers-export-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        this.showAlert('success', 'Customers data exported successfully');
      }
    } catch (error) {
      console.error('Export customers error:', error);
      this.showAlert('danger', 'Failed to export customers data');
    }
  }
  
  getPaymentModeClass(mode) {
    const classes = {
      'cash': 'badge-success',
      'card': 'badge-primary',
      'upi': 'badge-info',
      'bank_transfer': 'badge-warning',
      'credit': 'badge-danger'
    };
    return classes[mode] || 'badge-secondary';
  }
  
  getRoleClass(role) {
    const classes = {
      'admin': 'badge-danger',
      'staff': 'badge-primary',
      'viewer': 'badge-secondary'
    };
    return classes[role] || 'badge-secondary';
  }
  
  showLoading(show) {
    const loading = document.getElementById('dashboardLoading');
    const content = document.getElementById('dashboardContent');
    
    if (loading) loading.style.display = show ? 'flex' : 'none';
    if (content) content.style.opacity = show ? '0.5' : '1';
  }
  
  showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="close" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    const container = document.getElementById('alertContainer');
    if (container) {
      container.appendChild(alertDiv);
      
      setTimeout(() => {
        if (alertDiv.parentElement) {
          alertDiv.remove();
        }
      }, 5000);
    }
  }
}

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', () => {
  if (window.auth && window.auth.isAuthenticated() && window.auth.isAdmin()) {
    window.adminDashboard = new AdminDashboard();
  }
});
