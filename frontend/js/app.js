// Main Application Module

class JewelleryApp {
    constructor() {
        this.apiBase = 'http://localhost:5000/api';
        this.init();
    }

    init() {
        this.setupServiceWorker();
        this.setupOfflineDetection();
        this.setupGlobalEventListeners();
        this.checkForUpdates();
        this.setupErrorHandling();
    }

    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                })
                .catch(error => {
                    console.log('Service Worker registration failed:', error);
                });
        }
    }

    setupOfflineDetection() {
        // Update online/offline status
        const updateOnlineStatus = () => {
            const isOnline = navigator.onLine;
            document.body.classList.toggle('offline', !isOnline);
            
            if (!isOnline) {
                this.showOfflineNotification();
            } else {
                this.hideOfflineNotification();
            }
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus(); // Initial check
    }

    showOfflineNotification() {
        // Create or show offline notification
        let notification = document.getElementById('offlineNotification');
        
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'offlineNotification';
            notification.className = 'alert alert-warning';
            notification.innerHTML = `
                <i class="fas fa-wifi-slash"></i>
                You are currently offline. Some features may be limited.
                <button class="close" onclick="this.parentElement.remove()">&times;</button>
            `;
            document.body.prepend(notification);
        }
    }

    hideOfflineNotification() {
        const notification = document.getElementById('offlineNotification');
        if (notification) {
            notification.remove();
        }
    }

    setupGlobalEventListeners() {
        // Handle all fetch errors globally
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            try {
                const response = await originalFetch(...args);
                
                // Handle 401 Unauthorized (token expired)
                if (response.status === 401) {
                    window.auth.logout();
                    return response;
                }
                
                // Handle 403 Forbidden
                if (response.status === 403) {
                    showAlert('danger', 'Access denied. Insufficient permissions.');
                    return response;
                }
                
                return response;
            } catch (error) {
                console.error('Fetch error:', error);
                
                if (!navigator.onLine) {
                    showAlert('warning', 'You are offline. Please check your internet connection.');
                } else {
                    showAlert('danger', 'Network error. Please try again.');
                }
                
                throw error;
            }
        };
    }

    checkForUpdates() {
        // Check for app updates
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.update();
            });
        }
    }

    setupErrorHandling() {
        // Global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            
            // Don't show alert for minor errors
            if (event.error instanceof TypeError && event.message.includes('fetch')) {
                return; // Network errors are handled elsewhere
            }
            
            // Show user-friendly error message
            showAlert('danger', 'An unexpected error occurred. Please refresh the page.');
        });

        // Unhandled promise rejection
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
        });
    }

    // Utility function to format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount);
    }

    // Utility function to format date
    formatDate(date, includeTime = false) {
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };
        
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }
        
        return new Date(date).toLocaleDateString('en-IN', options);
    }

    // Utility function to validate mobile number
    validateMobile(mobile) {
        const mobileRegex = /^[6-9]\d{9}$/;
        return mobileRegex.test(mobile);
    }

    // Utility function to validate email
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Utility function to validate PAN
    validatePAN(pan) {
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        return panRegex.test(pan);
    }

    // Utility function to validate Aadhaar
    validateAadhaar(aadhaar) {
        const aadhaarRegex = /^\d{12}$/;
        return aadhaarRegex.test(aadhaar);
    }

    // Show loading overlay
    showLoading(container) {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="spinner"></div>
            <p>Loading...</p>
        `;
        
        if (container) {
            container.style.position = 'relative';
            container.appendChild(overlay);
        } else {
            document.body.appendChild(overlay);
        }
        
        return overlay;
    }

    // Hide loading overlay
    hideLoading(overlay) {
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }

    // Confirm dialog
    confirmDialog(message, confirmCallback, cancelCallback) {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h5>Confirm</h5>
                    <button type="button" class="close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary cancel-btn">Cancel</button>
                    <button type="button" class="btn btn-primary confirm-btn">Confirm</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close handlers
        const closeModal = () => {
            document.body.removeChild(modal);
        };
        
        modal.querySelector('.close').addEventListener('click', closeModal);
        modal.querySelector('.cancel-btn').addEventListener('click', () => {
            closeModal();
            if (cancelCallback) cancelCallback();
        });
        
        modal.querySelector('.confirm-btn').addEventListener('click', () => {
            closeModal();
            if (confirmCallback) confirmCallback();
        });
        
        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
                if (cancelCallback) cancelCallback();
            }
        });
    }

    // Export data to CSV
    exportToCSV(data, filename) {
        if (!data || data.length === 0) {
            showAlert('warning', 'No data to export');
            return;
        }
        
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => {
                const cell = row[header];
                // Escape quotes and wrap in quotes if contains comma
                return typeof cell === 'string' && cell.includes(',') ?
                    `"${cell.replace(/"/g, '""')}"` : cell;
            }).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Print HTML content
    printHTML(htmlContent) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Print</title>
                <link rel="stylesheet" href="css/print.css">
                <style>
                    body { font-family: Arial, sans-serif; }
                    @media print { 
                        @page { margin: 0; }
                        body { margin: 1.6cm; }
                    }
                </style>
            </head>
            <body>
                ${htmlContent}
            </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
        
        // Wait for content to load
        printWindow.onload = () => {
            printWindow.print();
            printWindow.close();
        };
    }

    // Generate QR code
    generateQRCode(text, size = 200) {
        return new Promise((resolve) => {
            try {
                // Using simple QR code generation
                const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
                resolve(qrCodeUrl);
            } catch (error) {
                console.error('QR generation error:', error);
                resolve(null);
            }
        });
    }

    // Calculate age from date of birth
    calculateAge(dob) {
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        return age;
    }

    // Check if today is customer's birthday
    isBirthday(dob) {
        if (!dob) return false;
        
        const birthDate = new Date(dob);
        const today = new Date();
        
        return birthDate.getDate() === today.getDate() &&
               birthDate.getMonth() === today.getMonth();
    }

    // Apply birthday discount
    applyBirthdayDiscount(total, dob) {
        if (this.isBirthday(dob)) {
            const discount = total * 0.05; // 5% birthday discount
            return {
                discountedTotal: total - discount,
                discount: discount,
                message: 'Happy Birthday! 5% discount applied.'
            };
        }
        
        return {
            discountedTotal: total,
            discount: 0,
            message: ''
        };
    }
}

// Initialize main app
document.addEventListener('DOMContentLoaded', () => {
    window.jewelleryApp = new JewelleryApp();
    
    // Initialize tooltips
    if (typeof bootstrap !== 'undefined') {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    }
    
    // Initialize popovers
    if (typeof bootstrap !== 'undefined') {
        const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
        popoverTriggerList.map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl));
    }
    
    // Auto-hide alerts after 5 seconds
    setTimeout(() => {
        document.querySelectorAll('.alert:not(.alert-permanent)').forEach(alert => {
            alert.remove();
        });
    }, 5000);
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Only register shortcuts when not in input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
    }
    
    // Ctrl/Cmd + N: New bill
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (window.location.pathname.includes('billing.html')) {
            window.billingSystem.clearForm();
        } else if (window.auth.isStaff()) {
            window.location.href = 'billing.html';
        }
    }
    
    // Ctrl/Cmd + P: Print
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        if (window.location.pathname.includes('billing.html') && window.currentBill) {
            window.billingSystem.printBill();
        }
    }
    
    // Ctrl/Cmd + S: Save/Search
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="search"], #searchInput');
        if (searchInput) {
            searchInput.focus();
        }
    }
    
    // F1: Help
    if (e.key === 'F1') {
        e.preventDefault();
        showAlert('info', `
            <strong>Keyboard Shortcuts:</strong><br>
            Ctrl+N: New Bill<br>
            Ctrl+P: Print Bill<br>
            Ctrl+S: Search<br>
            F1: This help
        `);
    }
    
    // Escape: Close modals
    if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal.show');
        if (openModal) {
            openModal.classList.remove('show');
        }
    }
});
