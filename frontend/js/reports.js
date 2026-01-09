class ReportsSystem {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || '{}');
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadReportFilters();
        await this.loadDefaultReport();
        this.initializeCharts();
    }

    setupEventListeners() {
        // Report type switching
        document.querySelectorAll('.report-type').forEach(type => {
            type.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchReportType(type.dataset.type);
            });
        });

        // Date filters
        document.getElementById('applyFilter').addEventListener('click', () => this.loadReport());
        document.getElementById('resetFilter').addEventListener('click', () => this.resetFilters());

        // Export buttons
        document.getElementById('exportPdf').addEventListener('click', () => this.exportPDF());
        document.getElementById('exportExcel').addEventListener('click', () => this.exportExcel());
        document.getElementById('printReport').addEventListener('click', () => this.printReport());

        // AI analysis
        document.getElementById('analyzeBtn').addEventListener('click', () => this.runAIAnalysis());
        document.getElementById('refreshAI').addEventListener('click', () => this.runAIAnalysis());
    }

    switchReportType(type) {
        // Update active class
        document.querySelectorAll('.report-type').forEach(t => {
            t.classList.remove('active');
        });
        document.querySelector(`.report-type[data-type="${type}"]`).classList.add('active');

        // Update report title
        document.getElementById('reportTitle').textContent = this.getReportTitle(type);

        // Show/hide relevant filters
        this.updateFiltersForType(type);

        // Load report
        this.currentReportType = type;
        this.loadReport();
    }

    getReportTitle(type) {
        const titles = {
            'sales': 'Sales Report',
            'stock': 'Stock Report',
            'gst': 'GST Report',
            'exchange': 'Exchange Report',
            'customer': 'Customer Report',
            'profit': 'Profit & Loss Report'
        };
        return titles[type] || 'Report';
    }

    updateFiltersForType(type) {
        const filters = {
            'sales': ['dateRange', 'metalType', 'purity', 'customer'],
            'stock': ['stockType', 'metalType', 'lowStock'],
            'gst': ['dateRange', 'gstType'],
            'exchange': ['dateRange', 'metalType'],
            'customer': ['customer', 'dateRange'],
            'profit': ['dateRange', 'metalType']
        };

        // Hide all filter groups first
        document.querySelectorAll('.filter-group').forEach(group => {
            group.style.display = 'none';
        });

        // Show relevant filters
        if (filters[type]) {
            filters[type].forEach(filter => {
                const element = document.querySelector(`.filter-group[data-filter="${filter}"]`);
                if (element) {
                    element.style.display = 'block';
                }
            });
        }
    }

    async loadReportFilters() {
        try {
            // Load metal types
            const ratesResponse = await fetch('/api/rates/active', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const ratesData = await ratesResponse.json();

            if (ratesData.success) {
                this.populateMetalFilter(ratesData.rates);
            }

            // Load customers (recent)
            const customersResponse = await fetch('/api/bills?limit=100', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const customersData = await customersResponse.json();

            if (customersData.success) {
                this.populateCustomerFilter(customersData.bills);
            }

            // Set default dates
            this.setDefaultDates();

        } catch (error) {
            console.error('Load filters error:', error);
        }
    }

    populateMetalFilter(rates) {
        const metalSelect = document.getElementById('metalTypeFilter');
        metalSelect.innerHTML = '<option value="">All Metals</option>';

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
    }

    populateCustomerFilter(bills) {
        const customerSelect = document.getElementById('customerFilter');
        customerSelect.innerHTML = '<option value="">All Customers</option>';

        const customers = new Map();
        bills.forEach(bill => {
            if (bill.customerName && !customers.has(bill.customerPhone)) {
                customers.set(bill.customerPhone, bill.customerName);
            }
        });

        customers.forEach((name, phone) => {
            const option = document.createElement('option');
            option.value = phone;
            option.textContent = `${name} (${phone})`;
            customerSelect.appendChild(option);
        });
    }

    setDefaultDates() {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        
        document.getElementById('startDate').value = firstDay.toISOString().split('T')[0];
        document.getElementById('endDate').value = today.toISOString().split('T')[0];
    }

    async loadDefaultReport() {
        this.currentReportType = 'sales';
        await this.loadReport();
    }

    async loadReport() {
        const reportType = this.currentReportType || 'sales';
        const filters = this.getCurrentFilters();

        // Show loading
        this.showLoading(true);

        try {
            let endpoint = '';
            let queryParams = new URLSearchParams(filters).toString();

            switch (reportType) {
                case 'sales':
                    endpoint = `/api/reports/sales?${queryParams}`;
                    break;
                case 'stock':
                    endpoint = `/api/reports/stock?${queryParams}`;
                    break;
                case 'gst':
                    endpoint = `/api/reports/gst?${queryParams}`;
                    break;
                case 'exchange':
                    endpoint = `/api/reports/exchange?${queryParams}`;
                    break;
                default:
                    endpoint = `/api/reports/sales?${queryParams}`;
            }

            const response = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();

            if (data.success) {
                this.displayReport(data.report, reportType);
                this.updateCharts(data.report, reportType);
                this.updateSummary(data.report);
            } else {
                this.showError('Failed to load report: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Load report error:', error);
            this.showError('Error loading report. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    getCurrentFilters() {
        const filters = {
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value,
            reportType: this.currentReportType
        };

        // Add optional filters based on report type
        const metalType = document.getElementById('metalTypeFilter').value;
        if (metalType) filters.metalType = metalType;

        const purity = document.getElementById('purityFilter').value;
        if (purity) filters.purity = purity;

        const customer = document.getElementById('customerFilter').value;
        if (customer) filters.customerPhone = customer;

        const stockType = document.getElementById('stockTypeFilter').value;
        if (stockType) filters.stockType = stockType;

        const lowStockOnly = document.getElementById('lowStockFilter').checked;
        if (lowStockOnly) filters.lowStockOnly = 'true';

        const gstType = document.getElementById('gstTypeFilter').value;
        if (gstType) filters.gstType = gstType;

        return filters;
    }

    displayReport(report, type) {
        this.updateReportTable(report, type);
        this.updateReportSummary(report);
        this.updateReportDetails(report);
    }

    updateReportTable(report, type) {
        const tableBody = document.getElementById('reportTableBody');
        if (!tableBody) return;

        let rows = '';

        switch (type) {
            case 'sales':
                if (report.bills && report.bills.length > 0) {
                    rows = report.bills.map(bill => `
                        <tr>
                            <td>${bill.billNumber}</td>
                            <td>${new Date(bill.billDate).toLocaleDateString('en-IN')}</td>
                            <td>${bill.customerName}</td>
                            <td>${bill.items.length}</td>
                            <td>₹${bill.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td>₹${bill.totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td>₹${bill.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td>
                                <span class="badge ${bill.paymentStatus === 'paid' ? 'badge-success' : 'badge-warning'}">
                                    ${bill.paymentStatus}
                                </span>
                            </td>
                            <td>
                                <button class="btn-action" onclick="window.open('/api/bills/${bill._id}/pdf', '_blank')">
                                    <i class="fas fa-file-pdf"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }
                break;

            case 'stock':
                if (report.stock && report.stock.length > 0) {
                    rows = report.stock.map(item => `
                        <tr>
                            <td>${item.metalType}</td>
                            <td>${item.purity}</td>
                            <td>${item.productName}</td>
                            <td>${item.quantity}</td>
                            <td>${item.weight.toFixed(3)}g</td>
                            <td>₹${item.costPrice ? item.costPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</td>
                            <td>₹${item.sellingReferencePrice ? item.sellingReferencePrice.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</td>
                            <td>
                                <span class="badge ${item.isLowStock ? 'badge-danger' : 'badge-success'}">
                                    ${item.isLowStock ? 'Low' : 'Normal'}
                                </span>
                            </td>
                            <td>
                                <button class="btn-action" onclick="viewStockHistory('${item._id}')">
                                    <i class="fas fa-history"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }
                break;

            case 'gst':
                if (report.bills && report.bills.length > 0) {
                    rows = report.bills.map(bill => `
                        <tr>
                            <td>${bill.billNumber}</td>
                            <td>${new Date(bill.billDate).toLocaleDateString('en-IN')}</td>
                            <td>${bill.customerName}</td>
                            <td>₹${bill.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td>₹${bill.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td>₹${bill.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td>₹${bill.totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td>₹${bill.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                    `).join('');
                }
                break;

            case 'exchange':
                if (report.bills && report.bills.length > 0) {
                    rows = report.bills.map(bill => `
                        <tr>
                            <td>${bill.billNumber}</td>
                            <td>${new Date(bill.billDate).toLocaleDateString('en-IN')}</td>
                            <td>${bill.customerName}</td>
                            <td>${bill.exchangeItems}</td>
                            <td>₹${bill.exchangeValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td>₹${bill.deduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td>
                                <button class="btn-action" onclick="window.open('/api/bills/${bill._id}/pdf', '_blank')">
                                    <i class="fas fa-file-pdf"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }
                break;
        }

        if (!rows) {
            rows = `
                <tr>
                    <td colspan="9" class="text-center">No data found for the selected filters</td>
                </tr>
            `;
        }

        tableBody.innerHTML = rows;
    }

    updateReportSummary(report) {
        const summaryContainer = document.getElementById('reportSummary');
        if (!summaryContainer) return;

        let summaryHTML = '';

        if (report.summary) {
            const summary = report.summary;
            summaryHTML = `
                <div class="summary-item">
                    <div class="summary-label">Total Bills</div>
                    <div class="summary-value">${summary.totalBills || 0}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Sales</div>
                    <div class="summary-value">₹${(summary.totalSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total GST</div>
                    <div class="summary-value">₹${(summary.totalGST || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Exchange Deduction</div>
                    <div class="summary-value">₹${(summary.totalDeduction || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
            `;
        } else if (report.totalValue) {
            // For stock report
            summaryHTML = `
                <div class="summary-item">
                    <div class="summary-label">Total Items</div>
                    <div class="summary-value">${report.totalItems || 0}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Value</div>
                    <div class="summary-value">₹${(report.totalValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Low Stock Items</div>
                    <div class="summary-value">${report.lowStockCount || 0}</div>
                </div>
            `;
        }

        summaryContainer.innerHTML = summaryHTML;
    }

    updateReportDetails(report) {
        const detailsContainer = document.getElementById('reportDetails');
        if (!detailsContainer) return;

        let detailsHTML = '';

        if (report.metalBreakdown && report.metalBreakdown.length > 0) {
            detailsHTML = `
                <h4>Metal-wise Breakdown</h4>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Metal Type</th>
                                <th>Purity</th>
                                <th>Weight (g)</th>
                                <th>Value (₹)</th>
                                <th>Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${report.metalBreakdown.map(item => `
                                <tr>
                                    <td>${item.metalType}</td>
                                    <td>${item.purity || '-'}</td>
                                    <td>${item.totalWeight ? item.totalWeight.toFixed(3) : '0.000'}</td>
                                    <td>₹${(item.totalValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td>${item.contributionPercentage ? item.contributionPercentage.toFixed(1) + '%' : '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        if (report.dailyTrend && report.dailyTrend.length > 0) {
            detailsHTML += `
                <h4 style="margin-top: 2rem;">Daily Trend</h4>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Bills</th>
                                <th>Sales (₹)</th>
                                <th>GST (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${report.dailyTrend.map(day => `
                                <tr>
                                    <td>${day.date}</td>
                                    <td>${day.billCount || 0}</td>
                                    <td>₹${(day.dailySales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td>₹${((day.dailySales || 0) * 0.03).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        detailsContainer.innerHTML = detailsHTML;
    }

    initializeCharts() {
        // Sales Chart
        const salesCtx = document.getElementById('salesChart');
        if (salesCtx) {
            this.salesChart = new Chart(salesCtx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Daily Sales',
                        data: [],
                        borderColor: '#D4AF37',
                        backgroundColor: 'rgba(212, 175, 55, 0.1)',
                        tension: 0.4,
                        fill: true
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
                            text: 'Sales Trend'
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

        // Metal Chart
        const metalCtx = document.getElementById('metalChart');
        if (metalCtx) {
            this.metalChart = new Chart(metalCtx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#D4AF37',
                            '#C0C0C0',
                            '#1E90FF',
                            '#FFD700',
                            '#B8860B',
                            '#CD7F32'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'right',
                        },
                        title: {
                            display: true,
                            text: 'Metal Distribution'
                        }
                    }
                }
            });
        }
    }

    updateCharts(report, type) {
        if (type === 'sales' && report.dailyTrend) {
            this.updateSalesChart(report.dailyTrend);
        }

        if (report.metalBreakdown) {
            this.updateMetalChart(report.metalBreakdown);
        }
    }

    updateSalesChart(dailyTrend) {
        if (!this.salesChart) return;

        const labels = dailyTrend.map(day => day.date);
        const data = dailyTrend.map(day => day.dailySales || 0);

        this.salesChart.data.labels = labels;
        this.salesChart.data.datasets[0].data = data;
        this.salesChart.update();
    }

    updateMetalChart(metalBreakdown) {
        if (!this.metalChart) return;

        const labels = metalBreakdown.map(item => `${item.metalType} ${item.purity || ''}`.trim());
        const data = metalBreakdown.map(item => item.totalValue || 0);

        this.metalChart.data.labels = labels;
        this.metalChart.data.datasets[0].data = data;
        this.metalChart.update();
    }

    updateSummary(report) {
        // Update key metrics display
        const metrics = {
            'totalSales': report.summary?.totalSales || 0,
            'totalBills': report.summary?.totalBills || 0,
            'totalGST': report.summary?.totalGST || 0,
            'avgBillValue': report.summary?.avgBillValue || 0
        };

        Object.keys(metrics).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (key.includes('Sales') || key.includes('GST') || key.includes('Value')) {
                    element.textContent = '₹' + metrics[key].toLocaleString('en-IN', { minimumFractionDigits: 2 });
                } else {
                    element.textContent = metrics[key].toLocaleString('en-IN');
                }
            }
        });
    }

    async runAIAnalysis() {
        const analyzeBtn = document.getElementById('analyzeBtn');
        const insightsContainer = document.getElementById('aiInsights');

        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
        insightsContainer.innerHTML = '<div class="loading">Analyzing data...</div>';

        try {
            const filters = this.getCurrentFilters();
            const queryParams = new URLSearchParams(filters).toString();

            const response = await fetch(`/api/ai/insights?${queryParams}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();

            if (data.success) {
                this.displayAIIntights(data.insights);
            } else {
                insightsContainer.innerHTML = `
                    <div class="alert alert-danger">
                        Failed to generate insights: ${data.error || 'Unknown error'}
                    </div>
                `;
            }
        } catch (error) {
            console.error('AI analysis error:', error);
            insightsContainer.innerHTML = `
                <div class="alert alert-danger">
                    Error generating insights. Please try again.
                </div>
            `;
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<i class="fas fa-brain"></i> AI Analyze';
        }
    }

    displayAIIntights(insights) {
        const container = document.getElementById('aiInsights');
        
        let html = `
            <div class="ai-section">
                <h4><i class="fas fa-chart-line"></i> Executive Summary</h4>
                <div class="ai-content">
        `;

        if (insights.executiveSummary) {
            const summary = insights.executiveSummary;
            html += `
                <p><strong>Period:</strong> ${summary.period || 'N/A'}</p>
                <p><strong>Total Sales:</strong> ₹${(summary.totalSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                <p><strong>Average Bill Value:</strong> ₹${(summary.avgBillValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                <p><strong>Exchange Rate:</strong> ${(summary.exchangePercentage || 0).toFixed(1)}%</p>
                <p><strong>Peak Hour:</strong> ${summary.peakHour || 'N/A'}</p>
            `;
        }

        html += '</div></div>';

        // Risk Alerts
        if (insights.riskAlerts && insights.riskAlerts.length > 0) {
            html += `
                <div class="ai-section">
                    <h4><i class="fas fa-exclamation-triangle"></i> Risk Alerts</h4>
                    <div class="ai-content">
            `;

            insights.riskAlerts.forEach(alert => {
                html += `
                    <div class="alert alert-${alert.severity === 'HIGH' ? 'danger' : alert.severity === 'MEDIUM' ? 'warning' : 'info'}">
                        <strong>${alert.type}:</strong> ${alert.message}<br>
                        <small>Suggestion: ${alert.suggestion}</small>
                    </div>
                `;
            });

            html += '</div></div>';
        }

        // Recommendations
        if (insights.recommendations && insights.recommendations.length > 0) {
            html += `
                <div class="ai-section">
                    <h4><i class="fas fa-lightbulb"></i> Recommendations</h4>
                    <div class="ai-content">
            `;

            insights.recommendations.forEach(rec => {
                html += `
                    <div class="alert alert-${rec.priority === 'HIGH' ? 'danger' : rec.priority === 'MEDIUM' ? 'warning' : 'info'}">
                        <strong>${rec.type}:</strong> ${rec.message}<br>
                        <small>Action: ${rec.action}</small>
                    </div>
                `;
            });

            html += '</div></div>';
        }

        // Metal Performance
        if (insights.metalPerformance) {
            html += `
                <div class="ai-section">
                    <h4><i class="fas fa-gem"></i> Top Performing Metals</h4>
                    <div class="ai-content">
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Metal</th>
                                        <th>Sales (₹)</th>
                                        <th>Weight (g)</th>
                                        <th>Contribution</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;

            Object.entries(insights.metalPerformance).forEach(([metal, stats]) => {
                html += `
                    <tr>
                        <td>${metal}</td>
                        <td>₹${(stats.totalValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td>${(stats.totalWeight || 0).toFixed(3)}g</td>
                        <td>${(stats.contributionPercentage || 0).toFixed(1)}%</td>
                    </tr>
                `;
            });

            html += '</tbody></table></div></div></div>';
        }

        container.innerHTML = html;
    }

    async exportPDF() {
        const exportBtn = document.getElementById('exportPdf');
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

        try {
            const filters = this.getCurrentFilters();
            const queryParams = new URLSearchParams({
                ...filters,
                format: 'pdf'
            }).toString();

            const response = await fetch(`/api/reports/export?${queryParams}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `SMJ_Report_${new Date().toISOString().split('T')[0]}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            } else {
                this.showError('Failed to generate PDF');
            }
        } catch (error) {
            console.error('Export PDF error:', error);
            this.showError('Error generating PDF');
        } finally {
            exportBtn.disabled = false;
            exportBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Export PDF';
        }
    }

    async exportExcel() {
        const exportBtn = document.getElementById('exportExcel');
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

        try {
            const filters = this.getCurrentFilters();
            const queryParams = new URLSearchParams({
                ...filters,
                format: 'excel'
            }).toString();

            const response = await fetch(`/api/reports/export?${queryParams}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `SMJ_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            } else {
                this.showError('Failed to generate Excel');
            }
        } catch (error) {
            console.error('Export Excel error:', error);
            this.showError('Error generating Excel');
        } finally {
            exportBtn.disabled = false;
            exportBtn.innerHTML = '<i class="fas fa-file-excel"></i> Export Excel';
        }
    }

    printReport() {
        window.print();
    }

    resetFilters() {
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        document.getElementById('metalTypeFilter').value = '';
        document.getElementById('purityFilter').value = '';
        document.getElementById('customerFilter').value = '';
        document.getElementById('stockTypeFilter').value = 'all';
        document.getElementById('lowStockFilter').checked = false;
        document.getElementById('gstTypeFilter').value = 'all';

        this.setDefaultDates();
        this.loadReport();
    }

    showLoading(show) {
        const loading = document.getElementById('reportLoading');
        const content = document.getElementById('reportContent');

        if (show) {
            loading.style.display = 'block';
            content.style.display = 'none';
        } else {
            loading.style.display = 'none';
            content.style.display = 'block';
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger alert-dismissible';
        errorDiv.innerHTML = `
            ${message}
            <button type="button" class="close" onclick="this.parentElement.remove()">&times;</button>
        `;
        
        const container = document.querySelector('.main-content') || document.body;
        container.insertBefore(errorDiv, container.firstChild);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}

// Global functions
function viewStockHistory(stockId) {
    window.location.href = `stocks.html?view=${stockId}`;
}

// Initialize reports system
let reportsSystem;
document.addEventListener('DOMContentLoaded', () => {
    reportsSystem = new ReportsSystem();
});
