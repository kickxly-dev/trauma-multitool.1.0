// Admin Panel - Clean Minimal Version

// Global state
let adminInitialized = false;
// Initialize API base URL
const API_BASE_URL = (window.API_BASE_URL || '').replace(/\/$/, ''); // Remove trailing slash if present
console.log('Initialized API_BASE_URL:', API_BASE_URL);

// Helper function to make API requests
async function makeApiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem('trauma_auth_token');
    
    console.log('Making API request to:', url, 'with token:', token ? 'present' : 'missing');
    
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
        
        console.log(`API Response (${response.status} ${response.statusText}):`, responseText);
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        try {
            return JSON.parse(responseText);
        } catch (e) {
            console.error('Failed to parse JSON response:', e);
            throw new Error('Invalid JSON response from server');
        }
    } catch (error) {
        console.error('API request error:', error);
        throw error;
    }
}

// Simple loading state
function showLoading(container) {
    if (!container) return;
    container.innerHTML = `
        <div style="
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 400px;
            color: white;
            font-size: 1.2rem;
        ">
            <div style="text-align: center;">
                <div style="
                    width: 3rem;
                    height: 3rem;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #dc3545;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 1rem;
                "></div>
                <h4>Loading Admin Panel...</h4>
            </div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
}

// Show error message
function showError(container, message) {
    if (!container) return;
    container.innerHTML = `
        <div style="
            padding: 1rem;
            background: #ff4444;
            color: white;
            border-radius: 4px;
            margin: 1rem 0;
        ">
            <strong>Error:</strong> ${message}
        </div>
    `;
}

// Toggle admin panel
function toggleAdminPanel() {
    console.log('Toggle admin panel called');
    
    if (!window.currentUser?.isAdmin) {
        showToast('Admin access required', 'warning');
        console.warn('Non-admin user attempted to access admin panel');
        return false;
    }
    
    // Ensure the admin panel is properly initialized
    const adminPanel = document.getElementById('admin-panel');
    if (!adminPanel) {
        console.error('Admin panel element not found');
        return false;
    }
    
    // Check current display state
    const isVisible = window.getComputedStyle(adminPanel).display === 'flex';
    console.log('Admin panel current display:', window.getComputedStyle(adminPanel).display);
    
    // Toggle the display
    if (isVisible) {
        adminPanel.style.display = 'none';
        document.body.classList.remove('admin-panel-open');
        console.log('Hiding admin panel');
    } else {
        adminPanel.style.display = 'flex';
        document.body.classList.add('admin-panel-open');
        console.log('Showing admin panel');
        
        // Initialize the admin panel content if not already done
        if (!window.adminPanelInitialized) {
            initAdminPanel();
            window.adminPanelInitialized = true;
        }
    }
    
    // Prevent default action and stop propagation
    return false;
}

// Load admin content
async function loadAdminContent(container) {
    showLoading(container);
    
    try {
        console.log('Loading admin content...');
        
        // Use the makeApiRequest helper to fetch stats
        const stats = await makeApiRequest('/admin/stats');
        console.log('Received stats:', stats);
        
        // Format the numbers for display
        const formatNumber = (num) => {
            if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
            return num.toString();
        };
        
        // Create the admin dashboard HTML with real data
        container.innerHTML = `
            <div style="
                background: #1a1a1a;
                border-radius: 8px;
                padding: 1.5rem;
                margin-bottom: 1.5rem;
            ">
                <h3 style="margin-top: 0; color: #dc3545;">Admin Dashboard</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1.5rem 0;">
                    <div style="background: #2a2a2a; padding: 1rem; border-radius: 6px; text-align: center;">
                        <div style="font-size: 2rem; color: #dc3545; margin-bottom: 0.5rem;">${stats.data?.totalUsers || 0}</div>
                        <div>Total Users</div>
                    </div>
                    <div style="background: #2a2a2a; padding: 1rem; border-radius: 6px; text-align: center;">
                        <div style="font-size: 2rem; color: #0d6efd; margin-bottom: 0.5rem;">${stats.data?.activeSessions || 0}</div>
                        <div>Active Sessions</div>
                    </div>
                    <div style="background: #2a2a2a; padding: 1rem; border-radius: 6px; text-align: center;">
                        <div style="font-size: 2rem; color: #198754; margin-bottom: 0.5rem;">${stats.data?.todayLogins || 0}</div>
                        <div>Today's Logins</div>
                    </div>
                </div>
                
                <div style="margin-top: 2rem;">
                    <h4>Quick Actions</h4>
                    <div style="display: flex; gap: 1rem; margin-top: 1rem; flex-wrap: wrap;">
                        <button id="restart-system" class="btn btn-danger">
                            <i class="bi bi-arrow-repeat me-1"></i>
                            Restart System
                        </button>
                        <button id="refresh-stats" class="btn btn-primary">
                            <i class="bi bi-arrow-clockwise me-1"></i>
                            Refresh Stats
                        </button>
                    </div>
                </div>
            </div>
            
            <div style="background: #1a1a1a; border-radius: 8px; padding: 1.5rem;">
                <h4 style="margin-top: 0; color: #dc3545;">Recent Activity</h4>
                <div id="recent-activity" style="color: #aaa;">
                    ${stats.data?.recentActivity?.length 
                        ? stats.data.recentActivity.map(activity => `
                            <div style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #333;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                    <strong>${activity.user?.username || 'System'}</strong>
                                    <small>${new Date(activity.createdAt).toLocaleString()}</small>
                                </div>
                                <div>${activity.action}: ${activity.details || 'No details'}</div>
                                ${activity.ipAddress ? `<div><small>${activity.ipAddress}</small></div>` : ''}
                            </div>
                        `).join('')
                        : '<div style="font-style: italic;">No recent activity to display</div>'
                    }
                </div>
            </div>
        `;
        
        // Add event listeners
        document.getElementById('restart-system')?.addEventListener('click', () => {
            if (confirm('Are you sure you want to restart the system?')) {
                alert('System restart initiated...');
            }
        });
        
        document.getElementById('refresh-stats')?.addEventListener('click', () => {
            loadAdminContent(container);
        });
        
    } catch (error) {
        console.error('Error loading admin content:', error);
        showError(container, 'Failed to load admin panel. Please try again.');
    }
}

// Initialize admin panel
document.addEventListener('DOMContentLoaded', function() {
    // Close button
    const closeBtn = document.getElementById('close-admin');
    if (closeBtn) {
        closeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleAdminPanel();
        });
    }
    
    // Close admin panel when clicking outside content
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) {
        adminPanel.addEventListener('click', function(e) {
            if (e.target === adminPanel) {
                toggleAdminPanel();
            }
        });
    }
    
    // Prevent clicks inside admin content from closing the panel
    const adminContent = document.querySelector('.admin-content');
    if (adminContent) {
        adminContent.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
    
    // Tab switching
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const tabId = this.getAttribute('data-tab');
            loadTabContent(tabId);
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Initialize admin panel content if it's already visible
    if (adminPanel && window.getComputedStyle(adminPanel).display === 'flex') {
        initAdminPanel();
        loadDashboardStats();
    }
});

// Update admin UI with current user data
function updateAdminUI() {
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    
    if (userAvatar) {
        userAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
        // Set random avatar color
        const colors = ['#dc3545', '#0d6efd', '#198754', '#6f42c1', '#fd7e14', '#20c997'];
        userAvatar.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    }
    
    if (userName) {
        userName.textContent = currentUser.username;
    }
}

// Load data for the admin panel
async function loadAdminData() {
    const modalBody = document.querySelector('#adminPanelModal .modal-body');
    
    try {
        // Show loading state
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Loading admin panel...</p>
                </div>
            `;
        }

        // Check authentication
        if (!window.currentUser || !window.currentUser.token) {
            throw new Error('Not authenticated. Please log in again.');
        }

        // Load initial tab content
        const activeTab = document.querySelector('.tab-pane.active')?.id || 'dashboard';
        await loadTabContent(`#${activeTab}`);
        
        // Update system status
        await checkSystemStatus();
    } catch (error) {
        console.error('Error loading admin data:', error);
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="alert alert-danger">
                    <h4 class="alert-heading">Error</h4>
                    <p>Failed to load admin data: ${error.message || 'Unknown error'}</p>
                    <p>Please try again or contact support if the problem persists.</p>
                </div>
            `;
        }
    }
}

// Load content for a specific tab
async function loadTabContent(tabId) {
    const modalBody = document.querySelector('#adminPanelModal .modal-body');
    
    try {
        if (!currentUser || !currentUser.token) {
            throw new Error('Not authenticated');
        }

        // Show loading state for the specific tab
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Loading ${tabId.replace('#', '')}...</p>
                </div>
            `;
        }

        let content = '';
        
        switch(tabId) {
            case '#dashboard':
                content = await loadDashboardStats();
                break;
            case '#users':
                content = await loadUsers();
                break;
            case '#sessions':
                content = await loadSessions();
                break;
            case '#logs':
                content = await loadAuditLogs();
                break;
            default:
                content = '<div class="alert alert-warning">Content not found</div>';
        }

        if (modalBody) {
            modalBody.innerHTML = content || '<div class="alert alert-warning">No data available</div>';
        }
    } catch (error) {
        console.error(`Error loading tab ${tabId}:`, error);
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="alert alert-danger">
                    <h4 class="alert-heading">Error</h4>
                    <p>Failed to load content: ${error.message || 'Unknown error'}</p>
                    <p>Please try again or contact support if the problem persists.</p>
                </div>
            `;
        }
    }
}

// Load users for the users tab
async function loadUsers() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found');
        }
        
        const response = await fetch(`${API_BASE_URL}/admin/users`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
            return;
        }
        
        if (!response.ok) {
            throw new Error(`Failed to fetch users: ${response.statusText}`);
        }
        
        const users = await response.json();
        return await renderUsersTable(users);
    } catch (error) {
        console.error('Error loading users:', error);
        return `
            <div class="alert alert-danger">
                <h4 class="alert-heading">Error Loading Users</h4>
                <p>${error.message || 'Failed to load users'}</p>
            </div>
        `;
    }
}

// Render users in the table
function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>
                <div class="d-flex align-items-center">
                    <div class="user-avatar me-2" style="background-color: ${getRandomColor()}">
                        ${user.username.charAt(0).toUpperCase()}
                    </div>
                    ${user.username}
                    ${user.isAdmin ? '<span class="badge bg-primary ms-2">Admin</span>' : ''}
                </div>
            </td>
            <td>${user.email || 'N/A'}</td>
            <td>${user.role || 'user'}</td>
            <td>
                <span class="badge ${user.isActive ? 'bg-success' : 'bg-secondary'}">
                    ${user.isActive ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary btn-edit-user" data-user-id="${user.id}">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-delete-user" data-user-id="${user.id}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    // Add event listeners to action buttons
    document.querySelectorAll('.btn-edit-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const userId = e.currentTarget.getAttribute('data-user-id');
            editUser(userId);
        });
    });
    
    document.querySelectorAll('.btn-delete-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const userId = e.currentTarget.getAttribute('data-user-id');
            deleteUser(userId);
        });
    });
}

// Load active sessions
async function loadSessions() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found');
        }
        
        const response = await fetch(`${API_BASE_URL}/admin/sessions`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
            return;
        }
        
        if (!response.ok) {
            throw new Error(`Failed to fetch sessions: ${response.statusText}`);
        }
        
        const sessions = await response.json();
        return await renderSessionsTable(sessions);
    } catch (error) {
        console.error('Error loading sessions:', error);
        return `
            <div class="alert alert-danger">
                <h4 class="alert-heading">Error Loading Sessions</h4>
                <p>${error.message || 'Failed to load active sessions'}</p>
            </div>
        `;
    }
}

// Render sessions in the table
async function renderSessionsTable(sessions) {
    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
        return '<div class="alert alert-info">No active sessions</div>';
    }
    
    return `
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>IP Address</th>
                        <th>Last Active</th>
                        <th class="text-end">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${sessions.map(session => `
                        <tr>
                            <td>${session.username || 'Unknown'}</td>
                            <td>${session.ipAddress || 'N/A'}</td>
                            <td>${new Date(session.lastActive).toLocaleString()}</td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-outline-danger" onclick="terminateSession('${session.id}')">
                                    <i class="bi bi-trash"></i> Terminate
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Load audit logs
async function loadAuditLogs() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/logs`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch audit logs');
        }
        
        const logs = await response.json();
        renderAuditLogsTable(logs);
    } catch (error) {
        console.error('Error loading audit logs:', error);
        showToast('Failed to load audit logs', 'error');
    }
}

// Render audit logs in the table
async function renderAuditLogsTable(logs) {
    if (!logs || !Array.isArray(logs)) {
        return '<div class="alert alert-warning">No audit logs available</div>';
    }
    
    return `
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead>
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
                            <td>${log.userId || 'System'}</td>
                            <td>${log.action}</td>
                            <td>${log.details || 'No details available'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        const token = localStorage.getItem('trauma_auth_token');
        if (!token) {
            throw new Error('No authentication token found');
        }
        
        const response = await fetch(`${API_BASE_URL}/admin/stats`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 401) {
            // Handle unauthorized (token expired or invalid)
            localStorage.removeItem('token');
            window.location.href = '/login';
            return;
        }
        
        if (!response.ok) {
            throw new Error(`Failed to fetch dashboard stats: ${response.statusText}`);
        }
        
        const stats = await response.json();
        
        // Return the HTML content for the dashboard
        return `
            <div class="row g-4">
                <div class="col-md-6 col-lg-3">
                    <div class="card bg-primary text-white h-100">
                        <div class="card-body">
                            <h5 class="card-title">Total Users</h5>
                            <h2 class="mb-0">${stats.totalUsers || 0}</h2>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-lg-3">
                    <div class="card bg-success text-white h-100">
                        <div class="card-body">
                            <h5 class="card-title">Active Sessions</h5>
                            <h2 class="mb-0">${stats.activeSessions || 0}</h2>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-lg-3">
                    <div class="card bg-info text-white h-100">
                        <div class="card-body">
                            <h5 class="card-title">API Requests</h5>
                            <h2 class="mb-0">${stats.apiRequests || 0}</h2>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 col-lg-3">
                    <div class="card bg-warning text-dark h-100">
                        <div class="card-body">
                            <h5 class="card-title">System Status</h5>
                            <h2 class="mb-0">${stats.systemStatus || 'Unknown'}</h2>
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
                            ${stats.recentActivity && stats.recentActivity.length > 0 
                                ? `<div class="list-group">
                                    ${stats.recentActivity.map(activity => `
                                        <div class="list-group-item">
                                            <div class="d-flex w-100 justify-content-between">
                                                <h6 class="mb-1">${activity.action}</h6>
                                                <small>${new Date(activity.timestamp).toLocaleString()}</small>
                                            </div>
                                            <p class="mb-1">${activity.details}</p>
                                            <small>User: ${activity.userId || 'System'}</small>
                                        </div>
                                    `).join('')}
                                </div>`
                                : '<p class="text-muted">No recent activity</p>'
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        showToast('Failed to load dashboard statistics', 'error');
    }
}

// Initialize admin panel
function initAdminPanel() {
    console.log('Initializing admin panel...');
    const adminPanel = document.getElementById('admin-panel');
    const adminContent = document.querySelector('.admin-content');
    
    if (!adminPanel || !adminContent) {
        console.error('Admin panel or content element not found');
        return;
    }
    
    // Make sure the panel is visible
    adminPanel.style.display = 'flex';
    
    // Show loading state
    adminContent.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Loading admin panel...</p>
        </div>
    `;
    
    // Ensure the admin panel is on top
    adminPanel.style.zIndex = '1050';
    
    // Set up the admin panel content with a dark theme and icons
    adminContent.innerHTML = `
        <div class="row mb-4">
            <div class="col-12">
                <div class="card shadow-sm">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h5 class="mb-0"><i class="bi bi-speedometer2 me-2"></i>System Overview</h5>
                        <button class="btn btn-sm btn-outline-light" id="refresh-stats">
                            <i class="bi bi-arrow-clockwise"></i> Refresh
                        </button>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-3 mb-3 mb-md-0">
                                <div class="card bg-dark text-white">
                                    <div class="card-body text-center">
                                        <div class="d-flex justify-content-between align-items-center mb-2">
                                            <i class="bi bi-people fs-4 text-primary"></i>
                                            <span class="badge bg-primary">Users</span>
                                        </div>
                                        <h3 class="mb-1" id="total-users">0</h3>
                                        <p class="small text-muted mb-0">Total Registered</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3 mb-3 mb-md-0">
                                <div class="card bg-dark text-white">
                                    <div class="card-body text-center">
                                        <div class="d-flex justify-content-between align-items-center mb-2">
                                            <i class="bi bi-laptop fs-4 text-success"></i>
                                            <span class="badge bg-success">Active</span>
                                        </div>
                                        <h3 class="mb-1" id="active-sessions">0</h3>
                                        <p class="small text-muted mb-0">Active Sessions</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3 mb-3 mb-md-0">
                                <div class="card bg-dark text-white">
                                    <div class="card-body text-center">
                                        <div class="d-flex justify-content-between align-items-center mb-2">
                                            <i class="bi bi-server fs-4 text-info"></i>
                                            <span class="badge bg-info">Status</span>
                                        </div>
                                        <h3 class="mb-1" id="system-status">
                                            <span class="badge bg-success">Online</span>
                                        </h3>
                                        <p class="small text-muted mb-0">System Status</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card bg-dark text-white">
                                    <div class="card-body text-center">
                                        <div class="d-flex justify-content-between align-items-center mb-2">
                                            <i class="bi bi-clock-history fs-4 text-warning"></i>
                                            <span class="badge bg-warning">Uptime</span>
                                        </div>
                                        <h3 class="mb-1" id="server-time">--:--:--</h3>
                                        <p class="small text-muted mb-0">Server Time</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="row">
            <div class="col-md-8 mb-4">
                <div class="card shadow-sm h-100">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h5 class="mb-0"><i class="bi bi-activity me-2"></i>Recent Activity</h5>
                        <button class="btn btn-sm btn-outline-light" id="refresh-activity">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                    </div>
                    <div class="card-body p-0">
                        <div id="recent-activity" class="list-group list-group-flush">
                            <div class="text-center py-4">
                                <div class="spinner-border text-primary" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                                <p class="mt-2 mb-0">Loading activity...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card shadow-sm h-100">
                    <div class="card-header">
                        <h5 class="mb-0"><i class="bi bi-lightning-charge me-2"></i>Quick Actions</h5>
                    </div>
                    <div class="card-body">
                        <div class="d-grid gap-2">
                            <button class="btn btn-primary" id="view-users">
                                <i class="bi bi-people me-2"></i> Manage Users
                            </button>
                            <button class="btn btn-outline-primary" id="view-logs">
                                <i class="bi bi-journal-text me-2"></i> View System Logs
                            </button>
                            <button class="btn btn-outline-warning" id="clear-cache">
                                <i class="bi bi-trash me-2"></i> Clear Cache
                            </button>
                            <button class="btn btn-outline-danger" id="system-restart">
                                <i class="bi bi-arrow-repeat me-2"></i> Restart System
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Show add user modal
function showAddUserModal() {
    // Implement add user modal
    showToast('Add user functionality coming soon', 'info');
}

// Edit user
function editUser(userId) {
    // Implement edit user functionality
    showToast(`Edit user ${userId} - coming soon`, 'info');
}

// Delete user with confirmation
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete user');
        }
        
        showToast('User deleted successfully', 'success');
        loadUsers(); // Refresh the users list
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Failed to delete user', 'error');
    }
}

// Terminate session
async function terminateSession(sessionId) {
    if (!confirm('Are you sure you want to terminate this session? This will log the user out of this device.')) {
        return;
    }
    
    const modalBody = document.querySelector('#adminPanelModal .modal-body');
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found');
        }
        
        // Show loading state
        if (modalBody) {
            const currentContent = modalBody.innerHTML;
            modalBody.innerHTML = `
                <div class="text-center py-3">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Terminating session...</span>
                    </div>
                    <p class="mt-2">Terminating session...</p>
                </div>
                ${currentContent}
            `;
        }
        
        const response = await fetch(`${API_BASE_URL}/admin/sessions/${sessionId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
            return;
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to terminate session');
        }
        
        // Reload the sessions tab
        await loadTabContent('#sessions');
        
        // Show success message
        if (modalBody) {
            const alert = document.createElement('div');
            alert.className = 'alert alert-success alert-dismissible fade show';
            alert.role = 'alert';
            alert.innerHTML = `
                <i class="bi bi-check-circle me-2"></i>
                Session terminated successfully
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            modalBody.prepend(alert);
        }
    } catch (error) {
        console.error('Error terminating session:', error);
        
        // Show error message
        if (modalBody) {
            const alert = document.createElement('div');
            alert.className = 'alert alert-danger alert-dismissible fade show';
            alert.role = 'alert';
            alert.innerHTML = `
                <i class="bi bi-exclamation-triangle me-2"></i>
                ${error.message || 'Failed to terminate session'}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            modalBody.prepend(alert);
        }
    }
}

// Helper function to generate a random color
function getRandomColor() {
    const colors = ['#dc3545', '#0d6efd', '#198754', '#6f42c1', '#fd7e14', '#20c997'];
    return colors[Math.floor(Math.random() * colors.length)];
}
