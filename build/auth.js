// Auth state
window.currentUser = null;
const AUTH_TOKEN_KEY = 'trauma_auth_token';

// API Helper Functions
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    console.log('Making API request to:', `${API_BASE_URL}${endpoint}`, 'with token:', token ? 'present' : 'missing');
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
            credentials: 'include',
        });

        // Handle 401 Unauthorized
        if (response.status === 401) {
            console.log('Received 401 Unauthorized, redirecting to login');
            // Clear invalid token
            localStorage.removeItem(AUTH_TOKEN_KEY);
            window.currentUser = null;
            window.location.href = '/login.html';
            return null;
        }

        // Parse JSON if response is not empty
        const data = response.status === 204 ? null : await response.json();
        
        if (!response.ok) {
            console.error('API request failed:', response.status, data);
            throw new Error(data?.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        console.log('API request successful:', { endpoint, data });
        return data;
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// DOM Elements
const authSection = document.getElementById('auth-section');
const loginModal = document.getElementById('login-modal');
const loginForm = document.getElementById('login-form');
const closeModal = document.querySelector('.close');
const adminPanel = document.getElementById('admin-panel');
const adminButton = document.getElementById('admin-btn');
const closeAdmin = document.getElementById('close-admin');
const usersList = document.getElementById('users-list');

// Initialize authentication
async function initAuth() {
    // Set up event listeners
    setupEventListeners();
    
    try {
        // Check if user is already logged in
        const isAuthenticated = await checkAuth();
        
        // If not on login page and not authenticated, redirect to login
        if (!isAuthenticated && !window.location.pathname.endsWith('login.html')) {
            showLoginModal();
            // Hide main content until authenticated
            const mainContent = document.querySelector('main');
            if (mainContent) mainContent.style.display = 'none';
            return;
        }
        
        // Update UI based on authentication state
        updateAuthUI();
        
        // If user is admin and on the main page, show admin button
        if (isAuthenticated && currentUser?.isAdmin) {
            const adminBtnContainer = document.getElementById('admin-btn-container');
            if (adminBtnContainer) {
                adminBtnContainer.style.display = 'block';
            }
            
            // Only load users if we're on the admin page, but don't auto-open the panel
            if (window.location.pathname.includes('admin.html') || 
                window.location.hash === '#admin') {
                loadUsers();
            }
        }
        
        // Check system status if on admin panel
        if (isAuthenticated && document.getElementById('admin-panel')) {
            checkSystemStatus();
        }
    } catch (error) {
        console.error('Error initializing auth:', error);
    }
}

// Set up event listeners
function setupEventListeners() {
    // Login button click
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        console.log('Login button found, adding click handler');
        loginBtn.addEventListener('click', showLoginModal);
    }
    
    // Login form submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Admin panel link in dropdown - single event handler
    document.addEventListener('click', function(e) {
        // Check if the clicked element is the admin panel link or a child of it
        const adminLink = e.target.closest('#admin-panel-link');
        if (adminLink) {
            console.log('Admin panel link clicked');
            e.preventDefault();
            e.stopPropagation();
            
            // Close the dropdown if open
            const dropdown = document.querySelector('.dropdown-menu.show');
            if (dropdown) {
                console.log('Closing dropdown menu');
                dropdown.classList.remove('show');
            }
            
            // Toggle the admin panel with a small delay to ensure dropdown is closed
            setTimeout(() => {
                console.log('Toggling admin panel');
                toggleAdminPanel();
            }, 50);
            
            return false;
        }
    });
    
    // Close button in admin panel (if it exists on the current page)
    const closeAdminBtn = document.getElementById('close-admin-btn');
    if (closeAdminBtn) {
        closeAdminBtn.addEventListener('click', hideAdminPanel);
    }
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === loginModal) hideLoginModal();
    });
}

// Check system status (backend and database)
async function checkSystemStatus() {
    // Only run if we're on a page with status elements
    const backendStatus = document.getElementById('backend-status');
    const dbStatus = document.getElementById('db-status');
    
    // If status elements don't exist, don't proceed with the check
    if (!backendStatus || !dbStatus) {
        return;
    }
    
    try {
        // Check backend status
        const backendResponse = await fetch(`${API_BASE_URL}/auth/me`, {
            method: 'HEAD',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY) || ''}`
            },
            signal: AbortSignal.timeout(5000)
        });
        
        updateStatusElement(backendStatus, backendResponse.ok);
        
        // If backend is up, check database status
        if (backendResponse.ok) {
            try {
                const dbResponse = await fetch(`${API_BASE_URL}/admin/users`, {
                    method: 'HEAD',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem(AUTH_TOKEN_KEY) || ''}`
                    },
                    signal: AbortSignal.timeout(5000)
                });
                updateStatusElement(dbStatus, dbResponse.ok);
            } catch (error) {
                console.error('Database status check failed:', error);
                updateStatusElement(dbStatus, false);
            }
        } else {
            updateStatusElement(dbStatus, false);
        }
    } catch (error) {
        console.error('Backend status check failed:', error);
        updateStatusElement(backendStatus, false);
        updateStatusElement(dbStatus, false);
    }
    
    // Only schedule next check if we're on the admin panel
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel && adminPanel.style.display === 'flex') {
        setTimeout(checkSystemStatus, 30000);
    }
}

// Update status element with appropriate styling
function updateStatusElement(element, isOnline) {
    // Safely exit if element doesn't exist
    if (!element) return;
    
    // Safely find the icon element if it exists
    const statusCard = element.closest('.status-card') || element.closest('.list-group-item');
    const icon = statusCard?.querySelector('.status-icon, .bi');
    
    // Update status text and styling
    if (isOnline) {
        element.textContent = 'Online';
        element.className = 'badge bg-success';
        
        // Update icon if it exists
        if (icon) {
            if (icon.classList.contains('bi')) {
                // For Bootstrap Icons
                icon.className = 'bi bi-check-circle-fill text-success me-2';
            } else {
                // For Font Awesome Icons (legacy)
                icon.className = 'status-icon online';
                icon.innerHTML = '<i class="fas fa-check"></i>';
            }
        }
    } else {
        element.textContent = 'Offline';
        element.className = 'badge bg-danger';
        
        // Update icon if it exists
        if (icon) {
            if (icon.classList.contains('bi')) {
                // For Bootstrap Icons
                icon.className = 'bi bi-x-circle-fill text-danger me-2';
            } else {
                // For Font Awesome Icons (legacy)
                icon.className = 'status-icon offline';
                icon.innerHTML = '<i class="fas fa-times"></i>';
            }
        }
    }
}

// Check if user is authenticated
async function checkAuth() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return false;

    try {
        const data = await apiRequest('/auth/me');
        if (data && data.user) {
            // Ensure token is included in the user object
            window.currentUser = {
                ...data.user,
                token: token
            };
            updateAuthUI();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Auth check failed:', error);
        return false;
    }
}

// Update UI based on auth state
function updateAuthUI() {
    const loginBtn = document.getElementById('login-btn');
    const userMenu = document.getElementById('user-menu');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const adminBtnContainer = document.getElementById('admin-btn-container');
    const adminBtn = document.getElementById('admin-btn');
    const adminMenuItem = document.getElementById('admin-menu-item');
    
    if (window.currentUser) {
        // Update user info in the UI
        if (userAvatar) {
            userAvatar.textContent = window.currentUser.username.charAt(0).toUpperCase();
            
            // Set a random background color for the avatar
            const colors = ['#dc3545', '#0d6efd', '#198754', '#6f42c1', '#fd7e14', '#20c997'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            userAvatar.style.backgroundColor = color;
        }
        
        if (userName) {
            userName.textContent = window.currentUser.username;
        }
        
        // Show/hide admin elements based on user role
        const isAdmin = window.currentUser && window.currentUser.isAdmin === true;
        console.log('User is admin:', isAdmin, 'User object:', window.currentUser);
        if (adminBtnContainer) adminBtnContainer.style.display = isAdmin ? 'block' : 'none';
        if (adminBtn) adminBtn.style.display = isAdmin ? 'block' : 'none';
        if (adminMenuItem) {
            adminMenuItem.style.display = isAdmin ? 'block' : 'none';
            console.log('Admin menu item visibility:', adminMenuItem.style.display);
        }
        
        // Show/hide elements based on auth state
        if (loginBtn) loginBtn.style.display = 'none';
        if (userMenu) userMenu.style.display = 'flex';
        
        // Only load users if we're on the admin page (but don't auto-open panel)
        if (isAdmin && (window.location.pathname.endsWith('admin.html') || window.location.hash === '#admin')) {
            // Just update the URL without triggering the panel
            window.history.pushState(null, '', window.location.pathname);
            // Load users in the background without showing the panel
            loadUsers().catch(console.error);
        }
    } else {
        // User is not logged in
        if (loginBtn) loginBtn.style.display = 'block';
        if (userMenu) userMenu.style.display = 'none';
        if (adminBtn) adminBtn.style.display = 'none';
        if (adminBtnContainer) adminBtnContainer.style.display = 'none';
        
        // Redirect to login if on protected page
        const protectedPages = ['/admin.html', '/profile.html'];
        if (protectedPages.some(page => window.location.pathname.endsWith(page))) {
            window.location.href = '/login.html';
        }
    }
}

// Show login modal
function showLoginModal() {
    if (loginModal) loginModal.style.display = 'block';
}

// Hide login modal
function hideLoginModal() {
    if (loginModal) loginModal.style.display = 'none';
}

// Toggle admin panel
window.toggleAdminPanel = function() {
    console.log('Toggle admin panel called', { 
        currentUser: window.currentUser,
        adminPanelExists: !!document.getElementById('admin-panel')
    });
    
    // Check if user is admin
    if (!window.currentUser?.isAdmin) {
        showToast('Admin access required', 'warning');
        console.warn('Non-admin user attempted to access admin panel');
        return false;
    }
    
    // Get the admin panel element
    const adminPanel = document.getElementById('admin-panel');
    if (!adminPanel) {
        console.error('Admin panel element not found in the DOM');
        showToast('Admin panel not found', 'error');
        return false;
    }
    
    // Toggle the display
    if (adminPanel.style.display === 'none' || adminPanel.style.display === '') {
        console.log('Showing admin panel');
        adminPanel.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent scrolling
        
        // Load data
        console.log('Loading admin panel content');
        if (typeof loadUsers === 'function') {
            loadUsers();
        }
        if (typeof checkSystemStatus === 'function') {
            checkSystemStatus();
        }
        
        // Set focus to the close button
        const closeBtn = document.getElementById('close-admin');
        if (closeBtn) {
            closeBtn.focus();
        }
    } else {
        console.log('Hiding admin panel');
        adminPanel.style.display = 'none';
        document.body.style.overflow = ''; // Re-enable scrolling
    }
    
    return false;
}

// Hide admin panel
function hideAdminPanel() {
    adminPanel.style.display = 'none';
}

// Load users for admin panel with pagination and search
async function loadUsers(page = 1, search = '') {
    try {
        const data = await apiRequest(`/admin/users?page=${page}&search=${encodeURIComponent(search)}`);
        if (data) {
            renderUsersList(data.data, data.pagination);
        }
    } catch (error) {
        console.error('Error loading users:', error);
        usersList.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                ${error.message || 'Failed to load users'}
            </div>`;
    }
}

// Render users list in admin panel with pagination
function renderUsersList(users, pagination) {
    if (!users || users.length === 0) {
        usersList.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle-fill me-2"></i>
                No users found
            </div>`;
        return;
    }
    
    const userItems = users.map(user => `
        <div class="user-item d-flex justify-content-between align-items-center p-3 border-bottom" data-user-id="${user.id}">
            <div class="d-flex align-items-center">
                <div class="avatar me-3">
                    ${user.username.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h6 class="mb-0 d-flex align-items-center">
                        ${user.username}
                        ${user.isAdmin ? '<span class="badge bg-primary ms-2">Admin</span>' : ''}
                        ${user.isBanned ? '<span class="badge bg-danger ms-2">Banned</span>' : ''}
                    </h6>
                    <small class="text-muted">
                        <i class="bi bi-envelope me-1"></i>${user.email || 'No email'}
                    </small>
                    <div class="small text-muted mt-1">
                        <i class="bi bi-clock-history me-1"></i>
                        Last login: ${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                    </div>
                </div>
            </div>
            <div class="btn-group">
                <button class="btn btn-sm btn-outline-primary" onclick="editUser('${user.id}')">
                    <i class="bi bi-pencil"></i> Edit
                </button>
                <button class="btn btn-sm btn-outline-danger" 
                        onclick="deleteUser('${user.id}')"
                        ${currentUser && currentUser.id === user.id ? 'disabled' : ''}>
                    <i class="bi bi-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
    
    // Pagination controls
    let paginationHtml = '';
    if (pagination && pagination.totalPages > 1) {
        paginationHtml = `
            <div class="d-flex justify-content-between align-items-center mt-3">
                <div class="text-muted small">
                    Showing ${(pagination.page - 1) * pagination.limit + 1} to 
                    ${Math.min(pagination.page * pagination.limit, pagination.total)} of 
                    ${pagination.total} users
                </div>
                <nav>
                    <ul class="pagination pagination-sm mb-0">
                        <li class="page-item ${pagination.page === 1 ? 'disabled' : ''}">
                            <a class="page-link" href="#" onclick="loadUsers(${pagination.page - 1})">Previous</a>
                        </li>
                        ${Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                            const pageNum = pagination.page <= 3 ? i + 1 : 
                                         pagination.page >= pagination.totalPages - 2 ? 
                                         pagination.totalPages - 4 + i : 
                                         pagination.page - 2 + i;
                            if (pageNum < 1 || pageNum > pagination.totalPages) return '';
                            return `
                                <li class="page-item ${pagination.page === pageNum ? 'active' : ''}">
                                    <a class="page-link" href="#" onclick="loadUsers(${pageNum})">${pageNum}</a>
                                </li>
                            `;
                        }).join('')}
                        <li class="page-item ${pagination.page === pagination.totalPages ? 'disabled' : ''}">
                            <a class="page-link" href="#" onclick="loadUsers(${pagination.page + 1})">Next</a>
                        </li>
                    </ul>
                </nav>
            </div>
        `;
    }
    
    // Search bar
    const searchHtml = `
        <div class="mb-3">
            <div class="input-group">
                <span class="input-group-text">
                    <i class="bi bi-search"></i>
                </span>
                <input type="text" id="user-search" class="form-control" 
                       placeholder="Search users..." 
                       onkeyup="handleUserSearch(event)">
            </div>
        </div>
    `;
    
    usersList.innerHTML = searchHtml + userItems + paginationHtml;
}

// Handle user search with debounce
let searchTimeout;
function handleUserSearch(event) {
    clearTimeout(searchTimeout);
    const searchTerm = event.target.value.trim();
    
    searchTimeout = setTimeout(() => {
        loadUsers(1, searchTerm);
    }, 300);
}

// Edit user modal
function editUser(userId) {
    // Implement edit user functionality
    console.log('Edit user:', userId);
    // You can open a modal with a form to edit user details
    // and call the update user API endpoint
}

// Delete a user with confirmation
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
    }
    
    try {
        await apiRequest(`/admin/users/${userId}`, {
            method: 'DELETE'
        });
        
        // Show success message
        showToast('User deleted successfully', 'success');
        
        // Refresh users list
        loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast(error.message || 'Failed to delete user', 'danger');
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toastId = 'toast-' + Date.now();
    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    // Create and append toast
    const toastElement = document.createElement('div');
    toastElement.innerHTML = toastHtml;
    toastContainer.appendChild(toastElement.firstElementChild);
    
    // Initialize and show toast
    const toast = new bootstrap.Toast(toastElement.firstElementChild, {
        autohide: true,
        delay: 3000
    });
    
    toast.show();
    
    // Remove toast after it's hidden
    toastElement.firstElementChild.addEventListener('hidden.bs.toast', function () {
        toastElement.remove();
    });
}

// Handle login form submission
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('login-error');
    
    if (!username || !password) {
        errorElement.textContent = 'Please enter both username and password';
        errorElement.style.display = 'block';
        return;
    }
    
    const loginBtn = document.querySelector('#login-form button[type="submit"]');
    const originalBtnText = loginBtn.innerHTML;
    
    try {
        // Show loading state
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Signing in...';
        
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        // Store token and update current user globally
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        // Ensure token is included in the user object
        window.currentUser = {
            ...data.user,
            token: data.token // Make sure token is included in the user object
        };
        console.log('Current user after login:', window.currentUser);
        
        // Log successful login
        console.log('Login successful:', window.currentUser);
        
        // Hide login modal and update UI
        hideLoginModal();
        updateAuthUI();
        
        // Redirect to home page if on login page
        if (window.location.pathname.endsWith('login.html')) {
            window.location.href = '/';
        }
        
    } catch (error) {
        console.error('Login failed:', error);
        errorElement.textContent = error.message || 'Login failed. Please check your credentials and try again.';
        errorElement.style.display = 'block';
    } finally {
        // Reset button state
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.innerHTML = originalBtnText;
        }
    }
}

// Handle logout
async function handleLogout() {
    try {
        await apiRequest('/auth/logout', {
            method: 'POST'
        });
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        // Clear local auth state
        localStorage.removeItem(AUTH_TOKEN_KEY);
        currentUser = null;
        updateAuthUI();
        
        // Redirect to login page if not already there
        if (!window.location.pathname.endsWith('login.html')) {
            window.location.href = '/login.html';
        }
    }
}

// Initialize auth when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}

// Make auth functions available globally
window.auth = {
    getCurrentUser: () => currentUser,
    isAuthenticated: () => !!currentUser,
    isAdmin: () => currentUser?.isAdmin || false,
    requireAuth: async () => {
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) {
            showLoginModal();
            throw new Error('Authentication required');
        }
        return true;
    },
    requireAdmin: async () => {
        await auth.requireAuth();
        if (!currentUser.isAdmin) {
            throw new Error('Admin access required');
        }
        return true;
    }
};
