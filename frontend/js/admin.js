class AdminSystem {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (this.user.role !== 'admin') {
            window.location.href = 'index.html';
            return;
        }
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadDashboardStats();
        await this.loadRates();
        await this.loadUsers();
        await this.loadSystemLogs();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-link').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchTab(tab.dataset.tab);
            });
        });

        // Rate management
        document.getElementById('addRateBtn').addEventListener('click', () => this.showRateModal());
        document.getElementById('saveRateBtn').addEventListener('click', () => this.saveRate());
        document.getElementById('rateForm').addEventListener('submit', (e) => e.preventDefault());

        // User management
        document.getElementById('addUserBtn').addEventListener('click', () => this.showUserModal());
        document.getElementById('saveUserBtn').addEventListener('click', () => this.saveUser());
        document.getElementById('userForm').addEventListener('submit', (e) => e.preventDefault());

        // Backup actions
        document.getElementById('backupBtn').addEventListener('click', () => this.createBackup());
        document.getElementById('restoreBtn').addEventListener('click', () => this.restoreBackup());
        document.getElementById('clearCacheBtn').addEventListener('click', () => this.clearCache());

        // System settings
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSystemSettings());
        document.getElementById('settingsForm').addEventListener('submit', (e) => e.preventDefault());
    }

    switchTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // Remove active class from all tab links
        document.querySelectorAll('.tab-link').forEach(tab => {
            tab.classList.remove('active');
        });

        // Show selected tab
        document.getElementById(`${tabName}Tab`).classList.add('active');
        
        // Activate tab link
        document.querySelector(`.tab-link[data-tab="${tabName}"]`).classList.add('active');

        // Load tab specific data
        switch(tabName) {
            case 'rates':
                this.loadRates();
                break;
            case 'users':
                this.loadUsers();
                break;
            case 'logs':
                this.loadSystemLogs();
                break;
            case 'backup':
                this.loadBackupInfo();
                break;
        }
    }

    async loadDashboardStats() {
        try {
            const response = await fetch('/api/reports/overview', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            if (data.success) {
                this.updateDashboardStats(data.stats);
            }
        } catch (error) {
            console.error('Load dashboard stats error:', error);
        }
    }

    updateDashboardStats(stats) {
        document.getElementById('totalBills').textContent = stats.totalBills?.toLocaleString() || '0';
        document.getElementById('totalSales').textContent = `₹${(stats.totalSales || 0).toLocaleString('en-IN')}`;
        document.getElementById('totalGST').textContent = `₹${(stats.totalGST || 0).toLocaleString('en-IN')}`;
        document.getElementById('activeUsers').textContent = stats.activeUsers?.toLocaleString() || '0';
        document.getElementById('stockValue').textContent = `₹${(stats.stockValue || 0).toLocaleString('en-IN')}`;
        document.getElementById('exchangeCount').textContent = stats.exchangeCount?.toLocaleString() || '0';
    }

    async loadRates() {
        try {
            const response = await fetch('/api/rates', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            if (data.success) {
                this.updateRatesTable(data.rates);
            }
        } catch (error) {
            console.error('Load rates error:', error);
        }
    }

    updateRatesTable(rates) {
        const tbody = document.getElementById('ratesTableBody');
        if (!tbody) return;

        if (rates.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">No rates configured</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = rates.map(rate => `
            <tr data-id="${rate._id}">
                <td>${rate.metalType}</td>
                <td>${rate.purity}</td>
                <td>₹${rate.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td>
                    <span class="badge ${rate.gstApplicable ? 'badge-success' : 'badge-secondary'}">
                        ${rate.gstApplicable ? 'Yes' : 'No'}
                    </span>
                </td>
                <td>
                    <span class="badge ${rate.isActive ? 'badge-success' : 'badge-danger'}">
                        ${rate.isActive ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <button class="btn-action btn-edit" onclick="adminSystem.editRate('${rate._id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-delete" onclick="adminSystem.toggleRateStatus('${rate._id}', ${!rate.isActive})">
                        <i class="fas fa-${rate.isActive ? 'ban' : 'check'}"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async loadUsers() {
        try {
            const response = await fetch('/api/auth/users', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            if (data.success) {
                this.updateUsersTable(data.users);
            }
        } catch (error) {
            console.error('Load users error:', error);
        }
    }

    updateUsersTable(users) {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        // Filter out current user
        const filteredUsers = users.filter(user => user._id !== this.user._id);

        if (filteredUsers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">No other users found</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filteredUsers.map(user => `
            <tr data-id="${user._id}">
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.phone}</td>
                <td>
                    <span class="badge ${user.role === 'admin' ? 'badge-danger' : user.role === 'manager' ? 'badge-warning' : 'badge-info'}">
                        ${user.role.toUpperCase()}
                    </span>
                </td>
                <td>
                    <span class="badge ${user.isActive ? 'badge-success' : 'badge-danger'}">
                        ${user.isActive ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    ${new Date(user.lastLogin).toLocaleDateString('en-IN')}
                </td>
                <td>
                    <button class="btn-action btn-edit" onclick="adminSystem.editUser('${user._id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-delete" onclick="adminSystem.toggleUserStatus('${user._id}', ${!user.isActive})">
                        <i class="fas fa-${user.isActive ? 'ban' : 'check'}"></i>
                    </button>
                    <button class="btn-action btn-reset" onclick="adminSystem.resetUserPassword('${user._id}')">
                        <i class="fas fa-key"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async loadSystemLogs() {
        try {
            const response = await fetch('/api/admin/logs', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            if (data.success) {
                this.updateLogsTable(data.logs);
            }
        } catch (error) {
            console.error('Load logs error:', error);
        }
    }

    updateLogsTable(logs) {
        const tbody = document.getElementById('logsTableBody');
        if (!tbody) return;

        if (logs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">No logs found</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = logs.map(log => `
            <tr>
                <td>${new Date(log.timestamp).toLocaleString('en-IN')}</td>
                <td>
                    <span class="badge ${log.level === 'error' ? 'badge-danger' : log.level === 'warning' ? 'badge-warning' : 'badge-info'}">
                        ${log.level.toUpperCase()}
                    </span>
                </td>
                <td>${log.user}</td>
                <td>${log.action}</td>
                <td>${log.details || '-'}</td>
            </tr>
        `).join('');
    }

    async loadBackupInfo() {
        try {
            const response = await fetch('/api/admin/backup-info', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            if (data.success) {
                this.updateBackupInfo(data.info);
            }
        } catch (error) {
            console.error('Load backup info error:', error);
        }
    }

    updateBackupInfo(info) {
        document.getElementById('lastBackup').textContent = 
            info.lastBackup ? new Date(info.lastBackup).toLocaleString('en-IN') : 'Never';
        document.getElementById('backupSize').textContent = 
            info.backupSize ? this.formatBytes(info.backupSize) : '0 MB';
        document.getElementById('dbSize').textContent = 
            info.dbSize ? this.formatBytes(info.dbSize) : '0 MB';
        document.getElementById('backupCount').textContent = 
            info.backupCount || '0';
    }

    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    showRateModal(rate = null) {
        const modal = document.getElementById('rateModal');
        const title = document.getElementById('rateModalTitle');
        const form = document.getElementById('rateForm');

        if (rate) {
            title.textContent = 'Edit Rate';
            form.dataset.id = rate._id;
            document.getElementById('metalType').value = rate.metalType;
            document.getElementById('purity').value = rate.purity;
            document.getElementById('rateValue').value = rate.rate;
            document.getElementById('gstApplicable').checked = rate.gstApplicable;
            document.getElementById('gstPercentage').value = rate.gstPercentage || 3;
            document.getElementById('isActive').checked = rate.isActive;
        } else {
            title.textContent = 'Add New Rate';
            form.dataset.id = '';
            form.reset();
            document.getElementById('gstApplicable').checked = true;
            document.getElementById('gstPercentage').value = 3;
            document.getElementById('isActive').checked = true;
        }

        modal.style.display = 'block';
    }

    async saveRate() {
        const form = document.getElementById('rateForm');
        const id = form.dataset.id;
        const saveBtn = document.getElementById('saveRateBtn');

        const rateData = {
            metalType: document.getElementById('metalType').value,
            purity: document.getElementById('purity').value,
            rate: parseFloat(document.getElementById('rateValue').value),
            gstApplicable: document.getElementById('gstApplicable').checked,
            gstPercentage: parseFloat(document.getElementById('gstPercentage').value) || 3,
            isActive: document.getElementById('isActive').checked
        };

        // Validation
        if (!rateData.metalType || !rateData.purity || !rateData.rate) {
            this.showAlert('Please fill all required fields', 'danger');
            return;
        }

        if (rateData.rate <= 0) {
            this.showAlert('Rate must be greater than 0', 'danger');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            const url = id ? `/api/rates/${id}` : '/api/rates';
            const method = id ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(rateData)
            });

            const data = await response.json();

            if (data.success) {
                this.showAlert(`Rate ${id ? 'updated' : 'added'} successfully`, 'success');
                this.closeModal('rateModal');
                await this.loadRates();
            } else {
                this.showAlert(data.error || 'Failed to save rate', 'danger');
            }
        } catch (error) {
            console.error('Save rate error:', error);
            this.showAlert('Error saving rate', 'danger');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Rate';
        }
    }

    async toggleRateStatus(rateId, isActive) {
        if (!confirm(`Are you sure you want to ${isActive ? 'activate' : 'deactivate'} this rate?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/rates/${rateId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ isActive })
            });

            const data = await response.json();
            if (data.success) {
                this.showAlert(`Rate ${isActive ? 'activated' : 'deactivated'} successfully`, 'success');
                await this.loadRates();
            } else {
                this.showAlert(data.error || 'Failed to update rate status', 'danger');
            }
        } catch (error) {
            console.error('Toggle rate status error:', error);
            this.showAlert('Error updating rate status', 'danger');
        }
    }

    async editRate(rateId) {
        try {
            const response = await fetch(`/api/rates/${rateId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            if (data.success) {
                this.showRateModal(data.rate);
            }
        } catch (error) {
            console.error('Edit rate error:', error);
            this.showAlert('Error loading rate details', 'danger');
        }
    }

    showUserModal(user = null) {
        const modal = document.getElementById('userModal');
        const title = document.getElementById('userModalTitle');
        const form = document.getElementById('userForm');

        if (user) {
            title.textContent = 'Edit User';
            form.dataset.id = user._id;
            document.getElementById('userName').value = user.name;
            document.getElementById('userEmail').value = user.email;
            document.getElementById('userPhone').value = user.phone;
            document.getElementById('userRole').value = user.role;
            document.getElementById('userActive').checked = user.isActive;
            document.getElementById('passwordFields').style.display = 'none';
        } else {
            title.textContent = 'Add New User';
            form.dataset.id = '';
            form.reset();
            document.getElementById('userRole').value = 'sales';
            document.getElementById('userActive').checked = true;
            document.getElementById('passwordFields').style.display = 'block';
        }

        modal.style.display = 'block';
    }

    async saveUser() {
        const form = document.getElementById('userForm');
        const id = form.dataset.id;
        const saveBtn = document.getElementById('saveUserBtn');

        const userData = {
            name: document.getElementById('userName').value,
            email: document.getElementById('userEmail').value,
            phone: document.getElementById('userPhone').value,
            role: document.getElementById('userRole').value,
            isActive: document.getElementById('userActive').checked
        };

        // Add password for new users
        if (!id) {
            userData.password = document.getElementById('userPassword').value;
            userData.confirmPassword = document.getElementById('userConfirmPassword').value;

            if (userData.password !== userData.confirmPassword) {
                this.showAlert('Passwords do not match', 'danger');
                return;
            }

            if (userData.password.length < 6) {
                this.showAlert('Password must be at least 6 characters', 'danger');
                return;
            }
        }

        // Validation
        if (!userData.name || !userData.email || !userData.phone) {
            this.showAlert('Please fill all required fields', 'danger');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            const url = id ? `/api/auth/users/${id}` : '/api/auth/register';
            const method = id ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (data.success) {
                this.showAlert(`User ${id ? 'updated' : 'added'} successfully`, 'success');
                this.closeModal('userModal');
                await this.loadUsers();
            } else {
                this.showAlert(data.error || 'Failed to save user', 'danger');
            }
        } catch (error) {
            console.error('Save user error:', error);
            this.showAlert('Error saving user', 'danger');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save User';
        }
    }

    async toggleUserStatus(userId, isActive) {
        if (!confirm(`Are you sure you want to ${isActive ? 'activate' : 'deactivate'} this user?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/auth/users/${userId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ isActive })
            });

            const data = await response.json();
            if (data.success) {
                this.showAlert(`User ${isActive ? 'activated' : 'deactivated'} successfully`, 'success');
                await this.loadUsers();
            } else {
                this.showAlert(data.error || 'Failed to update user status', 'danger');
            }
        } catch (error) {
            console.error('Toggle user status error:', error);
            this.showAlert('Error updating user status', 'danger');
        }
    }

    async editUser(userId) {
        try {
            const response = await fetch(`/api/auth/users/${userId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            if (data.success) {
                this.showUserModal(data.user);
            }
        } catch (error) {
            console.error('Edit user error:', error);
            this.showAlert('Error loading user details', 'danger');
        }
    }

    async resetUserPassword(userId) {
        if (!confirm('Are you sure you want to reset this user\'s password? They will receive a temporary password.')) {
            return;
        }

        try {
            const response = await fetch(`/api/auth/users/${userId}/reset-password`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();
            if (data.success) {
                this.showAlert('Password reset successfully. Temporary password has been generated.', 'success');
            } else {
                this.showAlert(data.error || 'Failed to reset password', 'danger');
            }
        } catch (error) {
            console.error('Reset password error:', error);
            this.showAlert('Error resetting password', 'danger');
        }
    }

    async createBackup() {
        if (!confirm('Are you sure you want to create a backup? This may take a few moments.')) {
            return;
        }

        const backupBtn = document.getElementById('backupBtn');
        backupBtn.disabled = true;
        backupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Backup...';

        try {
            const response = await fetch('/api/admin/backup', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            if (data.success) {
                this.showAlert('Backup created successfully', 'success');
                await this.loadBackupInfo();
                
                // Offer download
                if (data.backupUrl) {
                    if (confirm('Backup created. Do you want to download it now?')) {
                        window.open(data.backupUrl, '_blank');
                    }
                }
            } else {
                this.showAlert(data.error || 'Failed to create backup', 'danger');
            }
        } catch (error) {
            console.error('Create backup error:', error);
            this.showAlert('Error creating backup', 'danger');
        } finally {
            backupBtn.disabled = false;
            backupBtn.innerHTML = '<i class="fas fa-database"></i> Create Backup';
        }
    }

    async restoreBackup() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.zip,.json,.sql';
        
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!confirm(`Are you sure you want to restore from ${file.name}? This will overwrite current data.`)) {
                return;
            }

            const formData = new FormData();
            formData.append('backupFile', file);

            try {
                const response = await fetch('/api/admin/restore', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: formData
                });

                const data = await response.json();
                if (data.success) {
                    this.showAlert('Backup restored successfully', 'success');
                    // Reload page after restoration
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                } else {
                    this.showAlert(data.error || 'Failed to restore backup', 'danger');
                }
            } catch (error) {
                console.error('Restore backup error:', error);
                this.showAlert('Error restoring backup', 'danger');
            }
        };

        fileInput.click();
    }

    async clearCache() {
        if (!confirm('Are you sure you want to clear all cache? This will improve performance but may slow down initial loads.')) {
            return;
        }

        const cacheBtn = document.getElementById('clearCacheBtn');
        cacheBtn.disabled = true;
        cacheBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Clearing...';

        try {
            const response = await fetch('/api/admin/clear-cache', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();
            if (data.success) {
                this.showAlert('Cache cleared successfully', 'success');
            } else {
                this.showAlert(data.error || 'Failed to clear cache', 'danger');
            }
        } catch (error) {
            console.error('Clear cache error:', error);
            this.showAlert('Error clearing cache', 'danger');
        } finally {
            cacheBtn.disabled = false;
            cacheBtn.innerHTML = '<i class="fas fa-broom"></i> Clear Cache';
        }
    }

    async saveSystemSettings() {
        const saveBtn = document.getElementById('saveSettingsBtn');
        const form = document.getElementById('settingsForm');

        const settings = {
            shopName: document.getElementById('shopName').value,
            tagline: document.getElementById('tagline').value,
            address: document.getElementById('address').value,
            phone: document.getElementById('phone').value,
            gstin: document.getElementById('gstin').value,
            whatsappEnabled: document.getElementById('whatsappEnabled').checked,
            autoBackup: document.getElementById('autoBackup').checked,
            backupInterval: document.getElementById('backupInterval').value,
            lowStockThreshold: parseInt(document.getElementById('lowStockThreshold').value),
            exchangeDeduction: parseFloat(document.getElementById('exchangeDeduction').value)
        };

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            const response = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(settings)
            });

            const data = await response.json();
            if (data.success) {
                this.showAlert('Settings saved successfully', 'success');
            } else {
                this.showAlert(data.error || 'Failed to save settings', 'danger');
            }
        } catch (error) {
            console.error('Save settings error:', error);
            this.showAlert('Error saving settings', 'danger');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Settings';
        }
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible`;
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

// Initialize admin system
let adminSystem;
document.addEventListener('DOMContentLoaded', () => {
    adminSystem = new AdminSystem();
    
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
