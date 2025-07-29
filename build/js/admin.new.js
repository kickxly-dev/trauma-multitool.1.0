// Admin Panel - Clean and Optimized

// Global state
const API_BASE_URL = (window.API_BASE_URL || '').replace(/\/$/, '');
let adminInitialized = false;
let currentTab = 'dashboard';
let currentUsers = []; // Cache for user data

// ====================
// Utility Functions
// ====================

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

// ====================
// User Management
// ====================

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
    
    // Cache users for later use
    currentUsers = Array.isArray(users) ? users : [];
    
    if (currentUsers.length === 0) {
        usersTab.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i> No users found
            </div>`;
        return;
    }
    
    // Sort users by creation date (newest first)
    currentUsers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Generate table rows
    const rows = currentUsers.map(user => `
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
                    <button class="btn btn-outline-primary btn-edit-user" data-user-id="${user.id}">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-delete-user" data-user-id="${user.id}">
                        <i class="bi bi-trash"></i>
                    </button>
                    <button class="btn btn-outline-${user.isActive ? 'warning' : 'success'} btn-toggle-status" 
                            data-user-id="${user.id}" 
                            data-status="${user.isActive}">
                        <i class="bi ${user.isActive ? 'bi-x-circle' : 'bi-check-circle'}"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    usersTab.innerHTML = `
        <div class="table-responsive">
            <table class="table table-hover align-middle">
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Created</th>
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
            <div>
                <span class="text-muted">
                    Showing ${currentUsers.length} user${currentUsers.length !== 1 ? 's' : ''}
                </span>
            </div>
            <button class="btn btn-primary" id="btn-add-user">
                <i class="bi bi-plus-lg me-1"></i> Add User
            </button>
        </div>`;
        
    // Add event listeners
    document.getElementById('btn-add-user')?.addEventListener('click', showAddUserModal);
}

/**
 * Show add user modal
 */
function showAddUserModal() {
    // Implementation for showing add user modal
    console.log('Show add user modal');
    // TODO: Implement modal display logic
}

/**
 * Toggle user active status
 * @param {string} userId - ID of the user to toggle
 * @param {boolean} newStatus - New status (true/false)
 */
async function toggleUserStatus(userId, newStatus) {
    try {
        await makeApiRequest(`/api/admin/users/${userId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ isActive: newStatus })
        });
        
        // Update local state
        const user = currentUsers.find(u => u.id === userId);
        if (user) {
            user.isActive = newStatus;
            renderUsersTable(currentUsers);
        }
        
        showToast(`User ${newStatus ? 'activated' : 'deactivated'} successfully`, 'success');
    } catch (error) {
        console.error('Failed to toggle user status:', error);
        showToast(`Failed to update user status: ${error.message}`, 'danger');
    }
}

/**
 * Delete user with confirmation
 * @param {string} userId - ID of the user to delete
 */
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
    }
    
    try {
        await makeApiRequest(`/api/admin/users/${userId}`, {
            method: 'DELETE'
        });
        
        // Update local state
        currentUsers = currentUsers.filter(user => user.id !== userId);
        renderUsersTable(currentUsers);
        
        showToast('User deleted successfully', 'success');
    } catch (error) {
        console.error('Failed to delete user:', error);
        showToast(`Failed to delete user: ${error.message}`, 'danger');
    }
}

// ====================
// Tab Management
// ====================

/**
 * Switch between admin panel tabs
 * @param {string} tabId - ID of the tab to switch to
 */
async function switchTab(tabId) {
    if (!tabId) return;
    
    // Update active tab UI
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const tabLink = document.querySelector(`.nav-link[data-bs-target="#${tabId}"]`);
    if (tabLink) {
        tabLink.classList.add('active');
    }
    
    // Hide all tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('show', 'active');
    });
    
    // Show selected tab pane
    const tabPane = document.getElementById(tabId);
    if (tabPane) {
        tabPane.classList.add('show', 'active');
    }
    
    // Load tab content
    try {
        switch (tabId) {
            case 'dashboard':
                await loadDashboard();
                break;
            case 'users-tab':
                await loadUsers();
                break;
            case 'audit-log-tab':
                await loadAuditLogs();
                break;
            case 'settings-tab':
                await loadSettings();
                break;
            default:
                console.warn(`Unknown tab: ${tabId}`);
        }
    } catch (error) {
        console.error(`Error loading tab ${tabId}:`, error);
        showToast(`Failed to load ${tabId}: ${error.message}`, 'danger');
    }
}

// ====================
// Dashboard Functions
// ====================

/**
 * Load dashboard data
 */
async function loadDashboard() {
    const dashboardTab = document.getElementById('dashboard-tab');
    if (!dashboardTab) return;
    
    try {
        const stats = await makeApiRequest('/api/admin/stats');
        
        // Update dashboard with stats
        dashboardTab.innerHTML = `
            <div class="row g-4">
                <div class="col-md-6 col-xl-3">
                    <div class="card bg-primary text-white">
                        <div class="card-body">
                            <h5 class="card-title">Total Users</h5>
                            <h2 class="mb-0">${stats.userCount || 0}</h2>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-xl-3">
                    <div class="card bg-success text-white">
                        <div class="card-body">
                            <h5 class="card-title">Active Sessions</h5>
                            <h2 class="mb-0">${stats.activeSessions || 0}</h2>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-xl-3">
                    <div class="card bg-info text-white">
                        <div class="card-body">
                            <h5 class="card-title">System Status</h5>
                            <h2 class="mb-0">${stats.systemStatus || 'Unknown'}</h2>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-xl-3">
                    <div class="card bg-warning text-dark">
                        <div class="card-body">
                            <h5 class="card-title">API Version</h5>
                            <h2 class="mb-0">${stats.apiVersion || '1.0.0'}</h2>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="row mt-4">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="card-title mb-0">Recent Activity</h5>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-hover">
                                    <thead>
                                        <tr>
                                            <th>Time</th>
                                            <th>User</th>
                                            <th>Action</th>
                                            <th>Details</th>
                                        </tr>
                                    </thead>
                                    <tbody id="recent-activity">
                                        <tr>
                                            <td colspan="4" class="text-center">
                                                <div class="spinner-border" role="status">
                                                    <span class="visually-hidden">Loading...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
            
        // Load recent activity
        const activity = await makeApiRequest('/api/admin/activity');
        const activityRows = activity.slice(0, 5).map(item => `
            <tr>
                <td>${new Date(item.timestamp).toLocaleString()}</td>
                <td>${escapeHtml(item.username || 'System')}</td>
                <td>${escapeHtml(item.action)}</td>
                <td>${escapeHtml(item.details || '')}</td>
            </tr>
        `).join('');
        
        const activityTable = document.getElementById('recent-activity');
        if (activityTable) {
            activityTable.innerHTML = activityRows || '<tr><td colspan="4" class="text-center">No recent activity</td></tr>';
        }
    } catch (error) {
        console.error('Failed to load dashboard:', error);
        dashboardTab.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                Failed to load dashboard: ${escapeHtml(error.message)}
            </div>`;
    }
}

// ====================
// Audit Log Functions
// ====================

/**
 * Load audit logs
 */
async function loadAuditLogs() {
    const auditTab = document.getElementById('audit-log-tab');
    if (!auditTab) return;
    
    try {
        const logs = await makeApiRequest('/api/admin/audit-logs');
        renderAuditLogs(logs);
    } catch (error) {
        console.error('Failed to load audit logs:', error);
        auditTab.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                Failed to load audit logs: ${escapeHtml(error.message)}
            </div>`;
    }
}

/**
 * Render audit logs
 * @param {Array} logs - Array of log entries
 */
function renderAuditLogs(logs) {
    const auditTab = document.getElementById('audit-log-tab');
    if (!auditTab) return;
    
    if (!logs || logs.length === 0) {
        auditTab.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i> No audit logs found
            </div>`;
        return;
    }
    
    const rows = logs.map(log => `
        <tr>
            <td>${new Date(log.timestamp).toLocaleString()}</td>
            <td>${escapeHtml(log.username || 'System')}</td>
            <td>${escapeHtml(log.action)}</td>
            <td>${escapeHtml(log.details || '')}</td>
            <td>${log.ipAddress || 'N/A'}</td>
        </tr>
    `).join('');
    
    auditTab.innerHTML = `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>User</th>
                        <th>Action</th>
                        <th>Details</th>
                        <th>IP Address</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>`;
}

// ====================
// Settings Functions
// ====================

/**
 * Load settings
 */
async function loadSettings() {
    const settingsTab = document.getElementById('settings-tab');
    if (!settingsTab) return;
    
    try {
        const settings = await makeApiRequest('/api/admin/settings');
        renderSettings(settings);
    } catch (error) {
        console.error('Failed to load settings:', error);
        settingsTab.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                Failed to load settings: ${escapeHtml(error.message)}
            </div>`;
    }
}

/**
 * Render settings
 * @param {Object} settings - Settings object
 */
function renderSettings(settings) {
    const settingsTab = document.getElementById('settings-tab');
    if (!settingsTab) return;
    
    settingsTab.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h5 class="card-title mb-0">System Settings</h5>
            </div>
            <div class="card-body">
                <form id="settings-form">
                    <div class="mb-3">
                        <label for="siteName" class="form-label">Site Name</label>
                        <input type="text" class="form-control" id="siteName" 
                               value="${escapeHtml(settings.siteName || 'Trauma Admin')}">
                    </div>
                    
                    <div class="mb-3">
                        <label for="adminEmail" class="form-label">Admin Email</label>
                        <input type="email" class="form-control" id="adminEmail" 
                               value="${escapeHtml(settings.adminEmail || '')}">
                    </div>
                    
                    <div class="mb-3 form-check">
                        <input type="checkbox" class="form-check-input" id="maintenanceMode" 
                               ${settings.maintenanceMode ? 'checked' : ''}>
                        <label class="form-check-label" for="maintenanceMode">Maintenance Mode</label>
                    </div>
                    
                    <div class="mb-3">
                        <label for="itemsPerPage" class="form-label">Items Per Page</label>
                        <select class="form-select" id="itemsPerPage">
                            <option value="10" ${settings.itemsPerPage === 10 ? 'selected' : ''}>10</option>
                            <option value="25" ${settings.itemsPerPage === 25 ? 'selected' : ''}>25</option>
                            <option value="50" ${settings.itemsPerPage === 50 ? 'selected' : ''}>50</option>
                            <option value="100" ${settings.itemsPerPage === 100 ? 'selected' : ''}>100</option>
                        </select>
                    </div>
                    
                    <div class="d-flex justify-content-end">
                        <button type="button" class="btn btn-secondary me-2" id="btn-reset-settings">
                            <i class="bi bi-arrow-counterclockwise me-1"></i> Reset to Defaults
                        </button>
                        <button type="submit" class="btn btn-primary">
                            <i class="bi bi-save me-1"></i> Save Settings
                        </button>
                    </div>
                </form>
            </div>
        </div>`;
        
    // Add event listeners
    document.getElementById('settings-form')?.addEventListener('submit', handleSaveSettings);
    document.getElementById('btn-reset-settings')?.addEventListener('click', resetSettings);
}

/**
 * Handle save settings form submission
 * @param {Event} event - Form submit event
 */
async function handleSaveSettings(event) {
    event.preventDefault();
    
    const settings = {
        siteName: document.getElementById('siteName').value,
        adminEmail: document.getElementById('adminEmail').value,
        maintenanceMode: document.getElementById('maintenanceMode').checked,
        itemsPerPage: parseInt(document.getElementById('itemsPerPage').value, 10)
    };
    
    try {
        await makeApiRequest('/api/admin/settings', {
            method: 'POST',
            body: JSON.stringify(settings)
        });
        
        showToast('Settings saved successfully', 'success');
    } catch (error) {
        console.error('Failed to save settings:', error);
        showToast(`Failed to save settings: ${error.message}`, 'danger');
    }
}

/**
 * Reset settings to defaults
 */
async function resetSettings() {
    if (!confirm('Are you sure you want to reset all settings to their default values?')) {
        return;
    }
    
    try {
        await makeApiRequest('/api/admin/settings/reset', {
            method: 'POST'
        });
        
        // Reload settings
        await loadSettings();
        showToast('Settings reset to defaults', 'success');
    } catch (error) {
        console.error('Failed to reset settings:', error);
        showToast(`Failed to reset settings: ${error.message}`, 'danger');
    }
}

// ====================
// Initialization
// ====================

/**
 * Initialize admin panel
 */
function initAdminPanel() {
    console.log('Initializing admin panel...');
    
    // Set up tab switching
    document.querySelectorAll('.nav-link[data-bs-toggle="tab"]').forEach(link => {
        link.addEventListener('click', (event) => {
            const tabId = event.target.getAttribute('data-bs-target').substring(1);
            currentTab = tabId;
        });
    });
    
    // Set up event delegation for user actions
    document.addEventListener('click', async (event) => {
        // Handle user edit
        const editBtn = event.target.closest('.btn-edit-user');
        if (editBtn) {
            const userId = editBtn.dataset.userId;
            if (userId) {
                // TODO: Implement edit user
                console.log('Edit user:', userId);
            }
            return;
        }
        
        // Handle user delete
        const deleteBtn = event.target.closest('.btn-delete-user');
        if (deleteBtn) {
            const userId = deleteBtn.dataset.userId;
            if (userId) {
                await deleteUser(userId);
            }
            return;
        }
        
        // Handle toggle user status
        const toggleBtn = event.target.closest('.btn-toggle-status');
        if (toggleBtn) {
            const userId = toggleBtn.dataset.userId;
            const currentStatus = toggleBtn.dataset.status === 'true';
            if (userId) {
                await toggleUserStatus(userId, !currentStatus);
            }
            return;
        }
    });
    
    // Load initial tab
    const activeTab = document.querySelector('.nav-link.active');
    if (activeTab) {
        const tabId = activeTab.getAttribute('data-bs-target').substring(1);
        switchTab(tabId);
    } else {
        // Default to dashboard if no active tab
        switchTab('dashboard');
    }
    
    adminInitialized = true;
    console.log('Admin panel initialized');
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminPanel);
} else {
    initAdminPanel();
}

// Make functions available globally for HTML event handlers
window.toggleUserStatus = toggleUserStatus;
