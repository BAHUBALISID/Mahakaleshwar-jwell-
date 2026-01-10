class App {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || '{}');
        this.init();
    }

    async init() {
        // Check authentication
        if (!this.token || !this.user._id) {
            window.location.href = 'login.html';
            return;
        }

        // Update UI with user info
        this.updateUserInfo();
        
        // Set up real-time clock
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);
        
        // Load dashboard data
        await this.loadDashboardData();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize charts if on dashboard
        if (window.location.pathname.includes('index.html')) {
            this.initializeDashboardCharts();
        }
    }

    updateUserInfo() {
        const userNameElement = document.getElementById('userName');
        const userRoleElement = document.getElementById('userRole');
        
        if (userNameElement) {
            userNameElement.textContent = this.user.name || 'User';
        }
        
        if (userRoleElement) {
            userRoleElement.textContent = this.user.role ? this.user.role.toUpperCase() : 'USER';
        }
    }

    updateClock() {
        const timeElement = document.getElementById('currentTime');
        if (timeElement) {
            const now = new Date();
            timeElement.textContent = now.toLocaleTimeString('en-IN', {
                hour12: true,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
    }

    async loadDashboardData() {
        try {
            const response = await fetch('/api/reports/overview', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            
            if (data.success) {
                this.updateDashboardStats(data.stats);
                this.updateRecentBills(data.recentBills || []);
                
                // Update charts if they exist
                if (this.salesChart && data.dailyTrend) {
                    this.updateSalesChart(data.dailyTrend);
                }
                
                if (this.metalChart && data.metalSales) {
                    this.updateMetalChart(data.metalSales);
                }
            }
        } catch (error) {
            console.error('Load dashboard data error:', error);
        }
    }

    updateDashboardStats(stats) {
        const elements = {
            'todaySales': stats.todaySales,
            'todayBills': stats.todayBills,
            'todayExchanges': stats.todayExchanges,
            'lowStockItems': stats.lowStockItems,
            'totalSales': stats.monthSales,
            'totalBills': stats.totalBills || 0,
            'totalGST': stats.totalGST || 0,
            'totalExchange': stats.totalExchange || 0
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                if (id.includes('Sales') || id.includes('GST') || id.includes('Exchange')) {
                    element.textContent = `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                } else {
                    element.textContent = value.toLocaleString('en-IN');
                }
            }
        });

        // Update sales change indicator
        const salesChange = document.getElementById('salesChange');
        if (salesChange && stats.salesChange !== undefined) {
            const change = stats.salesChange;
            salesChange.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
            salesChange.className = `stat-change ${change >= 0 ? 'positive' : 'negative'}`;
        }
    }

    updateRecentBills(bills) {
        const tbody = document.getElementById('recentBillsBody');
        if (!tbody) return;

        if (!bills || bills.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">No recent bills</td>
                </tr>
            `;
            return;
        }

        // Use first 5 bills
        const recentBills = bills.slice(0, 5);
        
        tbody.innerHTML = recentBills.map(bill => `
            <tr>
                <td>${bill.billNumber}</td>
                <td>${bill.customerName}</td>
                <td>${new Date(bill.billDate).toLocaleDateString('en-IN')}</td>
                <td>₹${bill.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td>
                    <span class="badge ${bill.paymentStatus === 'paid' ? 'badge-success' : 
                        bill.paymentStatus === 'pending' ? 'badge-warning' : 'badge-info'}">
                        ${bill.paymentStatus}
                    </span>
                </td>
                <td>${bill.items?.length || 0}</td>
                <td>
                    <button class="btn-action" onclick="window.open('/api/bills/${bill._id}/pdf', '_blank')">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    initializeDashboardCharts() {
        // Initialize sales chart
        const salesCtx = document.getElementById('salesChart');
        if (salesCtx) {
            this.salesChart = new Chart(salesCtx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Daily Sales (₹)',
                        data: [],
                        borderColor: '#D4AF37',
                        backgroundColor: 'rgba(212, 175, 55, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#B8860B',
                        pointBorderColor: '#FFFFFF',
                        pointBorderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                color: '#FFFFFF',
                                font: {
                                    size: 12
                                }
                            }
                        },
                        title: {
                            display: true,
                            text: 'Sales Trend',
                            color: '#D4AF37',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#CCCCCC'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#CCCCCC',
                                callback: function(value) {
                                    return '₹' + value.toLocaleString('en-IN');
                                }
                            }
                        }
                    }
                }
            });
        }

        // Initialize metal chart
        const metalCtx = document.getElementById('metalChart');
        if (metalCtx) {
            this.metalChart = new Chart(metalCtx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#D4AF37', // Gold
                            '#C0C0C0', // Silver
                            '#1E90FF', // Diamond
                            '#FFD700', // Platinum
                            '#B8860B', // Other Gold
                            '#CD7F32'  // Other
                        ],
                        borderColor: '#000000',
                        borderWidth: 1,
                        hoverOffset: 15
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                color: '#FFFFFF',
                                padding: 20,
                                font: {
                                    size: 11
                                }
                            }
                        },
                        title: {
                            display: true,
                            text: 'Metal Distribution',
                            color: '#D4AF37',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        }
                    }
                }
            });
        }
    }

    updateSalesChart(dailyTrend) {
        if (!this.salesChart || !dailyTrend) return;

        const labels = dailyTrend.map(day => {
            const date = new Date(day.date);
            return date.toLocaleDateString('en-IN', { weekday: 'short' });
        });
        
        const data = dailyTrend.map(day => day.dailySales);

        this.salesChart.data.labels = labels;
        this.salesChart.data.datasets[0].data = data;
        this.salesChart.update();
    }

    updateMetalChart(metalSales) {
        if (!this.metalChart || !metalSales) return;

        const labels = metalSales.map(item => item.metal);
        const data = metalSales.map(item => item.value);

        this.metalChart.data.labels = labels;
        this.metalChart.data.datasets[0].data = data;
        this.metalChart.update();
    }

    setupEventListeners() {
        // Logout button
        const logoutBtn = document.querySelector('.btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }

        // Refresh button
        const refreshBtn = document.querySelector('.btn-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadDashboardData();
            });
        }

        // Navigation active state
        this.setupNavigation();
    }

    setupNavigation() {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (currentPath.includes(href) && href !== 'index.html') {
                link.classList.add('active');
            }
        });
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }

    // Global alert function
    static showAlert(message, type = 'info') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="close" onclick="this.parentElement.remove()">
                &times;
            </button>
        `;
        
        const container = document.querySelector('.main-content') || document.body;
        container.insertBefore(alertDiv, container.firstChild);
        
        setTimeout(() => {
            if (alertDiv.parentElement) {
                alertDiv.remove();
            }
        }, 5000);
    }

    // Global loading indicator
    static showLoading(show, elementId = null) {
        if (show) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading-overlay';
            loadingDiv.innerHTML = `
                <div class="spinner">
                    <div class="spinner-border text-warning" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p>Loading...</p>
                </div>
            `;
            loadingDiv.id = 'globalLoading';
            
            const target = elementId ? document.getElementById(elementId) : document.body;
            if (target) {
                target.appendChild(loadingDiv);
            }
        } else {
            const loadingDiv = document.getElementById('globalLoading');
            if (loadingDiv) {
                loadingDiv.remove();
            }
        }
    }

    // Format currency
    static formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount);
    }

    // Format date
    static formatDate(date, format = 'dd/mm/yyyy') {
        const d = new Date(date);
        
        switch (format) {
            case 'dd/mm/yyyy':
                return d.toLocaleDateString('en-IN');
            case 'dd-mm-yyyy':
                return d.toLocaleDateString('en-IN').replace(/\//g, '-');
            case 'full':
                return d.toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            default:
                return d.toLocaleDateString('en-IN');
        }
    }

    // Validate phone number
    static validatePhone(phone) {
        const phoneRegex = /^[6-9]\d{9}$/;
        return phoneRegex.test(phone);
    }

    // Validate email
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Debounce function
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Throttle function
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
