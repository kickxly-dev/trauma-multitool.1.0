// Admin Panel Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Tab switching
    const tabs = document.querySelectorAll('.admin-tab');
    const tabContents = document.querySelectorAll('.admin-tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const tabId = tab.getAttribute('data-tab') + '-tab';
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // Modal handling
    const modal = document.getElementById('add-user-modal');
    const openModalBtn = document.getElementById('add-user-btn');
    const closeModalBtns = document.querySelectorAll('.close-modal');
    
    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            modal.classList.add('show');
        });
    }
    
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modal.classList.remove('show');
        });
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
    
    // Form submission
    const addUserForm = document.getElementById('add-user-form');
    if (addUserForm) {
        addUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(addUserForm);
            const userData = {
                username: formData.get('username'),
                email: formData.get('email'),
                password: formData.get('password'),
                role: formData.get('role')
            };
            
            try {
                const response = await fetch('/api/admin/users', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('trauma_auth_token')}`
                    },
                    body: JSON.stringify(userData)
                });
                
                if (!response.ok) {
                    throw new Error('Failed to add user');
                }
                
                const data = await response.json();
                showToast('User added successfully', 'success');
                modal.classList.remove('show');
                addUserForm.reset();
                loadUsers();
            } catch (error) {
                console.error('Error adding user:', error);
                showToast('Failed to add user', 'error');
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
        const response = await fetch('/api/admin/stats', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('trauma_auth_token')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load dashboard data');
        
        const data = await response.json();
        
        // Update stats
        document.getElementById('total-users').textContent = data.data.totalUsers || 0;
        document.getElementById('active-sessions').textContent = data.data.activeSessions || 0;
        document.getElementById('today-logins').textContent = data.data.todayLogins || 0;
        
        // Update activity feed
        const activityFeed = document.getElementById('activity-feed');
        if (activityFeed && data.data.recentActions) {
            activityFeed.innerHTML = data.data.recentActions
                .map(activity => `
                    <div class="activity-item">
                        <div class="activity-icon">
                            <i class="bi ${getActivityIcon(activity.action)}"></i>
                        </div>
                        <div class="activity-details">
                            <div class="activity-message">${formatActivityMessage(activity)}</div>
                            <div class="activity-time">${new Date(activity.createdAt).toLocaleString()}</div>
                        </div>
                    </div>
                `)
                .join('');
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showToast('Failed to load dashboard data', 'error');
    }
}

// Load users
async function loadUsers() {
    const usersList = document.getElementById('users-list');
    if (!usersList) return;
    
    try {
        const response = await fetch('/api/admin/users', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('trauma_auth_token')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load users');
        
        const data = await response.json();
        
        if (usersList) {
            usersList.innerHTML = data.data.map(user => `
                <tr>
                    <td>${user.username}</td>
                    <td>${user.email || '-'}</td>
                    <td><span class="badge ${user.role === 'admin' ? 'bg-primary' : 'bg-secondary'}">${user.role}</span></td>
                    <td><span class="status-indicator ${user.isActive ? 'online' : 'offline'}">${user.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}</td>
                    <td class="actions">
                        <button class="btn btn-sm btn-secondary" onclick="editUser('${user._id}')">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteUser('${user._id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showToast('Failed to load users', 'error');
        if (usersList) {
            usersList.innerHTML = '<tr><td colspan="6">Error loading users. Please try again.</td></tr>';
        }
    }
}

// Load sessions
async function loadSessions() {
    const sessionsList = document.getElementById('sessions-list');
    if (!sessionsList) return;
    
    try {
        const response = await fetch('/api/admin/sessions', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('trauma_auth_token')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load sessions');
        
        const data = await response.json();
        
        if (sessionsList) {
            sessionsList.innerHTML = data.data.map(session => `
                <tr>
                    <td>${session.user?.username || 'Unknown'}</td>
                    <td>${session.ipAddress || '-'}</td>
                    <td>${getDeviceInfo(session.userAgent)}</td>
                    <td>${new Date(session.updatedAt).toLocaleString()}</td>
                    <td><span class="status-indicator ${session.isActive ? 'online' : 'offline'}">${session.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td class="actions">
                        <button class="btn btn-sm btn-danger" onclick="terminateSession('${session._id}')">
                            <i class="bi bi-x-circle"></i> Terminate
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
        showToast('Failed to load sessions', 'error');
        if (sessionsList) {
            sessionsList.innerHTML = '<tr><td colspan="6">Error loading sessions. Please try again.</td></tr>';
        }
    }
}

// Helper functions
function getActivityIcon(action) {
    const icons = {
        login: 'bi-box-arrow-in-right',
        logout: 'bi-box-arrow-right',
        create: 'bi-plus-circle',
        update: 'bi-pencil',
        delete: 'bi-trash',
        error: 'bi-exclamation-triangle'
    };
    return icons[action.toLowerCase()] || 'bi-info-circle';
}

function formatActivityMessage(activity) {
    const user = activity.user?.username || 'System';
    const action = activity.action.toLowerCase();
    const details = activity.details || '';
    
    const messages = {
        login: `${user} logged in`,
        logout: `${user} logged out`,
        create: `${user} created ${details}`,
        update: `${user} updated ${details}`,
        delete: `${user} deleted ${details}`
    };
    
    return messages[action] || `${user} performed ${action} ${details}`.trim();
}

function getDeviceInfo(userAgent) {
    if (!userAgent) return 'Unknown';
    
    // Simple device detection
    if (userAgent.includes('Mobile')) {
        return 'Mobile';
    } else if (userAgent.includes('Windows')) {
        return 'Windows PC';
    } else if (userAgent.includes('Mac')) {
        return 'Mac';
    } else if (userAgent.includes('Linux')) {
        return 'Linux';
    }
    
    return 'Desktop';
}

// Global functions for inline event handlers
window.editUser = function(userId) {
    // TODO: Implement edit user
    showToast('Edit user: ' + userId, 'info');
};

window.deleteUser = async function(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('trauma_auth_token')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to delete user');
        
        showToast('User deleted successfully', 'success');
        loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Failed to delete user', 'error');
    }
};

window.terminateSession = async function(sessionId) {
    if (!confirm('Are you sure you want to terminate this session?')) return;
    
    try {
        const response = await fetch(`/api/admin/sessions/${sessionId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('trauma_auth_token')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to terminate session');
        
        showToast('Session terminated successfully', 'success');
        loadSessions();
    } catch (error) {
        console.error('Error terminating session:', error);
        showToast('Failed to terminate session', 'error');
    }
};

// Toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast show ${type}`;
    toast.innerHTML = `
        <div class="toast-body">
            <i class="bi ${getToastIcon(type)}"></i>
            <span>${message}</span>
        </div>
    `;
    
    const container = document.getElementById('toast-container');
    container.appendChild(toast);
    
    // Auto remove toast after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function getToastIcon(type) {
    const icons = {
        success: 'bi-check-circle',
        error: 'bi-x-circle',
        warning: 'bi-exclamation-triangle',
        info: 'bi-info-circle'
    };
    return icons[type] || 'bi-info-circle';
}
