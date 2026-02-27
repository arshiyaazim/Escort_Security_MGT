// Salary Management Module (Attendance-Based)
// Isolated module - READ-ONLY access to other modules
// Append-only ledger - NO overwriting history

// ============================================
// SINGLE SOURCE OF TRUTH
// ============================================
let salaryLedger = [];
let currentFilter = {
    employeeId: '',
    month: getCurrentMonth()
};

// ============================================
// PAGINATION STATE
// ============================================
let salaryPaginationState = createPaginationState(20);
let salaryFilteredData = [];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get current month in YYYY-MM format
 * @returns {string} Current month
 */
function getCurrentMonth() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

/**
 * Get month from date string
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {string} Month in YYYY-MM format
 */
function getMonthFromDate(dateStr) {
    return dateStr.substring(0, 7);
}

/**
 * Format datetime for display
 * @param {string} datetime - Datetime string
 * @returns {string} Formatted datetime
 */
function formatDateTime(datetime) {
    if (!datetime) return '';
    return datetime;
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
// REFRESH FUNCTION (EXPLICIT ONLY)
// ============================================

/**
 * Refresh salary ledger data
 * ALL UI updates happen here - no other function may mutate salaryLedger
 * @param {string} employeeId - Employee ID filter (optional)
 * @param {string} month - Month filter in YYYY-MM format (optional)
 */
async function refreshSalaryLedger(employeeId = '', month = '') {
    // Update current filter
    if (employeeId !== undefined) currentFilter.employeeId = employeeId;
    if (month !== undefined) currentFilter.month = month;
    
    // Show loading state
    if (typeof showTableLoading === 'function') {
        showTableLoading('salaryTableBody', 8);
    }

    try {
        const response = await request("getSalaryLedger", {
            employeeId: currentFilter.employeeId,
            month: currentFilter.month
        });
        if (response.success && Array.isArray(response.data)) {
            salaryLedger = response.data;
        } else {
            salaryLedger = [];
        }
        // All UI updates happen here
        renderSalaryTable(salaryLedger);
        updateSalarySummary(salaryLedger);
    } catch (error) {
        console.error("Failed to refresh salary ledger:", error);
        salaryLedger = [];
        renderSalaryTable(salaryLedger);
        updateSalarySummary(salaryLedger);
        if (typeof showToast === 'function') {
            showToast('Failed to load salary records', 'error');
        }
    }
}

// ============================================
// RENDER FUNCTIONS
// ============================================

/**
 * Render salary ledger table
 * @param {Array} data - Array of salary ledger entries
 */
function renderSalaryTable(data) {
    // Sort by date descending (most recent first)
    const sorted = data ? [...data].sort((a, b) => {
        const dateA = a.createdAt || a.date;
        const dateB = b.createdAt || b.date;
        return dateB.localeCompare(dateA);
    }) : [];
    
    salaryFilteredData = sorted;
    salaryPaginationState.currentPage = 1;
    renderPaginatedSalaryTable();
}

/**
 * Render paginated salary ledger table
 */
function renderPaginatedSalaryTable() {
    const tbody = document.getElementById('salaryTableBody');
    if (!tbody) return;

    if (!salaryFilteredData || salaryFilteredData.length === 0) {
        if (typeof showEmptyState === 'function') {
            showEmptyState('salaryTableBody', 'No salary records found for the selected criteria. Try adjusting the filters.', 8, 'fa-money-bill-wave');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="px-4 py-8 text-center text-gray-500">
                        No salary records found
                    </td>
                </tr>
            `;
        }
        const paginationContainer = document.getElementById('salaryPagination');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const result = paginate(salaryFilteredData, salaryPaginationState.currentPage, salaryPaginationState.pageSize);

    tbody.innerHTML = result.items.map((entry, index) => {
        const sourceClass = getSourceClass(entry.sourceModule);
        const netChangeClass = entry.netChange >= 0 ? 'text-green-600' : 'text-red-600';
        
        return `
        <tr class="border-b border-gray-200 hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(entry.date || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-800">${escapeHtml(entry.employeeName || '')}</td>
            <td class="px-4 py-3 text-sm">
                <span class="px-2 py-1 rounded-full text-xs ${sourceClass}">
                    ${escapeHtml(entry.sourceModule || '')}
                </span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(String(entry.shiftOrHours || '-'))}</td>
            <td class="px-4 py-3 text-sm text-green-600 font-medium">${entry.earnedAmount > 0 ? '+' + entry.earnedAmount.toFixed(2) : '-'}</td>
            <td class="px-4 py-3 text-sm text-red-600 font-medium">${entry.deductedAmount > 0 ? '-' + entry.deductedAmount.toFixed(2) : '-'}</td>
            <td class="px-4 py-3 text-sm ${netChangeClass} font-medium">${entry.netChange >= 0 ? '+' : ''}${entry.netChange.toFixed(2)}</td>
            <td class="px-4 py-3 text-sm text-gray-800 font-bold">${entry.runningBalance.toFixed(2)}</td>
        </tr>
        `;
    }).join('');

    renderPaginationControls('salaryPagination', {
        ...result,
        pageSize: salaryPaginationState.pageSize
    }, {
        onPageChange: (page) => {
            salaryPaginationState.currentPage = page;
            renderPaginatedSalaryTable();
        },
        onPageSizeChange: (size) => {
            salaryPaginationState.pageSize = size;
            salaryPaginationState.currentPage = 1;
            renderPaginatedSalaryTable();
        }
    });
}

/**
 * Get CSS class for source module badge
 * @param {string} source - Source module name
 * @returns {string} CSS classes
 */
function getSourceClass(source) {
    switch (source) {
        case 'Escort':
            return 'bg-blue-100 text-blue-800';
        case 'Guard':
            return 'bg-green-100 text-green-800';
        case 'DayLabor':
            return 'bg-purple-100 text-purple-800';
        case 'LoanAdvance':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

/**
 * Update salary summary metrics
 * @param {Array} data - Array of salary ledger entries
 */
function updateSalarySummary(data) {
    const totalEarned = data.reduce((sum, e) => sum + (Number(e.earnedAmount) || 0), 0);
    const totalDeducted = data.reduce((sum, e) => sum + (Number(e.deductedAmount) || 0), 0);
    const netSalary = totalEarned - totalDeducted;
    
    // Running balance is the last entry's balance (or 0 if no entries)
    const sorted = [...data].sort((a, b) => {
        const dateA = a.createdAt || a.date;
        const dateB = b.createdAt || b.date;
        return dateA.localeCompare(dateB);
    });
    const runningBalance = sorted.length > 0 ? sorted[sorted.length - 1].runningBalance : 0;

    setElementText('summaryTotalEarned', totalEarned.toFixed(2));
    setElementText('summaryTotalDeducted', totalDeducted.toFixed(2));
    setElementText('summaryNetSalary', netSalary.toFixed(2));
    setElementText('summaryRunningBalance', runningBalance.toFixed(2));

    // Color code running balance
    const balanceElement = document.getElementById('summaryRunningBalance');
    if (balanceElement) {
        balanceElement.className = runningBalance >= 0 
            ? 'text-2xl font-bold text-green-600' 
            : 'text-2xl font-bold text-red-600';
    }
}

// ============================================
// FILTER HANDLING
// ============================================

/**
 * Apply filters from UI inputs
 */
function applyFilters() {
    const employeeInput = document.getElementById('filterEmployee');
    const monthInput = document.getElementById('filterMonth');
    
    const employeeId = employeeInput ? employeeInput.value.trim() : '';
    const month = monthInput ? monthInput.value : '';
    
    refreshSalaryLedger(employeeId, month);
}

/**
 * Reset filters to default
 */
function resetFilters() {
    const employeeInput = document.getElementById('filterEmployee');
    const monthInput = document.getElementById('filterMonth');
    
    if (employeeInput) employeeInput.value = '';
    if (monthInput) monthInput.value = getCurrentMonth();
    
    refreshSalaryLedger('', getCurrentMonth());
}

// ============================================
// REMOVED: generateSalary(), calculateEscortEarnings(),
// calculateGuardEarnings(), calculateDayLaborEarnings()
// Phase 0 cleanup — conflicting engines removed.
// Will be rebuilt in Phase 1 with unified rate logic.
// ============================================

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize salary module on page load
 */
document.addEventListener('DOMContentLoaded', async function() {
    // Verify session with backend before proceeding
    if (typeof requireAuth === 'function') {
        const authed = await requireAuth();
        if (!authed) return;
    }
    if (typeof renderUserInfo === 'function') renderUserInfo('userInfo');
    
    // Set initial month filter
    const monthInput = document.getElementById('filterMonth');
    if (monthInput) {
        monthInput.value = getCurrentMonth();
    }
    
    // Initial data load
    await refreshSalaryLedger('', getCurrentMonth());
});
