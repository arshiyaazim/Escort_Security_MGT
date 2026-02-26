// Guard Duty Tracking Module (Isolated v2 + Shift)
// NO dashboard integration - fully self-contained

// ============================================
// SINGLE SOURCE OF TRUTH
// ============================================
let dutyRecords = [];
let currentDate = getTodayISO();

// ============================================
// PAGINATION STATE
// ============================================
let dutyPaginationState = createPaginationState(10);
let dutyFilteredData = [];
let dutyViewMode = 'flat'; // 'flat' or 'grouped'

// ============================================
// REFRESH FUNCTION (EXPLICIT ONLY)
// ============================================

/**
 * Refresh guard duty data for a specific date
 * ALL UI updates happen here - no other function may mutate dutyRecords
 * @param {string} date - Date in YYYY-MM-DD format
 */
async function refreshGuardDuty(date) {
    // Show loading state
    if (typeof showTableLoading === 'function') {
        showTableLoading('dutyTableBody', 10);
    }
    
    try {
        const response = await request("getGuardDuty", { date: date });
        if (response.success && Array.isArray(response.data)) {
            dutyRecords = response.data;
        } else {
            dutyRecords = [];
        }
        // All UI updates happen here
        renderDutyTable(dutyRecords);
        updateDutySummary(dutyRecords);
        updateDateDisplay();
    } catch (error) {
        console.error("Failed to refresh guard duty:", error);
        dutyRecords = [];
        renderDutyTable(dutyRecords);
        updateDutySummary(dutyRecords);
        updateDateDisplay();
        if (typeof showToast === 'function') {
            showToast('Failed to load duty records', 'error');
        }
    }
}

// ============================================
// RENDER FUNCTIONS
// ============================================

/**
 * Render duty records table
 * @param {Array} data - Array of duty records
 */
function renderDutyTable(data) {
    dutyFilteredData = data || [];
    dutyPaginationState.currentPage = 1;
    if (dutyViewMode === 'grouped') {
        renderGroupedDutyTable();
    } else {
        renderPaginatedDutyTable();
    }
}

/**
 * Render paginated duty records table
 */
function renderPaginatedDutyTable() {
    const tbody = document.getElementById('dutyTableBody');
    if (!tbody) return;

    if (!dutyFilteredData || dutyFilteredData.length === 0) {
        if (typeof showEmptyState === 'function') {
            showEmptyState('dutyTableBody', 'No duty records found for this date. Add a record using the button above.', 10, 'fa-clipboard-list');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="px-4 py-8 text-center text-gray-500">
                        No duty records found for this date
                    </td>
                </tr>
            `;
        }
        const paginationContainer = document.getElementById('dutyPagination');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const result = paginate(dutyFilteredData, dutyPaginationState.currentPage, dutyPaginationState.pageSize);

    tbody.innerHTML = result.items.map((record, localIndex) => {
        const displayIndex = result.startIndex + localIndex;
        return `
        <tr class="border-b border-gray-200 hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-600">${displayIndex}</td>
            <td class="px-4 py-3 text-sm text-gray-800">${escapeHtml(record.employeeName || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.clientName || record.clientId || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.date || '')}</td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 text-xs rounded-full ${getShiftClass(record.shift)}">
                    ${escapeHtml(record.shift || '')}
                </span>
            </td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 text-xs rounded-full ${getStatusClass(record.status)}">
                    ${escapeHtml(record.status || '')}
                </span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.checkIn || '-')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.checkOut || '-')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.notes || '-')}</td>
            <td class="px-4 py-3 text-sm">
                <button onclick="deleteRecord('${record.id}')" class="text-red-600 hover:text-red-800">Delete</button>
            </td>
        </tr>
        `;
    }).join('');

    renderPaginationControls('dutyPagination', {
        ...result,
        pageSize: dutyPaginationState.pageSize
    }, {
        onPageChange: (page) => {
            dutyPaginationState.currentPage = page;
            renderPaginatedDutyTable();
        },
        onPageSizeChange: (size) => {
            dutyPaginationState.pageSize = size;
            dutyPaginationState.currentPage = 1;
            renderPaginatedDutyTable();
        }
    });
}

/**
 * Render grouped duty table — grouped by notes (location/site)
 * All groups expanded by default.
 */
function renderGroupedDutyTable() {
    renderGroupedTable({
        tbodyId: 'dutyTableBody',
        paginationId: 'dutyPagination',
        data: dutyFilteredData,
        colSpan: 10,
        emptyMessage: 'No duty records found for this date. Add a record using the button above.',
        emptyIcon: 'fa-clipboard-list',
        groupKeyFn: function(r) { return normalizeGroupKey(r.notes); },
        groupSummaryFn: function(key, items) {
            var present = items.filter(function(r) { return r.status === 'Present'; }).length;
            var absent = items.filter(function(r) { return r.status === 'Absent'; }).length;
            var late = items.filter(function(r) { return r.status === 'Late'; }).length;
            var day = items.filter(function(r) { return r.shift === 'Day'; }).length;
            var night = items.filter(function(r) { return r.shift === 'Night'; }).length;
            return 'Day: ' + day + ' | Night: ' + night + ' | Present: ' + present + ' | Absent: ' + absent + ' | Late: ' + late;
        },
        renderRowFn: function(record, idx) {
            return '<td class="px-4 py-3 text-sm text-gray-600">' + idx + '</td>' +
                '<td class="px-4 py-3 text-sm text-gray-800">' + escapeHtml(record.employeeName || '') + '</td>' +
                '<td class="px-4 py-3 text-sm text-gray-600">' + escapeHtml(record.clientName || record.clientId || '') + '</td>' +
                '<td class="px-4 py-3 text-sm text-gray-600">' + escapeHtml(record.date || '') + '</td>' +
                '<td class="px-4 py-3"><span class="px-2 py-1 text-xs rounded-full ' + getShiftClass(record.shift) + '">' + escapeHtml(record.shift || '') + '</span></td>' +
                '<td class="px-4 py-3"><span class="px-2 py-1 text-xs rounded-full ' + getStatusClass(record.status) + '">' + escapeHtml(record.status || '') + '</span></td>' +
                '<td class="px-4 py-3 text-sm text-gray-600">' + escapeHtml(record.checkIn || '-') + '</td>' +
                '<td class="px-4 py-3 text-sm text-gray-600">' + escapeHtml(record.checkOut || '-') + '</td>' +
                '<td class="px-4 py-3 text-sm text-gray-600">' + escapeHtml(record.notes || '-') + '</td>' +
                '<td class="px-4 py-3 text-sm"><button onclick="deleteRecord(\'' + record.id + '\')" class="text-red-600 hover:text-red-800">Delete</button></td>';
        }
    });
}

/**
 * Switch between flat and grouped view modes
 * @param {string} mode - 'flat' or 'grouped'
 */
function setDutyViewMode(mode) {
    dutyViewMode = mode;
    // Update button styles
    var btnFlat = document.getElementById('btnFlatView');
    var btnGrouped = document.getElementById('btnGroupedView');
    var btnExpand = document.getElementById('btnExpandAll');
    var btnCollapse = document.getElementById('btnCollapseAll');
    if (btnFlat && btnGrouped) {
        if (mode === 'flat') {
            btnFlat.className = 'px-3 py-1.5 bg-blue-600 text-white font-medium';
            btnGrouped.className = 'px-3 py-1.5 bg-white text-gray-600 hover:bg-gray-50 font-medium';
        } else {
            btnFlat.className = 'px-3 py-1.5 bg-white text-gray-600 hover:bg-gray-50 font-medium';
            btnGrouped.className = 'px-3 py-1.5 bg-blue-600 text-white font-medium';
        }
    }
    if (btnExpand) btnExpand.classList.toggle('hidden', mode === 'flat');
    if (btnCollapse) btnCollapse.classList.toggle('hidden', mode === 'flat');
    // Re-render
    renderDutyTable(dutyFilteredData);
}

/**
 * Update summary metrics
 * @param {Array} data - Array of duty records
 */
function updateDutySummary(data) {
    const total = data.length;
    const dayShift = data.filter(r => r.shift === 'Day').length;
    const nightShift = data.filter(r => r.shift === 'Night').length;
    const present = data.filter(r => r.status === 'Present').length;
    const absent = data.filter(r => r.status === 'Absent').length;
    const late = data.filter(r => r.status === 'Late').length;

    setElementText('summaryTotal', total);
    setElementText('summaryDayShift', dayShift);
    setElementText('summaryNightShift', nightShift);
    setElementText('summaryPresent', present);
    setElementText('summaryAbsent', absent);
    setElementText('summaryLate', late);
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
 * Get CSS class for shift badge
 * @param {string} shift - Shift type
 * @returns {string} CSS classes
 */
function getShiftClass(shift) {
    switch (shift) {
        case 'Day':
            return 'bg-yellow-100 text-yellow-800';
        case 'Night':
            return 'bg-indigo-100 text-indigo-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

/**
 * Get CSS class for status badge
 * @param {string} status - Duty status
 * @returns {string} CSS classes
 */
function getStatusClass(status) {
    switch (status) {
        case 'Present':
            return 'bg-green-100 text-green-800';
        case 'Absent':
            return 'bg-red-100 text-red-800';
        case 'Late':
            return 'bg-yellow-100 text-yellow-800';
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
    
    refreshGuardDuty(currentDate);
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
 * Open add duty modal
 */
function openAddDutyModal() {
    const modal = document.getElementById('dutyFormModal');
    const form = document.getElementById('dutyForm');
    
    if (form) {
        form.reset();
        // Pre-fill date with current date
        form.date.value = currentDate;
        // Clear hidden lookup fields (reset doesn't clear hidden inputs)
        if (form.clientId) form.clientId.value = '';
        if (form.employeeId) form.employeeId.value = '';
    }

    if (modal) {
        modal.classList.remove('hidden');
    }
}

/**
 * Close duty modal
 */
function closeDutyModal() {
    const modal = document.getElementById('dutyFormModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Handle form submission for adding duty record
 * @param {Event} event - Form submit event
 */
async function handleSubmit(event) {
    event.preventDefault();

    const form = document.getElementById('dutyForm');
    if (!form) return;
    
    // Validate form
    if (typeof validateForm === 'function' && !validateForm('dutyForm')) {
        return;
    }

    // Validate that a client was selected from the lookup (not just typed)
    const clientIdVal = String(form.clientId.value).trim();
    const clientNameVal = String(form.clientName.value).trim();
    if (clientNameVal && !clientIdVal) {
        if (typeof showToast === 'function') {
            showToast('Please select a valid client from the list.', 'warning');
        }
        form.clientName.focus();
        return;
    }
    if (!clientIdVal) {
        if (typeof showToast === 'function') {
            showToast('Client is required. Type to search and select a client.', 'warning');
        }
        form.clientName.focus();
        return;
    }

    // Validate that an employee was selected from the lookup
    const employeeIdVal = String(form.employeeId.value).trim();
    if (!employeeIdVal) {
        if (typeof showToast === 'function') {
            showToast('Please select a valid employee from the list.', 'warning');
        }
        form.employeeName.focus();
        return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const restoreBtn = typeof setButtonLoading === 'function' 
        ? setButtonLoading(submitBtn, 'Saving...') 
        : () => {};

    // Generate unique ID
    const id = 'GD-' + Date.now();

    const payload = {
        id: id,
        employeeId: String(form.employeeId.value).trim(),
        employeeName: String(form.employeeName.value).trim(),
        clientId: String(form.clientId.value).trim(),
        clientName: String(form.clientName.value).trim(),
        date: String(form.date.value).trim(),
        shift: String(form.shift.value).trim(),
        status: String(form.status.value).trim(),
        checkIn: String(form.checkIn.value).trim(),
        checkOut: String(form.checkOut.value).trim(),
        notes: String(form.notes.value).trim()
    };

    // Debug logging (enable with: window._GUARD_DUTY_DEBUG = true)
    if (window._GUARD_DUTY_DEBUG) {
        console.log('[guard-duty] submit payload:', JSON.stringify(payload, null, 2));
    }

    try {
        const response = await request("addGuardDuty", payload);

        if (window._GUARD_DUTY_DEBUG) {
            console.log('[guard-duty] response:', JSON.stringify(response));
        }

        if (response.success) {
            closeDutyModal();
            await refreshGuardDuty(currentDate);
            if (typeof markDashboardDirty === 'function') markDashboardDirty('guard-duty');
            if (typeof refreshDashboard === 'function') refreshDashboard('guard-duty');
            if (typeof showToast === 'function') {
                showToast('Duty record saved successfully', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to save duty record', 'error');
            }
        }
    } catch (error) {
        console.error("Error adding duty record:", error);
        if (typeof showToast === 'function') {
            showToast('Error saving duty record', 'error');
        }
    } finally {
        restoreBtn();
    }
}

// ============================================
// DELETE OPERATION
// ============================================

/**
 * Delete a duty record
 * @param {string} id - Record ID
 */
async function deleteRecord(id) {
    const record = dutyRecords.find(r => String(r.id) === String(id));
    const recordName = record ? `${record.employeeName}'s duty record` : 'this duty record';
    
    let confirmed = false;
    if (typeof confirmDelete === 'function') {
        confirmed = await confirmDelete(recordName);
    } else {
        confirmed = confirm('Are you sure you want to delete this duty record?');
    }
    
    if (!confirmed) return;

    try {
        const response = await request("deleteGuardDuty", { id: id });
        if (response.success) {
            await refreshGuardDuty(currentDate);
            // Optional dashboard sync (guarded)
            if (typeof markDashboardDirty === 'function') markDashboardDirty('guard-duty');
            if (typeof refreshDashboard === 'function') refreshDashboard('guard-duty');
            if (typeof showToast === 'function') {
                showToast('Duty record deleted successfully', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to delete duty record', 'error');
            }
        }
    } catch (error) {
        console.error("Error deleting duty record:", error);
        if (typeof showToast === 'function') {
            showToast('Error deleting duty record', 'error');
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
    if (typeof initFormValidation === 'function') initFormValidation('dutyForm');
    if (typeof initModalAccessibility === 'function') initModalAccessibility('dutyFormModal', closeDutyModal);
    
    // Initialize employee lookup (type-ahead)
    if (typeof initEmployeeLookup === 'function') {
        initEmployeeLookup({ inputId: 'employeeName', hiddenIdField: 'employeeId' });
        preloadEmployeeLookup();
    }
    
    // Initialize client lookup (type-ahead)
    if (typeof initClientLookup === 'function') {
        initClientLookup({ inputId: 'clientName', hiddenIdField: 'clientId' });
        preloadClientLookup();
    }
    
    // Initial load
    await refreshGuardDuty(currentDate);
});
