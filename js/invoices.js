// Invoice Management Module
// Isolated module - READ-ONLY access to duty data
// Invoices are IMMUTABLE once finalized

// ============================================
// SINGLE SOURCE OF TRUTH
// ============================================
let invoices = [];
let currentFilter = {
    clientId: '',
    startDate: '',
    endDate: ''
};
let selectedInvoice = null;

// ============================================
// PAGINATION STATE
// ============================================
let invoicesPaginationState = createPaginationState(10);
let invoicesFilteredData = [];

// ============================================
// REFRESH FUNCTION (EXPLICIT ONLY)
// ============================================

/**
 * Refresh invoices data
 * ALL UI updates happen here - no other function may mutate invoices
 * @param {string} clientId - Client ID filter (optional)
 * @param {string} startDate - Start date filter (optional)
 * @param {string} endDate - End date filter (optional)
 */
async function refreshInvoices(clientId = '', startDate = '', endDate = '') {
    // Update current filter
    if (clientId !== undefined) currentFilter.clientId = clientId;
    if (startDate !== undefined) currentFilter.startDate = startDate;
    if (endDate !== undefined) currentFilter.endDate = endDate;
    
    // Show loading state
    if (typeof showTableLoading === 'function') {
        showTableLoading('invoicesTableBody', 8);
    }

    try {
        const response = await request("getInvoices", {
            clientId: currentFilter.clientId,
            startDate: currentFilter.startDate,
            endDate: currentFilter.endDate
        });
        if (response.success && Array.isArray(response.data)) {
            invoices = response.data;
        } else {
            invoices = [];
        }
        // All UI updates happen here
        renderInvoicesTable(invoices);
        updateInvoiceSummary(invoices);
        clearInvoicePreview();
    } catch (error) {
        console.error("Failed to refresh invoices:", error);
        invoices = [];
        renderInvoicesTable(invoices);
        updateInvoiceSummary(invoices);
        clearInvoicePreview();
        if (typeof showToast === 'function') {
            showToast('Failed to load invoices', 'error');
        }
    }
}

// ============================================
// RENDER FUNCTIONS
// ============================================

/**
 * Render invoices table
 * @param {Array} data - Array of invoices
 */
function renderInvoicesTable(data) {
    invoicesFilteredData = data || [];
    invoicesPaginationState.currentPage = 1;
    renderPaginatedInvoicesTable();
}

/**
 * Render paginated invoices table
 */
function renderPaginatedInvoicesTable() {
    const tbody = document.getElementById('invoicesTableBody');
    if (!tbody) return;

    if (!invoicesFilteredData || invoicesFilteredData.length === 0) {
        if (typeof showEmptyState === 'function') {
            showEmptyState('invoicesTableBody', 'No invoices found. Generate a new invoice using the button above.', 8, 'fa-file-invoice');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="px-4 py-8 text-center text-gray-500">
                        No invoices found
                    </td>
                </tr>
            `;
        }
        const paginationContainer = document.getElementById('invoicesPagination');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const result = paginate(invoicesFilteredData, invoicesPaginationState.currentPage, invoicesPaginationState.pageSize);

    tbody.innerHTML = result.items.map(invoice => {
        const statusClass = getStatusClass(invoice.status);
        const canFinalize = invoice.status === 'Draft';
        const canMarkPaid = invoice.status === 'Finalized';
        
        return `
        <tr class="border-b border-gray-200 hover:bg-gray-50 cursor-pointer" onclick="viewInvoice('${invoice.id}')">
            <td class="px-4 py-3 text-sm text-blue-600 font-medium">${escapeHtml(invoice.invoiceNumber || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-800">${escapeHtml(invoice.clientName || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(invoice.periodStart || '')} - ${escapeHtml(invoice.periodEnd || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${formatCurrency(invoice.subtotal)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${formatCurrency(invoice.vatAmount)}</td>
            <td class="px-4 py-3 text-sm text-gray-800 font-bold">${formatCurrency(invoice.totalAmount)}</td>
            <td class="px-4 py-3 text-sm">
                <span class="px-2 py-1 rounded-full text-xs ${statusClass}">
                    ${escapeHtml(invoice.status || '')}
                </span>
            </td>
            <td class="px-4 py-3 text-sm" onclick="event.stopPropagation()">
                ${canFinalize ? `<button onclick="finalizeInvoice('${invoice.id}')" class="text-blue-600 hover:text-blue-800 mr-2">Finalize</button>` : ''}
                ${canMarkPaid ? `<button onclick="markAsPaid('${invoice.id}')" class="text-green-600 hover:text-green-800 mr-2">Mark Paid</button>` : ''}
                ${canFinalize ? `<button onclick="deleteInvoice('${invoice.id}')" class="text-red-600 hover:text-red-800">Delete</button>` : ''}
            </td>
        </tr>
        `;
    }).join('');

    renderPaginationControls('invoicesPagination', {
        ...result,
        pageSize: invoicesPaginationState.pageSize
    }, {
        onPageChange: (page) => {
            invoicesPaginationState.currentPage = page;
            renderPaginatedInvoicesTable();
        },
        onPageSizeChange: (size) => {
            invoicesPaginationState.pageSize = size;
            invoicesPaginationState.currentPage = 1;
            renderPaginatedInvoicesTable();
        }
    });
}

/**
 * Get CSS class for status badge
 * @param {string} status - Invoice status
 * @returns {string} CSS classes
 */
function getStatusClass(status) {
    switch (status) {
        case 'Draft':
            return 'bg-yellow-100 text-yellow-800';
        case 'Finalized':
            return 'bg-blue-100 text-blue-800';
        case 'Paid':
            return 'bg-green-100 text-green-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

/**
 * Update invoice summary metrics
 * @param {Array} data - Array of invoices
 */
function updateInvoiceSummary(data) {
    const total = data.length;
    const draftCount = data.filter(i => i.status === 'Draft').length;
    const finalizedCount = data.filter(i => i.status === 'Finalized').length;
    const paidCount = data.filter(i => i.status === 'Paid').length;

    setElementText('summaryTotalInvoices', total);
    setElementText('summaryDraftCount', draftCount);
    setElementText('summaryFinalizedCount', finalizedCount);
    setElementText('summaryPaidCount', paidCount);
}

/**
 * Format currency value
 * @param {number} value - Numeric value
 * @returns {string} Formatted currency
 */
function formatCurrency(value) {
    return (Number(value) || 0).toFixed(2);
}

/**
 * Set element text content safely
 * @param {string} elementId - Element ID
 * @param {string|number} text - Text content
 */
function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
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
// INVOICE PREVIEW
// ============================================

/**
 * View invoice details in preview panel
 * @param {string} id - Invoice ID
 */
function viewInvoice(id) {
    const invoice = invoices.find(i => String(i.id) === String(id));
    if (!invoice) return;
    
    selectedInvoice = invoice;
    renderInvoicePreview(invoice);
}

/**
 * Render invoice preview panel
 * @param {Object} invoice - Invoice object
 */
function renderInvoicePreview(invoice) {
    const preview = document.getElementById('invoicePreview');
    if (!preview) return;

    preview.innerHTML = `
        <div class="border-b border-gray-200 pb-4 mb-4">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="text-lg font-bold text-gray-800">${escapeHtml(invoice.invoiceNumber)}</h3>
                    <p class="text-sm text-gray-500">Created: ${escapeHtml(invoice.createdAt)}</p>
                </div>
                <span class="px-3 py-1 rounded-full text-sm ${getStatusClass(invoice.status)}">${escapeHtml(invoice.status)}</span>
            </div>
        </div>
        
        <div class="mb-4">
            <div class="text-sm text-gray-500">Client</div>
            <div class="text-gray-800 font-medium">${escapeHtml(invoice.clientName)}</div>
        </div>
        
        <div class="mb-4">
            <div class="text-sm text-gray-500">Period</div>
            <div class="text-gray-800">${escapeHtml(invoice.periodStart)} to ${escapeHtml(invoice.periodEnd)}</div>
        </div>
        
        <div class="border-t border-gray-200 pt-4 mb-4">
            <h4 class="text-sm font-semibold text-gray-700 mb-3">Line Items</h4>
            <table class="w-full text-sm">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-2 py-2 text-left text-xs text-gray-500">Description</th>
                        <th class="px-2 py-2 text-right text-xs text-gray-500">Qty</th>
                        <th class="px-2 py-2 text-right text-xs text-gray-500">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoice.totalEscortDays > 0 ? `
                    <tr class="border-b border-gray-100">
                        <td class="px-2 py-2 text-gray-600">Escort Duty</td>
                        <td class="px-2 py-2 text-right text-gray-600">${invoice.totalEscortDays} days</td>
                        <td class="px-2 py-2 text-right text-gray-800">${formatCurrency(invoice.escortAmount || 0)}</td>
                    </tr>
                    ` : ''}
                    ${invoice.totalGuardDays > 0 ? `
                    <tr class="border-b border-gray-100">
                        <td class="px-2 py-2 text-gray-600">Guard Duty</td>
                        <td class="px-2 py-2 text-right text-gray-600">${invoice.totalGuardDays} days</td>
                        <td class="px-2 py-2 text-right text-gray-800">${formatCurrency(invoice.guardAmount || 0)}</td>
                    </tr>
                    ` : ''}
                    ${invoice.totalLaborHours > 0 ? `
                    <tr class="border-b border-gray-100">
                        <td class="px-2 py-2 text-gray-600">Day Labor</td>
                        <td class="px-2 py-2 text-right text-gray-600">${invoice.totalLaborHours} hrs</td>
                        <td class="px-2 py-2 text-right text-gray-800">${formatCurrency(invoice.laborAmount || 0)}</td>
                    </tr>
                    ` : ''}
                </tbody>
            </table>
        </div>
        
        <div class="border-t border-gray-200 pt-4">
            <div class="flex justify-between py-1">
                <span class="text-gray-600">Subtotal</span>
                <span class="text-gray-800">${formatCurrency(invoice.subtotal)}</span>
            </div>
            <div class="flex justify-between py-1">
                <span class="text-gray-600">VAT (${invoice.vatPercent || 0}%)</span>
                <span class="text-gray-800">${formatCurrency(invoice.vatAmount)}</span>
            </div>
            <div class="flex justify-between py-2 border-t border-gray-200 mt-2">
                <span class="font-bold text-gray-800">Total</span>
                <span class="font-bold text-gray-800 text-lg">${formatCurrency(invoice.totalAmount)}</span>
            </div>
        </div>
    `;
}

/**
 * Clear invoice preview panel
 */
function clearInvoicePreview() {
    const preview = document.getElementById('invoicePreview');
    if (preview) {
        preview.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <p>Select an invoice to view details</p>
            </div>
        `;
    }
    selectedInvoice = null;
}

// ============================================
// FILTER HANDLING
// ============================================

/**
 * Apply filters from UI inputs
 */
function applyFilters() {
    const clientInput = document.getElementById('filterClient');
    const startInput = document.getElementById('filterStartDate');
    const endInput = document.getElementById('filterEndDate');
    
    const clientId = clientInput ? clientInput.value.trim() : '';
    const startDate = startInput ? startInput.value : '';
    const endDate = endInput ? endInput.value : '';
    
    refreshInvoices(clientId, startDate, endDate);
}

/**
 * Reset filters to default
 */
function resetFilters() {
    const clientInput = document.getElementById('filterClient');
    const startInput = document.getElementById('filterStartDate');
    const endInput = document.getElementById('filterEndDate');
    
    if (clientInput) clientInput.value = '';
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';
    
    refreshInvoices('', '', '');
}

// ============================================
// INVOICE GENERATION
// ============================================

/**
 * Open generate invoice modal
 */
function openGenerateModal() {
    const modal = document.getElementById('generateModal');
    const form = document.getElementById('generateForm');
    
    if (form) {
        form.reset();
        // Set default VAT
        form.vatPercent.value = 15;
    }
    
    if (modal) {
        modal.classList.remove('hidden');
    }
}

/**
 * Close generate invoice modal
 */
function closeGenerateModal() {
    const modal = document.getElementById('generateModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Generate a new invoice
 * @param {Event} event - Form submit event
 */
async function generateInvoice(event) {
    event.preventDefault();
    
    const form = document.getElementById('generateForm');
    if (!form) return;
    
    // Validate form
    if (typeof validateForm === 'function' && !validateForm('generateForm')) {
        return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const restoreBtn = typeof setButtonLoading === 'function' 
        ? setButtonLoading(submitBtn, 'Generating...') 
        : () => {};
    
    const payload = {
        clientId: String(form.clientId.value || '').trim(),
        clientName: String(form.clientName.value).trim(),
        periodStart: String(form.periodStart.value).trim(),
        periodEnd: String(form.periodEnd.value).trim(),
        vatPercent: Number(form.vatPercent.value) || 0,
        contactRate: Number(form.contactRate.value) || 0
    };
    
    if (!payload.clientName || !payload.periodStart || !payload.periodEnd) {
        if (typeof showToast === 'function') {
            showToast('Please fill in all required fields', 'error');
        }
        restoreBtn();
        return;
    }
    
    try {
        const response = await request("generateInvoice", payload);
        if (response.success) {
            closeGenerateModal();
            await refreshInvoices(currentFilter.clientId, currentFilter.startDate, currentFilter.endDate);
            // Show the newly created invoice
            if (response.data && response.data.id) {
                viewInvoice(response.data.id);
            }
            if (typeof showToast === 'function') {
                showToast('Invoice generated successfully', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to generate invoice', 'error');
            }
        }
    } catch (error) {
        console.error("Error generating invoice:", error);
        if (typeof showToast === 'function') {
            showToast('Error generating invoice', 'error');
        }
    } finally {
        restoreBtn();
    }
}

// ============================================
// INVOICE ACTIONS
// ============================================

/**
 * Finalize an invoice (make it immutable)
 * @param {string} id - Invoice ID
 */
async function finalizeInvoice(id) {
    const invoice = invoices.find(i => String(i.id) === String(id));
    const invoiceName = invoice ? invoice.invoiceNumber : 'this invoice';
    
    let confirmed = false;
    if (typeof confirmFinalize === 'function') {
        confirmed = await confirmFinalize(invoiceName);
    } else {
        confirmed = confirm('Are you sure you want to finalize this invoice? This action cannot be undone.');
    }
    
    if (!confirmed) return;
    
    try {
        const response = await request("finalizeInvoice", { id: id });
        if (response.success) {
            await refreshInvoices(currentFilter.clientId, currentFilter.startDate, currentFilter.endDate);
            if (selectedInvoice && selectedInvoice.id === id) {
                viewInvoice(id);
            }
            if (typeof showToast === 'function') {
                showToast('Invoice finalized successfully', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to finalize invoice', 'error');
            }
        }
    } catch (error) {
        console.error("Error finalizing invoice:", error);
        if (typeof showToast === 'function') {
            showToast('Error finalizing invoice', 'error');
        }
    }
}

/**
 * Mark an invoice as paid
 * @param {string} id - Invoice ID
 */
async function markAsPaid(id) {
    const invoice = invoices.find(i => String(i.id) === String(id));
    const invoiceName = invoice ? invoice.invoiceNumber : 'this invoice';
    
    let confirmed = false;
    if (typeof confirmStatusChange === 'function') {
        confirmed = await confirmStatusChange(invoiceName, 'Paid');
    } else {
        confirmed = confirm('Mark this invoice as paid?');
    }
    
    if (!confirmed) return;
    
    try {
        const response = await request("markInvoicePaid", { id: id });
        if (response.success) {
            await refreshInvoices(currentFilter.clientId, currentFilter.startDate, currentFilter.endDate);
            if (selectedInvoice && selectedInvoice.id === id) {
                viewInvoice(id);
            }
            if (typeof showToast === 'function') {
                showToast('Invoice marked as paid', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to mark invoice as paid', 'error');
            }
        }
    } catch (error) {
        console.error("Error marking invoice as paid:", error);
        if (typeof showToast === 'function') {
            showToast('Error updating invoice status', 'error');
        }
    }
}

/**
 * Delete a draft invoice
 * @param {string} id - Invoice ID
 */
async function deleteInvoice(id) {
    const invoice = invoices.find(i => String(i.id) === String(id));
    if (!invoice || invoice.status !== 'Draft') {
        if (typeof showToast === 'function') {
            showToast('Only draft invoices can be deleted', 'error');
        }
        return;
    }
    
    const invoiceName = invoice.invoiceNumber || 'this draft invoice';
    
    let confirmed = false;
    if (typeof confirmDelete === 'function') {
        confirmed = await confirmDelete(invoiceName);
    } else {
        confirmed = confirm('Are you sure you want to delete this draft invoice?');
    }
    
    if (!confirmed) return;
    
    try {
        const response = await request("deleteInvoice", { id: id });
        if (response.success) {
            await refreshInvoices(currentFilter.clientId, currentFilter.startDate, currentFilter.endDate);
            if (selectedInvoice && selectedInvoice.id === id) {
                clearInvoicePreview();
            }
            if (typeof showToast === 'function') {
                showToast('Invoice deleted successfully', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to delete invoice', 'error');
            }
        }
    } catch (error) {
        console.error("Error deleting invoice:", error);
        if (typeof showToast === 'function') {
            showToast('Error deleting invoice', 'error');
        }
    }
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize invoices module on page load
 */
document.addEventListener('DOMContentLoaded', async function() {
    // Verify session with backend before proceeding
    if (typeof requireAuth === 'function') {
        const authed = await requireAuth();
        if (!authed) return;
    }
    if (typeof renderUserInfo === 'function') renderUserInfo('userInfo');
    
    // Initialize UX enhancements
    if (typeof initFormValidation === 'function') initFormValidation('generateForm');
    if (typeof initModalAccessibility === 'function') initModalAccessibility('generateModal', closeGenerateModal);
    
    // Initial data load
    await refreshInvoices('', '', '');
});
