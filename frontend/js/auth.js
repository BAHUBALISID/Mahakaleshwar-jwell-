class Auth {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || '{}');
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.token && !!this.user._id;
    }

    // Check if user is admin
    isAdmin() {
        return this.isAuthenticated() && this.user.role === 'admin';
    }

    // Check if user is manager
    isManager() {
        return this.isAuthenticated() && (this.user.role === 'admin' || this.user.role === 'manager');
    }

    // Login function
    async login(email, password) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                // Store token and user data
                this.token = data.token;
                this.user = data.user;
                
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                return {
                    success: true,
                    user: data.user
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Login failed'
                };
            }
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                error: 'Network error. Please try again.'
            };
        }
    }

    // Logout function
    logout() {
        // Clear local storage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Clear class properties
        this.token = null;
        this.user = {};
        
        // Redirect to login page
        window.location.href = 'login.html';
    }

    // Get user profile
    async getProfile() {
        try {
            const response = await fetch('/api/auth/profile', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                // Update local user data
                this.user = data.user;
                localStorage.setItem('user', JSON.stringify(data.user));
                
                return {
                    success: true,
                    user: data.user
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Failed to load profile'
                };
            }
        } catch (error) {
            console.error('Get profile error:', error);
            
            // If token is invalid, logout
            if (error.status === 401) {
                this.logout();
            }
            
            return {
                success: false,
                error: 'Failed to load profile'
            };
        }
    }

    // Update user profile
    async updateProfile(profileData) {
        try {
            const response = await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(profileData)
            });

            const data = await response.json();

            if (data.success) {
                // Update local user data
                this.user = { ...this.user, ...profileData };
                localStorage.setItem('user', JSON.stringify(this.user));
                
                return {
                    success: true,
                    user: data.user
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Failed to update profile'
                };
            }
        } catch (error) {
            console.error('Update profile error:', error);
            return {
                success: false,
                error: 'Failed to update profile'
            };
        }
    }

    // Change password
    async changePassword(currentPassword, newPassword) {
        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                return {
                    success: true,
                    message: data.message || 'Password changed successfully'
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Failed to change password'
                };
            }
        } catch (error) {
            console.error('Change password error:', error);
            return {
                success: false,
                error: 'Failed to change password'
            };
        }
    }

    // Validate token
    async validateToken() {
        if (!this.token) {
            return { valid: false, reason: 'No token found' };
        }

        try {
            const response = await fetch('/api/auth/profile', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                return { valid: true };
            } else {
                return { valid: false, reason: 'Invalid token' };
            }
        } catch (error) {
            return { valid: false, reason: 'Network error' };
        }
    }

    // Force logout if token is invalid
    async checkAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        const validation = await this.validateToken();
        if (!validation.valid) {
            this.logout();
        }
    }

    // Get authorization header
    getAuthHeader() {
        return {
            'Authorization': `Bearer ${this.token}`
        };
    }

    // Register new user (admin only)
    async registerUser(userData) {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (data.success) {
                return {
                    success: true,
                    user: data.user,
                    message: data.message || 'User registered successfully'
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Failed to register user'
                };
            }
        } catch (error) {
            console.error('Register user error:', error);
            
            // Check if unauthorized (not admin)
            if (error.status === 403) {
                return {
                    success: false,
                    error: 'Admin access required'
                };
            }
            
            return {
                success: false,
                error: 'Failed to register user'
            };
        }
    }

    // Get all users (admin only)
    async getUsers() {
        try {
            const response = await fetch('/api/auth/users', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                return {
                    success: true,
                    users: data.users
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Failed to get users'
                };
            }
        } catch (error) {
            console.error('Get users error:', error);
            
            if (error.status === 403) {
                return {
                    success: false,
                    error: 'Admin access required'
                };
            }
            
            return {
                success: false,
                error: 'Failed to get users'
            };
        }
    }

    // Update user (admin only)
    async updateUser(userId, userData) {
        try {
            const response = await fetch(`/api/auth/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (data.success) {
                return {
                    success: true,
                    user: data.user,
                    message: data.message || 'User updated successfully'
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Failed to update user'
                };
            }
        } catch (error) {
            console.error('Update user error:', error);
            
            if (error.status === 403) {
                return {
                    success: false,
                    error: 'Admin access required'
                };
            }
            
            return {
                success: false,
                error: 'Failed to update user'
            };
        }
    }

    // Delete user (admin only)
    async deleteUser(userId) {
        try {
            const response = await fetch(`/api/auth/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                return {
                    success: true,
                    message: data.message || 'User deleted successfully'
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Failed to delete user'
                };
            }
        } catch (error) {
            console.error('Delete user error:', error);
            
            if (error.status === 403) {
                return {
                    success: false,
                    error: 'Admin access required'
                };
            }
            
            return {
                success: false,
                error: 'Failed to delete user'
            };
        }
    }

    // Toggle user status (admin only)
    async toggleUserStatus(userId, isActive) {
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
                return {
                    success: true,
                    message: data.message || 'User status updated successfully'
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Failed to update user status'
                };
            }
        } catch (error) {
            console.error('Toggle user status error:', error);
            
            if (error.status === 403) {
                return {
                    success: false,
                    error: 'Admin access required'
                };
            }
            
            return {
                success: false,
                error: 'Failed to update user status'
            };
        }
    }

    // Reset user password (admin only)
    async resetUserPassword(userId) {
        try {
            const response = await fetch(`/api/auth/users/${userId}/reset-password`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                return {
                    success: true,
                    message: data.message || 'Password reset successfully',
                    temporaryPassword: data.temporaryPassword // Only for admin view
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Failed to reset password'
                };
            }
        } catch (error) {
            console.error('Reset password error:', error);
            
            if (error.status === 403) {
                return {
                    success: false,
                    error: 'Admin access required'
                };
            }
            
            return {
                success: false,
                error: 'Failed to reset password'
            };
        }
    }

    // Session timeout handler
    initSessionTimeout(timeoutMinutes = 30) {
        let timeout;
        
        const resetTimeout = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.logout();
                alert('Your session has expired. Please login again.');
            }, timeoutMinutes * 60 * 1000);
        };
        
        // Reset timeout on user activity
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        events.forEach(event => {
            document.addEventListener(event, resetTimeout);
        });
        
        // Initial timeout setup
        resetTimeout();
    }

    // Get user permissions
    getPermissions() {
        const permissions = {
            canViewDashboard: true,
            canCreateBills: this.isAuthenticated(),
            canViewReports: this.isAuthenticated(),
            canManageStock: this.isManager(),
            canManageUsers: this.isAdmin(),
            canManageRates: this.isAdmin(),
            canViewAIInsights: this.isManager()
        };
        
        return permissions;
    }

    // Check if user has permission
    hasPermission(permission) {
        const permissions = this.getPermissions();
        return permissions[permission] || false;
    }
}

// Create global auth instance
window.auth = new Auth();

// Auto-check auth on page load
document.addEventListener('DOMContentLoaded', () => {
    // Don't check on login page
    if (!window.location.pathname.includes('login.html')) {
        auth.checkAuth();
        
        // Initialize session timeout (30 minutes)
        auth.initSessionTimeout(30);
    }
});
