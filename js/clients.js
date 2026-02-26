// Client Management Module
// Data storage only - NO calculations

// ============================================
// SINGLE SOURCE OF TRUTH
// ============================================
let clients = [];

// ============================================
// PAGINATION STATE
// ============================================
let clientsPaginationState = createPaginationState(10);
let clientsFilteredData = [];
let clientsSearchTerm = '';
let clientsStatusFilter = 'all'; // 'all' | 'active' | 'inactive'

// ============================================
// REFRESH FUNCTION (EXPLICIT ONLY)
// ============================================

/**
 * Refresh clients data from backend
 * Must be called explicitly - no auto-refresh
 */
async function refreshClients() {
    // Show loading state
    if (typeof showTableLoading === 'function') {
        showTableLoading('clientsTableBody', 10);
    }
    
    try {
        const response = await request("getClients", {});
        if (response.success && Array.isArray(response.data)) {
            clients = response.data;
        } else {
            clients = [];
        }
        applyClientFilters();
    } catch (error) {
        console.error("Failed to refresh clients:", error);
        clients = [];
        applyClientFilters();
        if (typeof showToast === 'function') {
            showToast('Failed to load clients', 'error');
        }
    }
}

// ============================================
// FILTERING & SEARCH
// ============================================

/**
 * Apply search and status filters, then render
 */
function applyClientFilters() {
    let filtered = clients.slice();

    // Status filter (case-insensitive, trimmed)
    if (clientsStatusFilter === 'active') {
        filtered = filtered.filter(c => {
            var s = (c.status || '').toString().trim().toLowerCase();
            return s === '' || s === 'active';
        });
    } else if (clientsStatusFilter === 'inactive') {
        filtered = filtered.filter(c => {
            var s = (c.status || '').toString().trim().toLowerCase();
            return s === 'inactive';
        });
    }

    // Search filter (by displayName, id, contactPerson)
    if (clientsSearchTerm) {
        var term = clientsSearchTerm.toLowerCase();
        filtered = filtered.filter(c => {
            var displayName = getClientDisplayName(c).toLowerCase();
            var id = (c.id || '').toString().toLowerCase();
            var contact = (c.contactPerson || '').toString().toLowerCase();
            var phone = (c.phone || '').toString().toLowerCase();
            return displayName.includes(term) || id.includes(term) || contact.includes(term) || phone.includes(term);
        });
    }

    renderClientsTable(filtered);
}

/**
 * Handle search input
 */
function handleClientSearch() {
    var input = document.getElementById('clientSearch');
    clientsSearchTerm = input ? input.value.trim() : '';
    applyClientFilters();
}

/**
 * Handle status filter change
 */
function handleStatusFilter() {
    var select = document.getElementById('clientStatusFilter');
    clientsStatusFilter = select ? select.value : 'all';
    applyClientFilters();
}

// ============================================
// RENDER FUNCTION
// ============================================

/**
 * Render clients table from provided data
 * Uses getClientDisplayName for canonical display name
 * @param {Array} data - Array of client objects
 */
function renderClientsTable(data) {
    clientsFilteredData = (data || []).slice().sort((a, b) => {
        const nameA = getClientDisplayName(a).toLowerCase();
        const nameB = getClientDisplayName(b).toLowerCase();
        return nameA.localeCompare(nameB);
    });
    clientsPaginationState.currentPage = 1;
    renderPaginatedClientsTable();
}

/**
 * Render paginated clients table
 */
function renderPaginatedClientsTable() {
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;

    if (!clientsFilteredData || clientsFilteredData.length === 0) {
        if (typeof showEmptyState === 'function') {
            showEmptyState('clientsTableBody', 'No clients found. Add your first client using the form above.', 10, 'fa-building');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="px-4 py-8 text-center text-gray-500">
                        No clients found
                    </td>
                </tr>
            `;
        }
        const paginationContainer = document.getElementById('clientsPagination');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const result = paginate(clientsFilteredData, clientsPaginationState.currentPage, clientsPaginationState.pageSize);

    tbody.innerHTML = result.items.map((client, localIndex) => {
        const displayIndex = result.startIndex + localIndex;
        return `
        <tr class="border-b border-gray-200 hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-600">${displayIndex}</td>
            <td class="px-4 py-3 text-sm text-gray-800">${escapeHtml(client.id || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-800">${escapeHtml(getClientDisplayName(client))}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(client.contactPerson || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(client.phone || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${client.contactRate || ''}</td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 text-xs rounded-full ${getBillStatusClass(client.billStatus)}">
                    ${escapeHtml(client.billStatus || '')}
                </span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">${client.dueAmount || 0}</td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 text-xs rounded-full ${getStatusClass(client.status)}">
                    ${escapeHtml(client.status || '')}
                </span>
            </td>
            <td class="px-4 py-3 text-sm">
                <button onclick="viewClient('${client.id}')" class="text-blue-600 hover:text-blue-800 mr-2">View</button>
                <button onclick="editClient('${client.id}')" class="text-green-600 hover:text-green-800 mr-2">Edit</button>
                <button onclick="deleteClient('${client.id}')" class="text-red-600 hover:text-red-800">Delete</button>
            </td>
        </tr>
        `;
    }).join('');

    renderPaginationControls('clientsPagination', {
        ...result,
        pageSize: clientsPaginationState.pageSize
    }, {
        onPageChange: (page) => {
            clientsPaginationState.currentPage = page;
            renderPaginatedClientsTable();
        },
        onPageSizeChange: (size) => {
            clientsPaginationState.pageSize = size;
            clientsPaginationState.currentPage = 1;
            renderPaginatedClientsTable();
        }
    });
}

/**
 * Get CSS class for status badge (case-insensitive)
 * @param {string} status - Client status
 * @returns {string} CSS classes
 */
function getStatusClass(status) {
    var s = (status || '').toString().trim().toLowerCase();
    if (s === 'active' || s === '') {
        return 'bg-green-100 text-green-800';
    } else if (s === 'inactive') {
        return 'bg-gray-100 text-gray-800';
    }
    return 'bg-gray-100 text-gray-800';
}

/**
 * Get CSS class for bill status badge
 * @param {string} billStatus - Bill status
 * @returns {string} CSS classes
 */
function getBillStatusClass(billStatus) {
    switch (billStatus) {
        case 'Paid':
            return 'bg-green-100 text-green-800';
        case 'Due':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================
// ID GENERATION
// ============================================

/**
 * Generate next client ID with leading zeros
 * @returns {string} Next client ID (e.g., "0001", "0002")
 */
function generateNextClientId() {
    if (clients.length === 0) {
        return '0001';
    }
    
    // Find the highest existing ID
    let maxId = 0;
    for (const client of clients) {
        const numId = parseInt(client.id, 10);
        if (!isNaN(numId) && numId > maxId) {
            maxId = numId;
        }
    }
    
    // Increment and pad with leading zeros
    const nextId = maxId + 1;
    return String(nextId).padStart(4, '0');
}

// ============================================
// FORM HANDLING
// ============================================

/**
 * Handle form submission for add/edit client
 * @param {Event} event - Form submit event
 */
async function handleSubmit(event) {
    event.preventDefault();

    const form = document.getElementById('clientForm');
    if (!form) return;
    
    // Validate form
    if (typeof validateForm === 'function' && !validateForm('clientForm')) {
        return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const restoreBtn = typeof setButtonLoading === 'function' 
        ? setButtonLoading(submitBtn, 'Saving...') 
        : () => {};

    // Check if editing existing client
    const existingId = form.dataset.editingId;
    
    // Auto-generate ID for new clients
    const clientId = existingId || generateNextClientId();

    // Collect form data - NO calculations
    const companyNameVal = String(form.companyName.value).trim();
    const payload = {
        id: String(clientId),
        companyName: companyNameVal,
        name: companyNameVal, // Keep name synced with companyName for backward compat
        contactRate: form.contactRate.value ? Number(form.contactRate.value) : 0,
        contactPerson: String(form.contactPerson.value).trim(),
        phone: String(form.phone.value).trim(),
        email: String(form.email.value).trim(),
        address: String(form.address.value).trim(),
        serviceStartDate: String(form.serviceStartDate.value).trim(),
        status: String(form.status.value).trim(),
        lastBillSubmitted: String(form.lastBillSubmitted.value).trim(),
        billStatus: String(form.billStatus.value).trim(),
        dueAmount: form.dueAmount.value ? Number(form.dueAmount.value) : 0,
        assignedEmployeeSalary: form.assignedEmployeeSalary.value ? Number(form.assignedEmployeeSalary.value) : 0,
        createdAt: existingId ? form.dataset.createdAt : getTodayISO()
    };

    try {
        const response = await request("addOrUpdateClient", payload);
        if (response.success) {
            resetForm();
            await refreshClients();
            if (typeof showToast === 'function') {
                showToast('Client saved successfully', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to save client', 'error');
            }
        }
    } catch (error) {
        console.error("Error saving client:", error);
        if (typeof showToast === 'function') {
            showToast('Error saving client', 'error');
        }
    } finally {
        restoreBtn();
    }
}

/**
 * Reset form to initial state
 */
function resetForm() {
    const form = document.getElementById('clientForm');
    if (form) {
        form.reset();
        delete form.dataset.editingId;
        delete form.dataset.createdAt;
    }
    document.getElementById('formTitle').textContent = 'Add New Client';
}

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * View client details
 * @param {string} id - Client ID (string)
 */
function viewClient(id) {
    const client = clients.find(c => String(c.id) === String(id));
    if (!client) {
        console.error("Client not found:", id);
        return;
    }

    // Build details HTML
    const details = `
        <div class="space-y-2">
            <p><strong>Client ID:</strong> ${escapeHtml(client.id)}</p>
            <p><strong>Company Name:</strong> ${escapeHtml(getClientDisplayName(client))}</p>
            <p><strong>Contact Rate:</strong> ${client.contactRate}</p>
            <p><strong>Contact Person:</strong> ${escapeHtml(client.contactPerson)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(client.phone)}</p>
            <p><strong>Email:</strong> ${escapeHtml(client.email || 'N/A')}</p>
            <p><strong>Address:</strong> ${escapeHtml(client.address)}</p>
            <p><strong>Service Start Date:</strong> ${escapeHtml(client.serviceStartDate)}</p>
            <p><strong>Assigned Employee Salary:</strong> ${client.assignedEmployeeSalary}</p>
            <p><strong>Due Amount:</strong> ${client.dueAmount}</p>
            <p><strong>Bill Status:</strong> ${escapeHtml(client.billStatus)}</p>
            <p><strong>Last Bill Submitted:</strong> ${escapeHtml(client.lastBillSubmitted || 'N/A')}</p>
            <p><strong>Status:</strong> ${escapeHtml(client.status)}</p>
            <p><strong>Created At:</strong> ${escapeHtml(client.createdAt)}</p>
        </div>
    `;

    showModal('Client Details', details);
}

/**
 * Edit client - populate form with client data
 * @param {string} id - Client ID (string)
 */
function editClient(id) {
    const client = clients.find(c => String(c.id) === String(id));
    if (!client) {
        console.error("Client not found:", id);
        return;
    }

    const form = document.getElementById('clientForm');
    if (!form) return;

    // Store editing ID and created date
    form.dataset.editingId = client.id;
    form.dataset.createdAt = client.createdAt;

    // Populate form fields
    form.companyName.value = client.companyName || '';
    form.contactRate.value = client.contactRate || '';
    form.contactPerson.value = client.contactPerson || '';
    form.phone.value = client.phone || '';
    form.email.value = client.email || '';
    form.address.value = client.address || '';
    form.serviceStartDate.value = client.serviceStartDate || '';
    form.assignedEmployeeSalary.value = client.assignedEmployeeSalary || '';
    form.dueAmount.value = client.dueAmount || '';
    form.billStatus.value = client.billStatus || 'Due';
    form.lastBillSubmitted.value = client.lastBillSubmitted || '';
    form.status.value = client.status || 'Active';

    document.getElementById('formTitle').textContent = 'Edit Client';

    // Scroll to form
    form.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Delete client
 * @param {string} id - Client ID (string)
 */
async function deleteClient(id) {
    const client = clients.find(c => String(c.id) === String(id));
    const clientName = client ? getClientDisplayName(client) : 'this client';
    
    let confirmed = false;
    if (typeof confirmDelete === 'function') {
        confirmed = await confirmDelete(clientName);
    } else {
        confirmed = confirm('Are you sure you want to delete this client?');
    }
    
    if (!confirmed) return;

    try {
        const response = await request("deleteClient", { id: id });
        if (response.success) {
            await refreshClients();
            if (typeof showToast === 'function') {
                showToast('Client deleted successfully', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to delete client', 'error');
            }
        }
    } catch (error) {
        console.error("Error deleting client:", error);
        if (typeof showToast === 'function') {
            showToast('Error deleting client', 'error');
        }
    }
}

// ============================================
// MODAL UTILITY
// ============================================

/**
 * Show modal dialog
 * @param {string} title - Modal title
 * @param {string} content - Modal HTML content
 */
function showModal(title, content) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');

    if (modal && modalTitle && modalContent) {
        modalTitle.textContent = title;
        modalContent.innerHTML = content;
        modal.classList.remove('hidden');
    }
}

/**
 * Close modal dialog
 */
function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Verify session with backend before proceeding
    if (typeof requireAuth === 'function') {
        const authed = await requireAuth();
        if (!authed) return;
    }
    if (typeof renderUserInfo === 'function') renderUserInfo('userInfo');
    
    // Initialize UX enhancements
    if (typeof initFormValidation === 'function') initFormValidation('clientForm');
    if (typeof initModalAccessibility === 'function') initModalAccessibility('modal', closeModal);

    // Set default status filter
    clientsStatusFilter = 'active';
    
    // Initial load
    await refreshClients();
});
