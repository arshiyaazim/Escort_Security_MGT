// Day Labor Tracking Module (Date-Driven)
// Isolated module - NO cross-module references

// ============================================
// SINGLE SOURCE OF TRUTH
// ============================================
let laborRecords = [];
let currentDate = getTodayISO();

// ============================================
// PAGINATION STATE
// ============================================
let laborPaginationState = createPaginationState(10);
let laborFilteredData = [];
let laborViewMode = 'flat'; // 'flat' | 'grouped'

// ============================================
// REFRESH FUNCTION (EXPLICIT ONLY)
// ============================================

/**
 * Refresh day labor data for a specific date
 * ALL UI updates happen here - no other function may mutate laborRecords
 * @param {string} date - Date in YYYY-MM-DD format
 */
async function refreshDayLabor(date) {
    // Show loading state
    if (typeof showTableLoading === 'function') {
        showTableLoading('laborTableBody', 10);
    }
    
    try {
        const response = await request("getDayLabor", { date: date });
        if (response.success && Array.isArray(response.data)) {
            laborRecords = response.data;
        } else {
            laborRecords = [];
        }
        // All UI updates happen here
        renderLaborTable(laborRecords);
        updateLaborSummary(laborRecords);
        updateDateDisplay();
    } catch (error) {
        console.error("Failed to refresh day labor:", error);
        laborRecords = [];
        renderLaborTable(laborRecords);
        updateLaborSummary(laborRecords);
        updateDateDisplay();
        if (typeof showToast === 'function') {
            showToast('Failed to load labor records', 'error');
        }
    }
}

// ============================================
// RENDER FUNCTIONS
// ============================================

/**
 * Render labor records table
 * @param {Array} data - Array of labor records
 */
function renderLaborTable(data) {
    laborFilteredData = data || [];
    laborPaginationState.currentPage = 1;
    if (laborViewMode === 'grouped') {
        renderGroupedLaborTable();
    } else {
        renderPaginatedLaborTable();
    }
}

/**
 * Render paginated labor records table
 */
function renderPaginatedLaborTable() {
    const tbody = document.getElementById('laborTableBody');
    if (!tbody) return;

    if (!laborFilteredData || laborFilteredData.length === 0) {
        if (typeof showEmptyState === 'function') {
            showEmptyState('laborTableBody', 'No labor records found for this date. Add a record using the button above.', 10, 'fa-hard-hat');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="px-4 py-8 text-center text-gray-500">
                        No labor records found for this date
                    </td>
                </tr>
            `;
        }
        const paginationContainer = document.getElementById('laborPagination');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const result = paginate(laborFilteredData, laborPaginationState.currentPage, laborPaginationState.pageSize);

    tbody.innerHTML = result.items.map((record, localIndex) => {
        const displayIndex = result.startIndex + localIndex;
        return `
        <tr class="border-b border-gray-200 hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-600">${displayIndex}</td>
            <td class="px-4 py-3 text-sm text-gray-800">${escapeHtml(record.employeeName || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.clientName || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.date || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.shift || 'Day')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${record.hoursWorked || 0}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${record.rate || 0}</td>
            <td class="px-4 py-3 text-sm text-gray-800 font-medium">${record.amount || 0}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.notes || '-')}</td>
            <td class="px-4 py-3 text-sm">
                <button onclick="deleteRecord('${record.id}')" class="text-red-600 hover:text-red-800">Delete</button>
            </td>
        </tr>
        `;
    }).join('');

    renderPaginationControls('laborPagination', {
        ...result,
        pageSize: laborPaginationState.pageSize
    }, {
        onPageChange: (page) => {
            laborPaginationState.currentPage = page;
            renderPaginatedLaborTable();
        },
        onPageSizeChange: (size) => {
            laborPaginationState.pageSize = size;
            laborPaginationState.currentPage = 1;
            renderPaginatedLaborTable();
        }
    });
}

/**
 * Render grouped labor records table (grouped by clientName → notes)
 */
function renderGroupedLaborTable() {
    renderGroupedTable({
        tbodyId: 'laborTableBody',
        paginationId: 'laborPagination',
        data: laborFilteredData,
        groupKeyFn: (r) => normalizeGroupKey(r.clientName) + ' › ' + normalizeGroupKey(r.notes),
        colSpan: 10,
        emptyMessage: 'No labor records found for this date.',
        renderRowFn: (record) => {
            return `
            <td class="px-4 py-3 text-sm text-gray-800">${escapeHtml(record.employeeName || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.clientName || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.date || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.shift || 'Day')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${record.hoursWorked || 0}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${record.rate || 0}</td>
            <td class="px-4 py-3 text-sm text-gray-800 font-medium">${record.amount || 0}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.notes || '-')}</td>
            <td class="px-4 py-3 text-sm">
                <button onclick="deleteRecord('${record.id}')" class="text-red-600 hover:text-red-800">Delete</button>
            </td>`;
        },
        groupSummaryFn: (key, items) => {
            const total = items.length;
            const hours = items.reduce((s, r) => s + (Number(r.hoursWorked) || 0), 0);
            const amount = items.reduce((s, r) => s + (Number(r.amount) || 0), 0);
            return `${total} records · ${hours} hrs · ৳${amount}`;
        }
    });
}

/**
 * Toggle labor view mode between flat and grouped
 * @param {string} mode - 'flat' or 'grouped'
 */
function setLaborViewMode(mode) {
    laborViewMode = mode;
    const flatBtn = document.getElementById('laborFlatBtn');
    const groupedBtn = document.getElementById('laborGroupedBtn');
    const expandBtn = document.getElementById('laborExpandAllBtn');
    const collapseBtn = document.getElementById('laborCollapseAllBtn');
    if (mode === 'grouped') {
        if (flatBtn) { flatBtn.className = 'px-3 py-1.5 text-xs rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors'; }
        if (groupedBtn) { groupedBtn.className = 'px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white transition-colors'; }
        if (expandBtn) expandBtn.classList.remove('hidden');
        if (collapseBtn) collapseBtn.classList.remove('hidden');
    } else {
        if (flatBtn) { flatBtn.className = 'px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white transition-colors'; }
        if (groupedBtn) { groupedBtn.className = 'px-3 py-1.5 text-xs rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors'; }
        if (expandBtn) expandBtn.classList.add('hidden');
        if (collapseBtn) collapseBtn.classList.add('hidden');
    }
    renderLaborTable(laborFilteredData);
}

/**
 * Update summary metrics
 * @param {Array} data - Array of labor records
 */
function updateLaborSummary(data) {
    const totalRecords = data.length;
    const totalHours = data.reduce((sum, r) => sum + (Number(r.hoursWorked) || 0), 0);
    const totalAmount = data.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    setElementText('summaryTotalRecords', totalRecords);
    setElementText('summaryTotalHours', totalHours);
    setElementText('summaryTotalAmount', totalAmount);
}

/**
 * Update date display in navigation
 */
function updateDateDisplay() {
    setElementText('currentDateDisplay', currentDate);
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
// DATE NAVIGATION
// ============================================

/**
 * Navigate to a different date
 * @param {string} direction - 'previous', 'today', or 'next'
 */
function navigateDate(direction) {
    const current = parseDate(currentDate);
    
    switch (direction) {
        case 'previous':
            current.setDate(current.getDate() - 1);
            currentDate = formatDateISO(current);
            break;
        case 'today':
            currentDate = getTodayISO();
            break;
        case 'next':
            current.setDate(current.getDate() + 1);
            currentDate = formatDateISO(current);
            break;
    }
    
    refreshDayLabor(currentDate);
}

/**
 * Parse ISO date string to Date object (locale-independent)
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {Date} Date object
 */
function parseDate(dateStr) {
    const parts = dateStr.split('-');
    return new Date(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2], 10)
    );
}

/**
 * Format Date object to ISO string (YYYY-MM-DD)
 * @param {Date} date - Date object
 * @returns {string} Date in YYYY-MM-DD format
 */
function formatDateISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ============================================
// FORM HANDLING
// ============================================

/**
 * Open add labor modal
 */
function openAddLaborModal() {
    const modal = document.getElementById('laborFormModal');
    const form = document.getElementById('laborForm');
    
    if (form) {
        form.reset();
        // Pre-fill date with current date
        form.date.value = currentDate;
    }
    
    if (modal) {
        modal.classList.remove('hidden');
    }
}

/**
 * Close labor modal
 */
function closeLaborModal() {
    const modal = document.getElementById('laborFormModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Handle form submission for adding labor record
 * @param {Event} event - Form submit event
 */
async function handleSubmit(event) {
    event.preventDefault();

    const form = document.getElementById('laborForm');
    if (!form) return;
    
    // Validate form
    if (typeof validateForm === 'function' && !validateForm('laborForm')) {
        return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const restoreBtn = typeof setButtonLoading === 'function' 
        ? setButtonLoading(submitBtn, 'Saving...') 
        : () => {};

    // Generate unique ID
    const id = 'DL-' + Date.now();

    // Get form values
    const hoursWorked = Number(form.hoursWorked.value) || 0;
    const rate = Number(form.rate.value) || 0;
    
    // Calculate amount = hoursWorked × rate
    const amount = hoursWorked * rate;

    // Get client fields — select.value is the client ID; display name from option text
    const clientSelect = document.getElementById('clientName');
    const clientId = String((clientSelect ? clientSelect.value : '') || '').trim();
    const clientDisplayName = typeof getSelectedClientDisplayName === 'function'
        ? getSelectedClientDisplayName(clientSelect)
        : (clientSelect && clientSelect.selectedIndex >= 0 && clientSelect.value
            ? (clientSelect.options[clientSelect.selectedIndex].text || '') : '');
    // Sync hidden clientId field
    const hiddenClientId = document.getElementById('clientId');
    if (hiddenClientId) hiddenClientId.value = clientId;

    const payload = {
        id: id,
        employeeId: String(form.employeeId.value || '').trim(),
        employeeName: String(form.employeeName.value).trim(),
        clientId: clientId,
        clientName: clientDisplayName.trim(),
        date: String(form.date.value).trim(),
        shift: String(form.shift.value || 'Day').trim(),
        hoursWorked: hoursWorked,
        rate: rate,
        amount: amount,
        notes: String(form.notes.value).trim()
    };

    // Debug logging (enable with: window._DAY_LABOR_DEBUG = true)
    if (window._DAY_LABOR_DEBUG) {
        console.log('[day-labor] submit payload:', JSON.stringify(payload, null, 2));
    }

    try {
        const response = await request("addDayLabor", payload);

        if (window._DAY_LABOR_DEBUG) {
            console.log('[day-labor] response:', JSON.stringify(response));
        }

        if (response.success) {
            closeLaborModal();
            await refreshDayLabor(currentDate);
            if (typeof markDashboardDirty === 'function') markDashboardDirty('day-labor');
            if (typeof refreshDashboard === 'function') refreshDashboard('day-labor');
            if (typeof showToast === 'function') {
                showToast('Labor record saved successfully', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to save labor record', 'error');
            }
        }
    } catch (error) {
        console.error("Error adding labor record:", error);
        if (typeof showToast === 'function') {
            showToast('Error saving labor record', 'error');
        }
    } finally {
        restoreBtn();
    }
}

// ============================================
// DELETE OPERATION
// ============================================

/**
 * Delete a labor record
 * @param {string} id - Record ID
 */
async function deleteRecord(id) {
    const record = laborRecords.find(r => String(r.id) === String(id));
    const recordName = record ? `${record.employeeName}'s labor record` : 'this labor record';
    
    let confirmed = false;
    if (typeof confirmDelete === 'function') {
        confirmed = await confirmDelete(recordName);
    } else {
        confirmed = confirm('Are you sure you want to delete this labor record?');
    }
    
    if (!confirmed) return;

    try {
        const response = await request("deleteDayLabor", { id: id });
        if (response.success) {
            await refreshDayLabor(currentDate);
            if (typeof markDashboardDirty === 'function') markDashboardDirty('day-labor');
            if (typeof refreshDashboard === 'function') refreshDashboard('day-labor');
            if (typeof showToast === 'function') {
                showToast('Labor record deleted successfully', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to delete labor record', 'error');
            }
        }
    } catch (error) {
        console.error("Error deleting labor record:", error);
        if (typeof showToast === 'function') {
            showToast('Error deleting labor record', 'error');
        }
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
    if (typeof initFormValidation === 'function') initFormValidation('laborForm');
    if (typeof initModalAccessibility === 'function') initModalAccessibility('laborFormModal', closeLaborModal);
    
    // Initialize employee lookup (type-ahead)
    if (typeof initEmployeeLookup === 'function') {
        initEmployeeLookup({ inputId: 'employeeName', hiddenIdField: 'employeeId' });
        preloadEmployeeLookup();
    }
    
    // Populate client dropdown
    if (typeof populateClientDropdown === 'function') {
        await populateClientDropdown({
            selectId: 'clientName',
            hiddenIdField: 'clientId',
            includeEmpty: true,
            emptyLabel: 'Select Client'
        });
    }
    
    // Set default date and initial load
    if (!currentDate) {
        currentDate = new Date().toISOString().split('T')[0];
    }
    await refreshDayLabor(currentDate);
});
