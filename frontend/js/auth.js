// Authentication Management
class AuthManager {
    constructor() {
        this.token = localStorage.getItem('jwt_token');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
        this.apiBase = window.location.origin.includes('localhost') 
            ? 'http://localhost:5000/api' 
            : '/api';
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.token && !!this.user;
    }

    // Login function
    async login(username, password) {
        try {
            const response = await fetch(`${this.apiBase}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                this.token = data.token;
                this.user = data.user;
                
                localStorage.setItem('jwt_token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                return { success: true, user: data.user };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    // Logout function
    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }

    // Get auth headers for API calls
    getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
        };
    }

    // Check authentication on page load
    checkAuth(redirectToLogin = true) {
        if (!this.isAuthenticated() && redirectToLogin) {
            window.location.href = 'login.html';
            return false;
        }
        return this.isAuthenticated();
    }

    // Update user profile
    async updateProfile(profileData) {
        try {
            const response = await fetch(`${this.apiBase}/auth/profile`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(profileData)
            });

            return await response.json();
        } catch (error) {
            console.error('Update profile error:', error);
            return { success: false, message: 'Network error' };
        }
    }
}

// Initialize auth manager
const authManager = new AuthManager();

// Login form handler
function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    const submitBtn = document.querySelector('#loginForm button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    
    errorDiv.style.display = 'none';
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
    submitBtn.disabled = true;
    
    authManager.login(username, password).then(result => {
        if (result.success) {
            // Redirect to dashboard
            window.location.href = 'index.html';
        } else {
            errorDiv.textContent = result.message || 'Invalid credentials';
            errorDiv.style.display = 'block';
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
        }
    });
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        authManager.logout();
    }
}

// Display user info on pages
function displayUserInfo() {
    if (authManager.checkAuth(false)) {
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.textContent = authManager.user.username.split('@')[0];
        }
    }
}

// Protected page loader
function loadProtectedPage() {
    if (!authManager.checkAuth()) {
        return false;
    }
    
    displayUserInfo();
    return true;
}

// Update shop details
async function updateShopDetails() {
    const shopName = document.getElementById('shopName').value;
    const address = document.getElementById('address').value;
    const gstin = document.getElementById('gstin').value;
    const phone = document.getElementById('phone').value;
    const email = document.getElementById('email').value;
    
    const result = await authManager.updateProfile({
        shopName,
        address,
        gstin,
        phone,
        email
    });
    
    if (result.success) {
        alert('Shop details updated successfully!');
        // Update local storage
        localStorage.setItem('user', JSON.stringify(result.user));
    } else {
        alert('Error updating shop details: ' + result.message);
    }
}

// Initialize login page
if (window.location.pathname.includes('login.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        // If already logged in, redirect to dashboard
        if (authManager.isAuthenticated()) {
            window.location.href = 'index.html';
        }
        
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }
        
        // Set default admin credentials (for development)
        document.getElementById('username').value = 'admin@mahakaleshwar';
        document.getElementById('password').value = 'Mahakaleshwar@123';
    });
}

// Export for use in other files
window.authManager = authManager;
window.logout = logout;
window.updateShopDetails = updateShopDetails;
