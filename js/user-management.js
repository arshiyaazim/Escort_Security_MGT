// ============================================
// USER MANAGEMENT MODULE
// Pattern: Single state array, single refresh function
// ============================================

// Single source of truth
let users = [];

// State tracking
let editingUserId = null;

/**
 * Single refresh function - the ONLY way to update UI
 */
async function refreshUsers() {
    // Show loading state
    if (typeof showTableLoading === 'function') {
        showTableLoading('userTableBody', 5);
    }
    
    const response = await request("getUsers", {});
    if (response.success) {
        users = response.data || [];
    } else {
        users = [];
        if (response.message !== "Unauthorized") {
            showToast(response.message, "error");
        }
    }
    renderUserTable();
}

/**
 * Render user table from state
 */
function renderUserTable() {
    const tbody = document.getElementById("userTableBody");
    if (!tbody) return;

    if (users.length === 0) {
        if (typeof showEmptyState === 'function') {
            showEmptyState('userTableBody', 'No users found. Click "Add User" to create one.', 5, 'fa-users');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-10 text-center text-gray-500">
                        No users found
                    </td>
                </tr>
            `;
        }
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="h-10 w-10 flex-shrink-0 rounded-full bg-blue-100 flex items-center justify-center">
                        <span class="text-blue-600 font-medium text-sm">
                            ${user.username.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${escapeHtml(user.username)}</div>
                        <div class="text-sm text-gray-500">ID: ${user.id}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeClass(user.role)}">
                    ${user.role}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(user.status)}">
                    ${user.status}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${user.createdAt}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button onclick="openEditUserModal('${user.id}')" 
                        class="text-blue-600 hover:text-blue-900 mr-3">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="resetUserPassword('${user.id}')" 
                        class="text-yellow-600 hover:text-yellow-900 mr-3">
                    <i class="fas fa-key"></i>
                </button>
                <button onclick="toggleUserStatus('${user.id}')" 
                        class="text-orange-600 hover:text-orange-900 mr-3">
                    <i class="fas fa-${user.status === 'Active' ? 'ban' : 'check-circle'}"></i>
                </button>
                <button onclick="confirmDeleteUser('${user.id}')" 
                        class="text-red-600 hover:text-red-900">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Get role badge CSS class
 */
function getRoleBadgeClass(role) {
    switch (role) {
        case 'Admin':
            return 'bg-purple-100 text-purple-800';
        case 'Operations':
            return 'bg-blue-100 text-blue-800';
        case 'Finance':
            return 'bg-emerald-100 text-emerald-800';
        case 'Auditor':
            return 'bg-amber-100 text-amber-800';
        case 'Viewer':
            return 'bg-gray-100 text-gray-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

/**
 * Get status badge CSS class
 */
function getStatusBadgeClass(status) {
    return status === 'Active' 
        ? 'bg-green-100 text-green-800' 
        : 'bg-red-100 text-red-800';
}

/**
 * Open modal to create new user
 */
function openCreateUserModal() {
    editingUserId = null;
    document.getElementById("modalTitle").textContent = "Create New User";
    document.getElementById("userForm").reset();
    document.getElementById("passwordGroup").classList.remove("hidden");
    document.getElementById("userPassword").required = true;
    document.getElementById("userModal").classList.remove("hidden");
}

/**
 * Open modal to edit existing user
 */
function openEditUserModal(userId) {
    const user = users.find(u => String(u.id) === String(userId));
    if (!user) return;

    editingUserId = userId;
    document.getElementById("modalTitle").textContent = "Edit User";
    document.getElementById("userUsername").value = user.username;
    document.getElementById("userRole").value = user.role;
    
    // Hide password field for editing
    document.getElementById("passwordGroup").classList.add("hidden");
    document.getElementById("userPassword").required = false;
    
    document.getElementById("userModal").classList.remove("hidden");
}

/**
 * Close user modal
 */
function closeUserModal() {
    document.getElementById("userModal").classList.add("hidden");
    document.getElementById("userForm").reset();
    editingUserId = null;
}

/**
 * Handle user form submission
 */
async function handleUserSubmit(event) {
    event.preventDefault();
    
    const form = document.getElementById('userForm');
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    const restoreBtn = typeof setButtonLoading === 'function' && submitBtn
        ? setButtonLoading(submitBtn, 'Saving...') 
        : () => {};

    const username = document.getElementById("userUsername").value.trim();
    const password = document.getElementById("userPassword").value;
    const role = document.getElementById("userRole").value;

    if (!username) {
        showToast("Username is required", "error");
        restoreBtn();
        return;
    }

    let response;
    try {
        if (editingUserId) {
            // Update existing user
            response = await request("updateUser", {
                id: editingUserId,
                role: role
            });
        } else {
            // Create new user
            if (!password) {
                showToast("Password is required", "error");
                restoreBtn();
                return;
            }
            if (password.length < 6) {
                showToast("Password must be at least 6 characters", "error");
                restoreBtn();
                return;
            }
            response = await request("addUser", {
                id: `user-${Date.now()}`,
                username: username,
                password: password,
                role: role,
                createdAt: new Date().toISOString().split('T')[0]
            });
        }

        if (response.success) {
            showToast(response.message, "success");
            closeUserModal();
            await refreshUsers();
        } else {
            showToast(response.message, "error");
        }
    } catch (error) {
        console.error("Error saving user:", error);
        showToast("Error saving user", "error");
    } finally {
        restoreBtn();
    }
}

/**
 * Reset user password
 */
async function resetUserPassword(userId) {
    const user = users.find(u => String(u.id) === String(userId));
    if (!user) return;

    const newPassword = prompt(`Enter new password for ${user.username}:`);
    if (!newPassword) return;

    if (newPassword.length < 6) {
        showToast("Password must be at least 6 characters", "error");
        return;
    }

    const response = await request("resetPassword", {
        id: userId,
        newPassword: newPassword
    });

    if (response.success) {
        showToast("Password reset successfully", "success");
    } else {
        showToast(response.message, "error");
    }
}

/**
 * Toggle user active/disabled status
 */
async function toggleUserStatus(userId) {
    const user = users.find(u => String(u.id) === String(userId));
    if (!user) return;

    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
        showToast("Cannot disable your own account", "error");
        return;
    }

    const newStatus = user.status === 'Active' ? 'Disabled' : 'Active';
    const action = newStatus === 'Active' ? 'enable' : 'disable';
    
    let confirmed = false;
    if (typeof confirmStatusChange === 'function') {
        confirmed = await confirmStatusChange(user.username, newStatus);
    } else {
        confirmed = confirm(`Are you sure you want to ${action} user "${user.username}"?`);
    }
    
    if (!confirmed) return;

    const response = await request("updateUser", {
        id: userId,
        status: newStatus
    });

    if (response.success) {
        showToast(`User ${action}d successfully`, "success");
        await refreshUsers();
    } else {
        showToast(response.message, "error");
    }
}

/**
 * Confirm and delete user
 */
async function confirmDeleteUser(userId) {
    const user = users.find(u => String(u.id) === String(userId));
    if (!user) return;

    let confirmed = false;
    if (typeof confirmDelete === 'function') {
        confirmed = await confirmDelete(user.username);
    } else {
        confirmed = confirm(`Are you sure you want to permanently delete user "${user.username}"? This action cannot be undone.`);
    }
    
    if (!confirmed) return;

    const response = await request("deleteUser", { id: userId });

    if (response.success) {
        showToast("User deleted successfully", "success");
        await refreshUsers();
    } else {
        showToast(response.message, "error");
    }
}

/**
 * Simple HTML escaping
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show toast notification
 */
function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const bgColor = {
        success: "bg-green-500",
        error: "bg-red-500",
        info: "bg-blue-500",
        warning: "bg-yellow-500"
    }[type] || "bg-blue-500";

    const toast = document.createElement("div");
    toast.className = `${bgColor} text-white px-6 py-3 rounded-lg shadow-lg mb-2 transform transition-all duration-300`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("opacity-0", "translate-x-full");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener("DOMContentLoaded", async () => {
    // Verify session with backend before proceeding
    if (typeof requireAuth === 'function') {
        const authed = await requireAuth();
        if (!authed) return;
    }
    
    // Render user info in header
    if (typeof renderUserInfo === 'function') {
        renderUserInfo('userInfo');
    }
    
    // Initialize UX enhancements
    if (typeof initFormValidation === 'function') initFormValidation('userForm');
    if (typeof initModalAccessibility === 'function') initModalAccessibility('userModal', closeUserModal);

    // Setup form handler
    const form = document.getElementById("userForm");
    if (form) {
        form.addEventListener("submit", handleUserSubmit);
    }

    // Initial load
    await refreshUsers();
});
