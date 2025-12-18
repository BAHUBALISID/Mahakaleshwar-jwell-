// Admin Management JavaScript
class AdminManager {
    constructor() {
        this.apiBase = window.location.origin.includes('localhost') 
            ? 'http://localhost:5000/api' 
            : '/api';
        this.currentRates = null;
        this.rateHistory = [];
    }
    
    // Initialize admin functions
    async initialize() {
        if (!authManager.checkAuth()) return false;
        
        // Load current rates
        await this.loadCurrentRates();
        
        // Load rate history
        await this.loadRateHistory();
        
        // Load shop details
        await this.loadShopDetails();
        
        // Set up event listeners
        this.setupEventListeners();
        
        return true;
    }
    
    // Load current rates
    async loadCurrentRates() {
        try {
            const response = await fetch(`${this.apiBase}/rates/current`, {
                headers: authManager.getAuthHeaders()
            });
            
            const data = await response.json();
            
            if (data.success && data.rates) {
                this.currentRates = data.rates;
                this.displayCurrentRates();
            }
        } catch (error) {
            console.error('Error loading rates:', error);
        }
    }
    
    // Display current rates in form
    displayCurrentRates() {
        if (!this.currentRates) return;
        
        // Update form fields
        document.getElementById('gold24K').value = this.currentRates.gold24K;
        document.getElementById('gold22K').value = this.currentRates.gold22K;
        document.getElementById('gold18K').value = this.currentRates.gold18K;
        document.getElementById('silver999').value = this.currentRates.silver999;
        document.getElementById('silver925').value = this.currentRates.silver925;
        
        // Update display
        this.updateRateDisplay();
    }
    
    // Update rate display with per gram values
    updateRateDisplay() {
        if (!this.currentRates) return;
        
        document.getElementById('gold24KDisplay').textContent = 
            `₹${this.formatNumber(this.currentRates.gold24K)}/kg (₹${(this.currentRates.gold24K / 1000).toFixed(2)}/g)`;
        
        document.getElementById('gold22KDisplay').textContent = 
            `₹${this.formatNumber(this.currentRates.gold22K)}/kg (₹${(this.currentRates.gold22K / 1000).toFixed(2)}/g)`;
        
        document.getElementById('gold18KDisplay').textContent = 
            `₹${this.formatNumber(this.currentRates.gold18K)}/kg (₹${(this.currentRates.gold18K / 1000).toFixed(2)}/g)`;
        
        document.getElementById('silver999Display').textContent = 
            `₹${this.formatNumber(this.currentRates.silver999)}/kg (₹${(this.currentRates.silver999 / 1000).toFixed(2)}/g)`;
        
        document.getElementById('silver925Display').textContent = 
            `₹${this.formatNumber(this.currentRates.silver925)}/kg (₹${(this.currentRates.silver925 / 1000).toFixed(2)}/g)`;
    }
    
    // Format number with Indian commas
    formatNumber(num) {
        return new Intl.NumberFormat('en-IN').format(num);
    }
    
    // Load rate history
    async loadRateHistory(page = 1) {
        try {
            const response = await fetch(`${this.apiBase}/rates/history?page=${page}&limit=10`, {
                headers: authManager.getAuthHeaders()
            });
            
            const data = await response.json();
            
            if (data.success && data.rates) {
                this.rateHistory = data.rates;
                this.displayRateHistory(data);
            }
        } catch (error) {
            console.error('Error loading rate history:', error);
        }
    }
    
    // Display rate history
    displayRateHistory(data) {
        const tbody = document.querySelector('#rateHistoryTable tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        data.rates.forEach(rate => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(rate.createdAt).toLocaleString()}</td>
                <td>₹${this.formatNumber(rate.gold24K)}</td>
                <td>₹${this.formatNumber(rate.gold22K)}</td>
                <td>₹${this.formatNumber(rate.gold18K)}</td>
                <td>₹${this.formatNumber(rate.silver999)}</td>
                <td>₹${this.formatNumber(rate.silver925)}</td>
                <td>${new Date(rate.lastUpdated).toLocaleDateString()}</td>
            `;
            tbody.appendChild(row);
        });
        
        // Update pagination
        this.updatePagination(data);
    }
    
    // Update pagination
    updatePagination(data) {
        const pagination = document.getElementById('pagination');
        if (!pagination) return;
        
        pagination.innerHTML = '';
        
        const totalPages = data.totalPages;
        const currentPage = data.currentPage;
        
        // Previous button
        if (currentPage > 1) {
            const prevBtn = document.createElement('button');
            prevBtn.className = 'btn btn-secondary';
            prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
            prevBtn.onclick = () => this.loadRateHistory(currentPage - 1);
            pagination.appendChild(prevBtn);
        }
        
        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `btn ${i === currentPage ? 'btn-primary' : 'btn-secondary'}`;
            pageBtn.textContent = i;
            pageBtn.onclick = () => this.loadRateHistory(i);
            pagination.appendChild(pageBtn);
        }
        
        // Next button
        if (currentPage < totalPages) {
            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn btn-secondary';
            nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
            nextBtn.onclick = () => this.loadRateHistory(currentPage + 1);
            pagination.appendChild(nextBtn);
        }
    }
    
    // Load shop details
    async loadShopDetails() {
        try {
            const user = authManager.user;
            
            if (user) {
                document.getElementById('shopName').value = user.shopName || '';
                document.getElementById('address').value = user.address || '';
                document.getElementById('gstin').value = user.gstin || '';
                document.getElementById('phone').value = user.phone || '';
                document.getElementById('email').value = user.email || '';
            }
        } catch (error) {
            console.error('Error loading shop details:', error);
        }
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Update rates button
        const updateRatesBtn = document.getElementById('updateRates');
        if (updateRatesBtn) {
            updateRatesBtn.addEventListener('click', () => this.updateRates());
        }
        
        // Update shop details button
        const updateShopBtn = document.getElementById('updateShopDetails');
        if (updateShopBtn) {
            updateShopBtn.addEventListener('click', () => updateShopDetails());
        }
        
        // Report type change
        const reportType = document.getElementById('reportType');
        if (reportType) {
            reportType.addEventListener('change', (e) => this.handleReportTypeChange(e.target.value));
        }
        
        // Generate report button
        const generateReportBtn = document.getElementById('generateReport');
        if (generateReportBtn) {
            generateReportBtn.addEventListener('click', () => this.generateReport());
        }
        
        // Export report button
        const exportReportBtn = document.getElementById('exportReport');
        if (exportReportBtn) {
            exportReportBtn.addEventListener('click', () => this.exportReport());
        }
    }
    
    // Update rates
    async updateRates() {
        const gold24K = parseFloat(document.getElementById('gold24K').value);
        const gold22K = parseFloat(document.getElementById('gold22K').value);
        const gold18K = parseFloat(document.getElementById('gold18K').value);
        const silver999 = parseFloat(document.getElementById('silver999').value);
        const silver925 = parseFloat(document.getElementById('silver925').value);
        
        // Validation
        if (!gold24K || gold24K <= 0) {
            alert('Please enter valid Gold 24K rate');
            return;
        }
        
        if (!gold22K || gold22K <= 0) {
            alert('Please enter valid Gold 22K rate');
            return;
        }
        
        if (!silver999 || silver999 <= 0) {
            alert('Please enter valid Silver 999 rate');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/rates`, {
                method: 'POST',
                headers: authManager.getAuthHeaders(),
                body: JSON.stringify({
                    gold24K,
                    gold22K,
                    gold18K,
                    silver999,
                    silver925
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('Rates updated successfully!');
                this.currentRates = data.rates;
                this.updateRateDisplay();
                // Reload rate history
                await this.loadRateHistory();
            } else {
                alert('Error updating rates: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error updating rates:', error);
            alert('Error updating rates. Please try again.');
        }
    }
    
    // Handle report type change
    handleReportTypeChange(reportType) {
        const dailyReportDiv = document.getElementById('dailyReportConfig');
        const monthlyReportDiv = document.getElementById('monthlyReportConfig');
        const customReportDiv = document.getElementById('customReportConfig');
        
        // Hide all first
        dailyReportDiv.style.display = 'none';
        monthlyReportDiv.style.display = 'none';
        customReportDiv.style.display = 'none';
        
        // Show selected
        switch(reportType) {
            case 'daily':
                dailyReportDiv.style.display = 'block';
                break;
            case 'monthly':
                monthlyReportDiv.style.display = 'block';
                break;
            case 'custom':
                customReportDiv.style.display = 'block';
                break;
        }
    }
    
    // Generate report
    async generateReport() {
        const reportType = document.getElementById('reportType').value;
        
        switch(reportType) {
            case 'daily':
                await this.generateDailyReport();
                break;
            case 'monthly':
                await this.generateMonthlyReport();
                break;
            case 'custom':
                await this.generateCustomReport();
                break;
        }
    }
    
    // Generate daily report
    async generateDailyReport() {
        const date = document.getElementById('reportDate').value;
        
        if (!date) {
            alert('Please select a date');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/reports/daily?date=${date}`, {
                headers: authManager.getAuthHeaders()
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.displayDailyReport(data);
            } else {
                alert('Error generating report: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error generating daily report:', error);
            alert('Error generating report. Please try again.');
        }
    }
    
    // Generate monthly report
    async generateMonthlyReport() {
        const year = document.getElementById('reportYear').value;
        const month = document.getElementById('reportMonth').value;
        
        if (!year || !month) {
            alert('Please select year and month');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/reports/monthly?year=${year}&month=${month}`, {
                headers: authManager.getAuthHeaders()
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.displayMonthlyReport(data);
            } else {
                alert('Error generating report: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error generating monthly report:', error);
            alert('Error generating report. Please try again.');
        }
    }
    
    // Generate custom report
    async generateCustomReport() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        
        if (!startDate || !endDate) {
            alert('Please select start and end dates');
            return;
        }
        
        if (new Date(startDate) > new Date(endDate)) {
            alert('Start date cannot be after end date');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/reports/sales-summary?startDate=${startDate}&endDate=${endDate}`, {
                headers: authManager.getAuthHeaders()
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.displayCustomReport(data);
            } else {
                alert('Error generating report: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error generating custom report:', error);
            alert('Error generating report. Please try again.');
        }
    }
    
    // Display daily report
    displayDailyReport(data) {
        const reportResult = document.getElementById('reportResult');
        
        let html = `
            <h3>Daily Report - ${new Date(data.date).toLocaleDateString()}</h3>
            <div class="report-summary">
                <h4>Summary</h4>
                <div class="summary-grid">
                    <div class="summary-item">
                        <span class="summary-label">Total Bills:</span>
                        <span class="summary-value">${data.summary.totalBills}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Total Sales:</span>
                        <span class="summary-value">₹${this.formatNumber(data.summary.totalSales)}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Exchange Value:</span>
                        <span class="summary-value">₹${this.formatNumber(data.summary.totalExchangeValue)}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Net Payable:</span>
                        <span class="summary-value">₹${this.formatNumber(data.summary.totalNetPayable)}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Paid Amount:</span>
                        <span class="summary-value">₹${this.formatNumber(data.summary.totalPaid)}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Due Amount:</span>
                        <span class="summary-value">₹${this.formatNumber(data.summary.totalDue)}</span>
                    </div>
                </div>
            </div>
        `;
        
        // Bill type breakdown
        if (data.summary.byBillType) {
            html += `
                <div class="report-section">
                    <h4>Bill Type Breakdown</h4>
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>Bill Type</th>
                                <th>Count</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            Object.entries(data.summary.byBillType).forEach(([type, count]) => {
                html += `
                    <tr>
                        <td>${type}</td>
                        <td>${count}</td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        reportResult.innerHTML = html;
    }
    
    // Display monthly report
    displayMonthlyReport(data) {
        const reportResult = document.getElementById('reportResult');
        
        let html = `
            <h3>Monthly Report - ${data.month}/${data.year}</h3>
        `;
        
        if (data.summary) {
            html += `
                <div class="report-summary">
                    <h4>Summary</h4>
                    <div class="summary-grid">
                        <div class="summary-item">
                            <span class="summary-label">Total Bills:</span>
                            <span class="summary-value">${data.summary.totalBills || 0}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Total Sales:</span>
                            <span class="summary-value">₹${this.formatNumber(data.summary.totalSales || 0)}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Net Payable:</span>
                            <span class="summary-value">₹${this.formatNumber(data.summary.totalNetPayable || 0)}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Average Bill Value:</span>
                            <span class="summary-value">₹${this.formatNumber(data.summary.avgBillValue || 0)}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Daily data chart
        if (data.dailyData && data.dailyData.length > 0) {
            html += `
                <div class="report-section">
                    <h4>Daily Sales Trend</h4>
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>Day</th>
                                <th>Bills</th>
                                <th>Sales</th>
                                <th>Net Payable</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            data.dailyData.forEach(day => {
                html += `
                    <tr>
                        <td>${day._id.day}</td>
                        <td>${day.count}</td>
                        <td>₹${this.formatNumber(day.totalSales)}</td>
                        <td>₹${this.formatNumber(day.totalNetPayable)}</td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        reportResult.innerHTML = html;
    }
    
    // Display custom report
    displayCustomReport(data) {
        const reportResult = document.getElementById('reportResult');
        
        let html = `
            <h3>Custom Report</h3>
        `;
        
        if (data.summary) {
            html += `
                <div class="report-summary">
                    <h4>Summary</h4>
                    <div class="summary-grid">
                        <div class="summary-item">
                            <span class="summary-label">Total Bills:</span>
                            <span class="summary-value">${data.summary.totalBills || 0}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Total Sales:</span>
                            <span class="summary-value">₹${this.formatNumber(data.summary.totalSales || 0)}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Metal Value:</span>
                            <span class="summary-value">₹${this.formatNumber(data.summary.totalMetalValue || 0)}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Making Charge:</span>
                            <span class="summary-value">₹${this.formatNumber(data.summary.totalMakingCharge || 0)}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Tax Collected:</span>
                            <span class="summary-value">₹${this.formatNumber(data.summary.totalTax || 0)}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Net Payable:</span>
                            <span class="summary-value">₹${this.formatNumber(data.summary.totalNetPayable || 0)}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Paid Amount:</span>
                            <span class="summary-value">₹${this.formatNumber(data.summary.totalPaid || 0)}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Due Amount:</span>
                            <span class="summary-value">₹${this.formatNumber(data.summary.totalDue || 0)}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Bill type breakdown
        if (data.billTypeBreakdown && data.billTypeBreakdown.length > 0) {
            html += `
                <div class="report-section">
                    <h4>Bill Type Breakdown</h4>
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>Bill Type</th>
                                <th>Count</th>
                                <th>Total Value</th>
                                <th>Average Value</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            data.billTypeBreakdown.forEach(type => {
                html += `
                    <tr>
                        <td>${type._id}</td>
                        <td>${type.count}</td>
                        <td>₹${this.formatNumber(type.totalValue)}</td>
                        <td>₹${this.formatNumber(type.avgValue)}</td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        reportResult.innerHTML = html;
    }
    
    // Export report
    exportReport() {
        const reportResult = document.getElementById('reportResult');
        if (!reportResult.innerHTML.trim()) {
            alert('No report to export. Please generate a report first.');
            return;
        }
        
        // Create a new window with the report content for printing
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Report Export</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h2 { color: #333; }
                    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 20px 0; }
                    .summary-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
                </style>
            </head>
            <body>
                <h2>Shri Mahakaleshwar Jewellers - Report</h2>
                <p>Generated on: ${new Date().toLocaleString()}</p>
                ${reportResult.innerHTML}
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }
}

// Initialize admin manager when page loads
document.addEventListener('DOMContentLoaded', async () => {
    window.adminManager = new AdminManager();
    await adminManager.initialize();
    
    // Set default dates for reports
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('reportDate').value = today;
    document.getElementById('startDate').value = today;
    document.getElementById('endDate').value = today;
    
    // Set current year and month
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    document.getElementById('reportYear').value = currentYear;
    document.getElementById('reportMonth').value = currentMonth;
});
