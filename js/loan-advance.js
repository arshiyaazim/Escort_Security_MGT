// Loan & Advance Management Module
// Isolated module - NO cross-module references
// NO salary calculation - data storage only

// ============================================
// SINGLE SOURCE OF TRUTH
// ============================================
let loanRecords = [];

// ============================================
// PAGINATION STATE
// ============================================
let loanPaginationState = createPaginationState(10);
let loanFilteredData = [];

// ============================================
// REFRESH FUNCTION (EXPLICIT ONLY)
// ============================================

/**
 * Refresh loan & advance data
 * ALL UI updates happen here - no other function may mutate loanRecords
 */
async function refreshLoanAdvance() {
    // Show loading state
    if (typeof showTableLoading === 'function') {
        showTableLoading('loanTableBody', 10);
    }
    
    try {
        const response = await request("getLoanAdvance");
        if (response.success && Array.isArray(response.data)) {
            loanRecords = response.data;
        } else {
            loanRecords = [];
        }
        // All UI updates happen here
        renderLoanTable(loanRecords);
        updateLoanSummary(loanRecords);
    } catch (error) {
        console.error("Failed to refresh loan/advance records:", error);
        loanRecords = [];
        renderLoanTable(loanRecords);
        updateLoanSummary(loanRecords);
        if (typeof showToast === 'function') {
            showToast('Failed to load loan/advance records', 'error');
        }
    }
}

// ============================================
// RENDER FUNCTIONS
// ============================================

/**
 * Render loan/advance records table
 * @param {Array} data - Array of loan/advance records
 */
function renderLoanTable(data) {
    loanFilteredData = data || [];
    loanPaginationState.currentPage = 1;
    renderPaginatedLoanTable();
}

/**
 * Render paginated loan/advance records table
 */
function renderPaginatedLoanTable() {
    const tbody = document.getElementById('loanTableBody');
    if (!tbody) return;

    if (!loanFilteredData || loanFilteredData.length === 0) {
        if (typeof showEmptyState === 'function') {
            showEmptyState('loanTableBody', 'No loan/advance records found. Add a record using the button above.', 10, 'fa-hand-holding-usd');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="px-4 py-8 text-center text-gray-500">
                        No loan/advance records found
                    </td>
                </tr>
            `;
        }
        const paginationContainer = document.getElementById('loanPagination');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const result = paginate(loanFilteredData, loanPaginationState.currentPage, loanPaginationState.pageSize);

    tbody.innerHTML = result.items.map((record, localIndex) => {
        const displayIndex = result.startIndex + localIndex;
        return `
        <tr class="border-b border-gray-200 hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-600">${displayIndex}</td>
            <td class="px-4 py-3 text-sm text-gray-800">${escapeHtml(record.employeeName || '')}</td>
            <td class="px-4 py-3 text-sm">
                <span class="px-2 py-1 rounded-full text-xs ${record.type === 'Loan' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}">
                    ${escapeHtml(record.type || '')}
                </span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-800 font-medium">${record.amount || 0}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.issueDate || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.paymentMethod || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.repaymentType || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${record.repaymentType === 'Monthly' ? (record.monthlyDeduct || 0) : '-'}</td>
            <td class="px-4 py-3 text-sm">
                <span class="px-2 py-1 rounded-full text-xs ${(record.status || '').toLowerCase() === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                    ${escapeHtml(record.status || '')}
                </span>
            </td>
            <td class="px-4 py-3 text-sm">
                <button onclick="deleteRecord('${record.id}')" class="text-red-600 hover:text-red-800">Delete</button>
            </td>
        </tr>
        `;
    }).join('');

    renderPaginationControls('loanPagination', {
        ...result,
        pageSize: loanPaginationState.pageSize
    }, {
        onPageChange: (page) => {
            loanPaginationState.currentPage = page;
            renderPaginatedLoanTable();
        },
        onPageSizeChange: (size) => {
            loanPaginationState.pageSize = size;
            loanPaginationState.currentPage = 1;
            renderPaginatedLoanTable();
        }
    });
}

/**
 * Update summary metrics
 * @param {Array} data - Array of loan/advance records
 */
function updateLoanSummary(data) {
    const totalRecords = data.length;
    const totalAmount = data.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const activeCount = data.filter(r => (r.status || '').toLowerCase() === 'active').length;
    const closedCount = data.filter(r => r.status === 'Closed').length;

    setElementText('summaryTotalRecords', totalRecords);
    setElementText('summaryTotalAmount', totalAmount);
    setElementText('summaryActiveRecords', activeCount);
    setElementText('summaryClosedRecords', closedCount);
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
// FORM HANDLING
// ============================================

/**
 * Open add loan/advance modal
 */
function openAddLoanModal() {
    const modal = document.getElementById('loanFormModal');
    const form = document.getElementById('loanForm');
    
    if (form) {
        form.reset();
        // Set defaults
        form.issueDate.value = getTodayISO();
        form.type.value = 'Advance';
        form.paymentMethod.value = 'Cash';
        form.repaymentType.value = 'One-time';
        form.status.value = 'Active';
        // Disable monthly deduction by default
        toggleMonthlyDeduct();
    }
    
    if (modal) {
        modal.classList.remove('hidden');
    }
}

/**
 * Close loan/advance modal
 */
function closeLoanModal() {
    const modal = document.getElementById('loanFormModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Toggle monthly deduction field based on repayment type
 */
function toggleMonthlyDeduct() {
    const repaymentType = document.getElementById('repaymentType');
    const monthlyDeduct = document.getElementById('monthlyDeduct');
    
    if (repaymentType && monthlyDeduct) {
        if (repaymentType.value === 'Monthly') {
            monthlyDeduct.disabled = false;
            monthlyDeduct.required = true;
            monthlyDeduct.classList.remove('bg-gray-100');
        } else {
            monthlyDeduct.disabled = true;
            monthlyDeduct.required = false;
            monthlyDeduct.value = '';
            monthlyDeduct.classList.add('bg-gray-100');
        }
    }
}

/**
 * Handle form submission for adding loan/advance record
 * @param {Event} event - Form submit event
 */
async function handleSubmit(event) {
    event.preventDefault();

    const form = document.getElementById('loanForm');
    if (!form) return;
    
    // Validate form
    if (typeof validateForm === 'function' && !validateForm('loanForm')) {
        return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const restoreBtn = typeof setButtonLoading === 'function' 
        ? setButtonLoading(submitBtn, 'Saving...') 
        : () => {};

    // Generate unique ID
    const id = 'LA-' + Date.now();

    // Get form values
    const repaymentType = String(form.repaymentType.value).trim();
    const monthlyDeduct = repaymentType === 'Monthly' ? (Number(form.monthlyDeduct.value) || 0) : 0;

    const payload = {
        id: id,
        employeeId: String(form.employeeId.value || '').trim(),
        employeeName: String(form.employeeName.value).trim(),
        type: String(form.type.value).trim(),
        amount: Number(form.amount.value) || 0,
        issueDate: String(form.issueDate.value).trim(),
        paymentMethod: String(form.paymentMethod.value).trim(),
        remarks: String(form.remarks.value).trim(),
        repaymentType: repaymentType,
        monthlyDeduct: monthlyDeduct,
        status: String(form.status.value).trim(),
        createdAt: getTodayISO()
    };

    try {
        const response = await request("addLoanAdvance", payload);
        if (response.success) {
            closeLoanModal();
            await refreshLoanAdvance();
            if (typeof showToast === 'function') {
                showToast('Loan/advance record saved successfully', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to save record', 'error');
            }
        }
    } catch (error) {
        console.error("Error adding loan/advance record:", error);
        if (typeof showToast === 'function') {
            showToast('Error saving record', 'error');
        }
    } finally {
        restoreBtn();
    }
}

// ============================================
// DELETE OPERATION
// ============================================

/**
 * Delete a loan/advance record
 * @param {string} id - Record ID
 */
async function deleteRecord(id) {
    const record = loanRecords.find(r => String(r.id) === String(id));
    const recordName = record ? `${record.employeeName}'s ${record.type.toLowerCase()} record` : 'this record';
    
    let confirmed = false;
    if (typeof confirmDelete === 'function') {
        confirmed = await confirmDelete(recordName);
    } else {
        confirmed = confirm('Are you sure you want to delete this record?');
    }
    
    if (!confirmed) return;

    try {
        const response = await request("deleteLoanAdvance", { id: id });
        if (response.success) {
            await refreshLoanAdvance();
            if (typeof showToast === 'function') {
                showToast('Record deleted successfully', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to delete record', 'error');
            }
        }
    } catch (error) {
        console.error("Error deleting loan/advance record:", error);
        if (typeof showToast === 'function') {
            showToast('Error deleting record', 'error');
        }
    }
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize loan/advance module on page load
 */
document.addEventListener('DOMContentLoaded', async function() {
    // Verify session with backend before proceeding
    if (typeof requireAuth === 'function') {
        const authed = await requireAuth();
        if (!authed) return;
    }
    if (typeof renderUserInfo === 'function') renderUserInfo('userInfo');
    
    // Initialize UX enhancements
    if (typeof initFormValidation === 'function') initFormValidation('loanForm');
    if (typeof initModalAccessibility === 'function') initModalAccessibility('loanFormModal', closeLoanModal);
    
    // Initialize employee lookup (type-ahead)
    if (typeof initEmployeeLookup === 'function') {
        initEmployeeLookup({ inputId: 'employeeName', hiddenIdField: 'employeeId' });
        preloadEmployeeLookup();
    }
    
    // Initial data load
    await refreshLoanAdvance();
});
