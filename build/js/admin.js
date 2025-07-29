// Admin Panel - Clean and Optimized

// Global state
const API_BASE_URL = (window.API_BASE_URL || '').replace(/\/$/, '');
let adminInitialized = false;
let currentTab = 'dashboard';
let currentUsers = []; // Cache for user data

// Utility Functions
// ================

/**
 * Escape HTML to prevent XSS
 * @param {string} unsafe - The string to escape
 * @returns {string} Escaped HTML string
 */
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return unsafe.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Make API requests with proper headers and error handling
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} JSON response
 */
async function makeApiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem('trauma_auth_token');
    
    const defaultOptions = {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        },
        ...options,
        headers: {
            ...options.headers,
            ...(token && { 'Authorization': `Bearer ${token}` })
        }
    };
    
    try {
        const response = await fetch(url, defaultOptions);
        const responseText = await response.text();
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        try {
            return responseText ? JSON.parse(responseText) : {};
        } catch (e) {
            console.error('Failed to parse JSON response:', e);
            throw new Error('Invalid JSON response from server');
        }
    } catch (error) {
        console.error('API request error:', error);
        throw error;
    }
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast (info, success, warning, danger)
 */
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container') || (() => {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '1050';
        document.body.appendChild(container);
        return container;
    })();

    const toast = document.createElement('div');
    toast.className = `toast show align-items-center text-white bg-${type} border-0 mb-2`;
    toast.role = 'alert';
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="bi ${getToastIcon(type)} me-2"></i>
                ${escapeHtml(message)}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto-remove toast after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 150);
    }, 5000);
}

/**
 * Get icon for toast based on type
 * @param {string} type - Type of toast
 * @returns {string} Icon class
 */
function getToastIcon(type) {
    const icons = {
        success: 'bi-check-circle-fill',
        danger: 'bi-exclamation-triangle-fill',
        warning: 'bi-exclamation-triangle-fill',
        info: 'bi-info-circle-fill'
    };
    return icons[type] || icons.info;
}

/**
 * Load users for the users tab
 */
async function loadUsers() {
    const usersTab = document.getElementById('users-tab');
    if (!usersTab) return;
    
    // Show loading state
    usersTab.innerHTML = `
        <div class="d-flex justify-content-center my-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading users...</span>
            </div>
        </div>
        <div class="text-center py-5">
            <p class="mt-2">Loading users...</p>
        </div>`;
    
    try {
        const users = await makeApiRequest('/api/admin/users');
        renderUsersTable(users);
    } catch (error) {
        console.error('Failed to load users:', error);
        usersTab.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                Failed to load users: ${escapeHtml(error.message)}
            </div>`;
    }
}

/**
 * Render users table
 * @param {Array} users - Array of user objects
 */
function renderUsersTable(users) {
    const usersTab = document.getElementById('users-tab');
    if (!usersTab) {
        console.error('Users tab element not found');
        return;
    }
    
    if (!users || users.length === 0) {
        usersTab.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i> No users found
            </div>
        `;
        return;
    }
    
    // Sort users by creation date (newest first)
    users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Generate table rows
    const rows = users.map(user => `
        <tr>
            <td>${escapeHtml(user.username)}</td>
            <td>${escapeHtml(user.email || 'N/A')}</td>
            <td>${new Date(user.createdAt).toLocaleString()}</td>
            <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}</td>
            <td>
                <span class="badge ${user.isActive ? 'bg-success' : 'bg-secondary'}">
                    ${user.isActive ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <span class="badge ${user.isAdmin ? 'bg-primary' : 'bg-secondary'}">
                    ${user.isAdmin ? 'Admin' : 'User'}
                </span>
            </td>
            <td class="text-end">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" 
                            onclick="editUser('${user.id}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger" 
                            onclick="deleteUser('${user.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`
    ).join('');
    
    // Update the table
    usersTab.innerHTML = `
        <div class="table-responsive">
            <table class="table table-hover align-middle">
                <thead class="table-light">
                    <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Joined</th>
                        <th>Last Login</th>
                        <th>Status</th>
                        <th>Role</th>
                        <th class="text-end">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
        <div class="d-flex justify-content-between align-items-center mt-3">
            <div class="text-muted small">
                Showing ${users.length} user${users.length !== 1 ? 's' : ''}
            </div>
            <button class="btn btn-primary" onclick="showAddUserModal()">
                <i class="bi bi-plus-lg me-1"></i> Add User
            </button>
        </div>
    `;
}

/**
 * Show add user modal
 */
function showAddUserModal() {
    const modal = new bootstrap.Modal(document.getElementById('addUserModal'));
    const form = document.getElementById('addUserForm');
    if (form) form.reset();
    modal.show();
}

/**
 * Handle add user form submission
 * @param {Event} event - Form submit event
 */
async function handleAddUser(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    
    try {
        // Disable submit button and show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...';
        
        const formData = new FormData(form);
        const userData = Object.fromEntries(formData.entries());
        
        await makeApiRequest('/api/admin/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        
        // Close modal and refresh users list
        const modal = bootstrap.Modal.getInstance(document.getElementById('addUserModal'));
        if (modal) modal.hide();
        
        showToast('User added successfully', 'success');
        loadUsers();
    } catch (error) {
        console.error('Failed to add user:', error);
        showToast(`Failed to add user: ${error.message}`, 'danger');
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

/**
 * Edit user
 * @param {string} userId - ID of the user to edit
 */
async function editUser(userId) {
    try {
        const user = await makeApiRequest(`/api/admin/users/${userId}`);
        const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
        const form = document.getElementById('editUserForm');
        
        if (form) {
            form.elements['id'].value = user.id;
            form.elements['username'].value = user.username || '';
            form.elements['email'].value = user.email || '';
            form.elements['isActive'].checked = user.isActive;
            form.elements['isAdmin'].checked = user.isAdmin;
        
        // Show edit modal with user data
        const modal = document.getElementById('edit-user-modal');
        if (modal) {
            modal.querySelector('[name="username"]').value = user.username;
            modal.querySelector('[name="email"]').value = user.email || '';
            modal.querySelector('[name="isAdmin"]').checked = user.isAdmin;
            
            // Show modal
            modal.style.display = 'block';
            
            // Add event listener for form submission
            const form = modal.querySelector('form');
            if (form) {
                form.onsubmit = async (e) => {
                    e.preventDefault();
                    
                    const formData = new FormData(form);
                    const userData = {
                        username: formData.get('username'),
                        email: formData.get('email'),
                        isAdmin: formData.get('isAdmin') === 'on'
                    };
                    
                    // Only include password if it's not empty
                    const password = formData.get('password');
                    if (password) {
                        userData.password = password;
                    }
                    
                    try {
                        await makeApiRequest(`/api/admin/users/${userId}`, {
                            method: 'PUT',
                            body: JSON.stringify(userData)
                        });
                        
                        showToast('User updated successfully', 'success');
                        modal.style.display = 'none';
                        loadUsers(); // Refresh user list
                    } catch (error) {
                        console.error('Error updating user:', error);
                        showToast(error.message || 'Failed to update user', 'error');
                    }
                };
            }
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        showToast(error.message || 'Failed to load user data', 'error');
    }
}

// Delete user with confirmation
async function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        try {
            await makeApiRequest(`/api/admin/users/${userId}`, {
                method: 'DELETE'
            });
            
            showToast('User deleted successfully', 'success');
            loadUsers(); // Refresh user list
        } catch (error) {
            console.error('Error deleting user:', error);
            showToast(error.message || 'Failed to delete user', 'error');
        }
    }
}
        <div class="d-flex justify-content-center my-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading users...</span>
            </div>
        </div>
    `;
    
    try {
        const users = await makeApiRequest('/api/admin/users');
        renderUsersTable(users);
    } catch (error) {
        console.error('Failed to load users:', error);
        usersTab.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                Failed to load users: ${error.message}
            </div>
        `;
    }
}

// Render users in the table with enhanced UI and functionality
function renderUsersTable(users) {
    const usersTab = document.getElementById('users-tab');
    if (!usersTab) return;
    
    // Cache users for later use
    currentUsers = Array.isArray(users) ? users : [];
    
    if (!users || users.length === 0) {
        usersTab.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i> No users found
            </div>
        `;
        return;
    }
    
    usersTab.innerHTML = `
        <div class="table-responsive">
            <table class="table table-hover align-middle">
                <thead class="table-dark">
                    <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Admin</th>
                        <th>Status</th>
                        <th>Last Login</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="users-list">
                    ${users.map(user => `
                        <tr>
                            <td>${user.id}</td>
                            <td>
                                <div class="d-flex align-items-center">
                                    <span class="avatar me-2">
                                        <i class="bi bi-person"></i>
                                    </span>
                                    <span>${escapeHtml(user.username)}</span>
                                </div>
                            </td>
                            <td>${escapeHtml(user.email || 'N/A')}</td>
                            <td>
                                <span class="badge ${user.isAdmin ? 'bg-success' : 'bg-secondary'}">
                                    ${user.isAdmin ? 'Admin' : 'User'}
                                </span>
                            </td>
                            <td>
                                <span class="badge ${user.isActive ? 'bg-success' : 'bg-secondary'}">
                                    <i class="bi ${user.isActive ? 'bi-check-circle' : 'bi-x-circle'} me-1"></i>
                                    ${user.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}</td>
                            <td>
                                <div class="btn-group btn-group-sm" role="group">
                                    <button type="button" class="btn btn-outline-primary" onclick="editUser('${user.id}')">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    <button type="button" class="btn btn-outline-danger" onclick="deleteUser('${user.id}')">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                    ${!user.isAdmin ? `
                                        <button type="button" class="btn ${user.isActive ? 'btn-outline-warning' : 'btn-outline-success'}" 
                                                onclick="toggleUserStatus('${user.id}', ${!user.isActive})">
                                            <i class="bi ${user.isActive ? 'bi-lock' : 'bi-unlock'}"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div class="d-flex justify-content-between align-items-center mt-3">
            <div class="text-muted">
                Showing ${users.length} of ${users.length} users
            </div>
            <button class="btn btn-primary" onclick="showAddUserModal()">
                <i class="bi bi-plus-lg me-1"></i> Add User
            </button>
        </div>
    `;
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return unsafe
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Toggle user active status
async function toggleUserStatus(userId, newStatus) {
    if (!confirm(`Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} this user?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('trauma_auth_token')}`
            },
            body: JSON.stringify({ isActive: newStatus }),
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to update user status');
        }

        const result = await response.json();
        showToast(`User ${newStatus ? 'activated' : 'deactivated'} successfully`, 'success');
        loadUsers(); // Refresh the users list
    } catch (error) {
        console.error('Error toggling user status:', error);
        showToast(error.message || 'Failed to update user status', 'error');
    }
}

// Edit user
function editUser(userId) {
    // Implementation for editing a user
    console.log('Edit user:', userId);
    showToast('Edit user functionality coming soon', 'info');
}

// Delete user with confirmation
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('trauma_auth_token')}`
            },
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to delete user');
        }

        showToast('User deleted successfully', 'success');
        loadUsers(); // Refresh the users list
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast(error.message || 'Failed to delete user', 'error');
    }
}

// Show add user modal
function showAddUserModal() {
    // Implementation for showing add user modal
    console.log('Show add user modal');
    showToast('Add user functionality coming soon', 'info');
}

// Switch between admin panel tabs
function switchTab(tabId) {
    console.log(`Switching to tab: ${tabId}`);
    
    // Update current tab
    currentTab = tabId;
    
    // Hide all tab content
    document.querySelectorAll('.tab-pane').forEach(tab => {
        tab.classList.remove('show', 'active');
    });
    
    // Deactivate all tab links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected tab content
    const tabContent = document.getElementById(tabId);
    if (tabContent) {
        tabContent.classList.add('show', 'active');
    } else {
        console.error(`Tab content not found for ID: ${tabId}`);
    }
    
    // Activate selected tab link
    const tabLink = document.querySelector(`[data-bs-target="#${tabId}"]`);
    if (tabLink) {
        tabLink.classList.add('active');
    } else {
        console.error(`Tab link not found for ID: ${tabId}`);
    }
    
    // Load content for the selected tab
    try {
        switch(tabId) {
            case 'dashboard-tab':
                loadDashboard();
                break;
            case 'users-tab':
                loadUsers();
                break;
            case 'audit-log-tab':
                loadAuditLogs();
                break;
            case 'settings-tab':
                loadSettings();
                break;
            default:
                console.warn(`No handler for tab: ${tabId}`);
        }
    } catch (error) {
        console.error(`Error loading tab ${tabId}:`, error);
        showToast(`Failed to load ${tabId}: ${error.message}`, 'danger');
    }
}

// Load audit logs
async function loadAuditLogs() {
    const logsTab = document.getElementById('audit-log-tab');
    if (!logsTab) {
        console.error('Audit log tab element not found');
        return;
    }
    
    try {
        const response = await makeApiRequest('/api/admin/logs');
        renderAuditLogs(response.logs || []);
    } catch (error) {
        console.error('Error loading audit logs:', error);
        logsTab.innerHTML = `
            <div class="alert alert-danger">
                <h5><i class="fas fa-exclamation-triangle me-2"></i>Error</h5>
                <p class="mb-0">${error.message || 'Failed to load audit logs'}</p>
            </div>
        `;
    }
}

// Render audit logs
function renderAuditLogs(logs) {
    const logsTab = document.getElementById('logs-tab');
    if (!logsTab) return;
    
    if (!logs || logs.length === 0) {
        logsTab.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i> No audit logs found
            </div>
        `;
        return;
    }
    
    logsTab.innerHTML = `
        <div class="table-responsive">
            <table class="table table-hover align-middle">
                <thead class="table-dark">
                    <tr>
                        <th>Timestamp</th>
                        <th>User</th>
                        <th>Action</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.map(log => `
                        <tr>
                            <td>${new Date(log.timestamp).toLocaleString()}</td>
                            <td>${log.userId ? `User ${log.userId}` : 'System'}</td>
                            <td>${log.action}</td>
                            <td>${log.details || ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Load settings
async function loadSettings() {
    const settingsTab = document.getElementById('settings-tab');
    if (!settingsTab) return;
    
    try {
        const response = await makeApiRequest('/api/admin/settings');
        renderSettings(response.settings || {});
    } catch (error) {
        console.error('Error loading settings:', error);
        settingsTab.innerHTML = `
            <div class="alert alert-danger">
                <h5><i class="fas fa-exclamation-triangle me-2"></i>Error</h5>
                <p class="mb-0">${error.message || 'Failed to load settings'}</p>
            </div>
        `;
    }
}

// Render settings
function renderSettings(settings) {
    const settingsTab = document.getElementById('settings-tab');
    if (!settingsTab) return;
    
    settingsTab.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h5 class="mb-0">Application Settings</h5>
            </div>
            <div class="card-body">
                <form id="settings-form">
                    <div class="mb-3">
                        <label for="appName" class="form-label">Application Name</label>
                        <input type="text" class="form-control" id="appName" value="${settings.appName || 'Trauma Multitool'}">
                    </div>
                    <div class="mb-3">
                        <label for="maxLoginAttempts" class="form-label">Max Login Attempts</label>
                        <input type="number" class="form-control" id="maxLoginAttempts" value="${settings.maxLoginAttempts || 5}">
                    </div>
                    <div class="mb-3">
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="maintenanceMode" ${settings.maintenanceMode ? 'checked' : ''}>
                            <label class="form-check-label" for="maintenanceMode">Maintenance Mode</label>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary">Save Settings</button>
                </form>
            </div>
        </div>
    `;
    
    // Add form submission handler
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                const settings = {
                    appName: document.getElementById('appName').value,
                    maxLoginAttempts: parseInt(document.getElementById('maxLoginAttempts').value, 10),
                    maintenanceMode: document.getElementById('maintenanceMode').checked
                };
                
                await makeApiRequest('/api/admin/settings', {
                    method: 'POST',
                    body: JSON.stringify(settings)
                });
                
                showToast('Settings saved successfully', 'success');
            } catch (error) {
                console.error('Error saving settings:', error);
                showToast(error.message || 'Failed to save settings', 'error');
            }
        });
    }
}

// Initialize admin panel
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Admin panel DOM loaded');
    
    // Check if user is admin
    try {
        // Check admin status via API
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Not authenticated or not an admin');
        }
        
        const userData = await response.json();
        if (!userData || !userData.isAdmin) {
            throw new Error('Admin access required');
        }
        
        if (!response.ok) {
            window.location.href = '/login.html';
            return;
        }
        
        const user = await response.json();
        if (!user.isAdmin) {
            window.location.href = '/index.html';
            return;
        }
        
        // Load initial data
        loadUsers();
        
        // Initialize tooltips
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
        
        // Set up tab switching
        const tabLinks = document.querySelectorAll('.admin-tab-link');
        tabLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = link.getAttribute('data-tab');
                switchTab(tabId);
            });
        });
        
        // Set up modal close buttons
        const closeButtons = document.querySelectorAll('.close-modal, .close-admin-panel');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const modal = button.closest('.admin-modal');
                if (modal) {
                    modal.style.display = 'none';
                } else {
                    document.getElementById('admin-panel').style.display = 'none';
                }
            });
        });
        
        adminInitialized = true;
    } catch (error) {
        console.error('Error initializing admin panel:', error);
        showToast('Failed to initialize admin panel', 'error');
    }
});
    `;
    
    try {
        const response = await fetch('/api/admin/users', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${localStorage.getItem('trauma_auth_token')}`
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to load users');
        }
        
        const { users } = await response.json();
        renderUsersTable(users);
    } catch (error) {
        console.error('Error loading users:', error);
        usersTab.innerHTML = `
            <div class="alert alert-danger">
                <h5><i class="fas fa-exclamation-triangle me-2"></i>Error</h5>
                <p class="mb-0">${error.message || 'Failed to load users'}</p>
            </div>
        `;
    }
}

// Render users in the table with enhanced UI and functionality
function renderUsersTable(users) {
    const usersTab = document.getElementById('users-tab');
    if (!usersTab) return;
    
    // Cache users for later use
    currentUsers = Array.isArray(users) ? users : [];
    
    if (!users || users.length === 0) {
        usersTab.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i> No users found
            </div>
        `;
        return;
    }
    
    // Create table with enhanced styling and functionality
    usersTab.innerHTML = `
        <div class="table-responsive">
            <table class="table table-hover align-middle">
                <thead class="table-dark">
                    <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Admin</th>
                        <th>Status</th>
                        <th>Last Login</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="users-list">
                    ${users.map(user => `
                        <tr>
                            <td>${user.id}</td>
                            <td>
                                <div class="d-flex align-items-center">
                                    <span class="avatar me-2">
                                        <i class="fas fa-user"></i>
                                    </span>
                                    <span>${escapeHtml(user.username)}</span>
                                </div>
                            </td>
                            <td>${escapeHtml(user.email || 'N/A')}</td>
                            <td>
                                <span class="badge ${user.isAdmin ? 'bg-success' : 'bg-secondary'}">
                                    ${user.isAdmin ? 'Admin' : 'User'}
                                </span>
                            </td>
                            <td>
                                <span class="badge ${user.isActive ? 'bg-success' : 'bg-secondary'}">
                                    <i class="fas ${user.isActive ? 'fa-check-circle' : 'fa-times-circle'} me-1"></i>
                                    ${user.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}</td>
                            <td>
                                <div class="btn-group btn-group-sm" role="group">
                                    <button type="button" class="btn btn-outline-primary" onclick="editUser('${user.id}')">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button type="button" class="btn btn-outline-danger" onclick="deleteUser('${user.id}')">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                    ${!user.isAdmin ? `
                                        <button type="button" class="btn ${user.isActive ? 'btn-outline-warning' : 'btn-outline-success'}" 
                                                onclick="toggleUserStatus('${user.id}', ${!user.isActive})">
                                            <i class="fas ${user.isActive ? 'fa-user-lock' : 'fa-user-check'}"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div class="d-flex justify-content-between align-items-center mt-3">
            <div class="text-muted">
                Showing ${users.length} of ${users.length} users
            </div>
            <button class="btn btn-primary" onclick="showAddUserModal()">
                <i class="fas fa-plus me-1"></i> Add User
            </button>
        </div>
    `;
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
                        `).join('')}
                </tbody>
}

// Edit user
function editUser(userId) {
    // Implementation for editing a user
    console.log('Edit user:', userId);
    showToast('Edit user functionality coming soon', 'info');
}

// Delete user with confirmation
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await makeApiRequest(`/api/admin/users/${userId}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showToast('User deleted successfully', 'success');
            loadUsers();
        } else {
            throw new Error(response.error || 'Failed to delete user');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Failed to delete user: ' + (error.message || 'Unknown error'), 'danger');
    }
}

// Initialize admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin panel initialized');
    
    // Initialize tab switching with Bootstrap's tab component
    const tabEls = document.querySelectorAll('a[data-bs-toggle="tab"]');
    tabEls.forEach(tabEl => {
        tabEl.addEventListener('shown.bs.tab', function (event) {
            const target = event.target.getAttribute('href').substring(1);
            console.log('Tab shown:', target);
            loadTabContent(target);
        });
    });
    
    // Load the default tab content (dashboard)
    loadTabContent('dashboard');
    
    // Initialize modal handling
    const modal = document.getElementById('add-user-modal');
    const openModalBtn = document.getElementById('add-user-btn');
    const closeModalBtns = document.querySelectorAll('[data-bs-dismiss="modal"]');
    
    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            const modalInstance = new bootstrap.Modal(modal);
            modalInstance.show();
        });
    }
    
    // Add user form submission
    const addUserForm = document.getElementById('add-user-form');
    if (addUserForm) {
        addUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(addUserForm);
            const userData = {
                username: formData.get('username'),
                email: formData.get('email'),
                password: formData.get('password'),
                role: formData.get('role'),
                isAdmin: formData.get('role') === 'admin'
            };
            
            try {
                const response = await makeApiRequest('/api/admin/users', {
                    method: 'POST',
                    body: JSON.stringify(userData)
                });
                
                if (response.success) {
                    showToast('User added successfully', 'success');
                    const modalInstance = bootstrap.Modal.getInstance(modal);
                    if (modalInstance) modalInstance.hide();
                    addUserForm.reset();
                    loadUsers();
                } else {
                    throw new Error(response.error || 'Failed to add user');
                }
            } catch (error) {
                console.error('Error adding user:', error);
                showToast('Failed to add user: ' + (error.message || 'Unknown error'), 'danger');
            }
        });
    }
    
    // Load initial data
    loadDashboardData();
    loadUsers();
    loadSessions();
});

// Load dashboard data
async function loadDashboardData() {
    try {
        const response = await makeApiRequest('/api/admin/stats');
        
        if (response.success && response.data) {
            // Update dashboard stats
            const stats = response.data;
            
            if (stats.totalUsers !== undefined) {
                const el = document.getElementById('total-users');
                if (el) el.textContent = stats.totalUsers;
            }
            
            if (stats.activeSessions !== undefined) {
                const el = document.getElementById('active-sessions');
                if (el) el.textContent = stats.activeSessions;
            }
            
            if (stats.todayLogins !== undefined) {
                const el = document.getElementById('today-logins');
                if (el) el.textContent = stats.todayLogins;
            }
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Load sessions for the sessions tab
async function loadSessions() {
    const sessionsList = document.getElementById('sessions-list');
    if (!sessionsList) return;
    
    try {
        sessionsList.innerHTML = '<tr><td colspan="4" class="text-center">Loading sessions...</td></tr>';
        
        const response = await makeApiRequest('/api/admin/sessions');
        
        if (response.success && response.data) {
            renderSessionsTable(response.data);
        } else {
            throw new Error(response.error || 'Failed to load sessions');
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
        sessionsList.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-danger">
                    Error loading sessions. Please try again.
                </td>
            </tr>
        `;
    }
}

// Render sessions in the table
function renderSessionsTable(sessions) {
    const sessionsList = document.getElementById('sessions-list');
    if (!sessionsList) return;
    
    if (!sessions || sessions.length === 0) {
        sessionsList.innerHTML = '<tr><td colspan="4" class="text-center">No active sessions</td></tr>';
        return;
    }
    
    sessionsList.innerHTML = sessions.map(session => `
        <tr>
            <td>${session.user?.username || 'Unknown'}</td>
            <td>${session.ipAddress || '-'}</td>
            <td>${new Date(session.updatedAt).toLocaleString()}</td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-danger" 
                        onclick="terminateSession('${session.id}')">
                    <i class="bi bi-x-circle"></i> Terminate
                </button>
            </td>
        </tr>
    `).join('');
}

// Terminate session
async function terminateSession(sessionId) {
    if (!confirm('Are you sure you want to terminate this session?')) {
        return;
    }
    
    try {
        const response = await makeApiRequest(`/api/admin/sessions/${sessionId}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showToast('Session terminated successfully', 'success');
            loadSessions();
        } else {
            throw new Error(response.error || 'Failed to terminate session');
        }
    } catch (error) {
        console.error('Error terminating session:', error);
        showToast('Failed to terminate session: ' + (error.message || 'Unknown error'), 'danger');
    }
}

// Load content for a specific tab
function loadTabContent(tabId) {
    console.log(`Loading tab content for: ${tabId}`);
    
    try {
        switch (tabId) {
            case 'dashboard':
                console.log('Loading dashboard data...');
                loadDashboardData();
                break;
            case 'users':
                console.log('Loading users data...');
                loadUsers();
                break;
            case 'sessions':
                console.log('Loading sessions data...');
                loadSessions();
                break;
            case 'logs':
                console.log('Logs tab selected');
                // TODO: Implement logs loading
                break;
            default:
                console.warn(`Unknown tab ID: ${tabId}`);
        }
    } catch (error) {
        console.error(`Error loading tab ${tabId}:`, error);
        showToast(`Failed to load ${tabId} content`, 'danger');
    }
}

// Make functions available globally for inline event handlers
window.editUser = editUser;
window.deleteUser = deleteUser;
window.terminateSession = terminateSession;
