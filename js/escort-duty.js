// Escort Duty Tracking Module (Date-Range Based)
// Isolated module - NO cross-module references

// ============================================
// SINGLE SOURCE OF TRUTH
// ============================================
let escortRecords = [];
let currentRange = {
    startDate: getTodayISO(),
    endDate: getTodayISO()
};

// ============================================
// PAGINATION STATE
// ============================================
let escortPaginationState = createPaginationState(10);
let escortFilteredData = [];
let escortViewMode = 'flat'; // 'flat' | 'grouped'

// ============================================
// REFRESH FUNCTION (EXPLICIT ONLY)
// ============================================

/**
 * Refresh escort duty data for a specific date range
 * ALL UI updates happen here - no other function may mutate escortRecords
 * @param {Object} dateRange - { startDate, endDate } in YYYY-MM-DD format
 */
async function refreshEscortDuty(dateRange) {
    // Show loading state
    if (typeof showTableLoading === 'function') {
        showTableLoading('escortTableBody', 11);
    }
    
    try {
        const response = await request("getEscortDuty", dateRange);
        if (response.success && Array.isArray(response.data)) {
            escortRecords = response.data;
        } else {
            escortRecords = [];
        }
        // All UI updates happen here
        renderEscortTable(escortRecords);
        updateEscortSummary(escortRecords);
        updateDateRangeDisplay();
    } catch (error) {
        console.error("Failed to refresh escort duty:", error);
        escortRecords = [];
        renderEscortTable(escortRecords);
        updateEscortSummary(escortRecords);
        updateDateRangeDisplay();
        if (typeof showToast === 'function') {
            showToast('Failed to load escort records', 'error');
        }
    }
}

// ============================================
// RENDER FUNCTIONS
// ============================================

/**
 * Render escort records table
 * @param {Array} data - Array of escort records
 */
function renderEscortTable(data) {
    escortFilteredData = data || [];
    escortPaginationState.currentPage = 1;
    if (escortViewMode === 'grouped') {
        renderGroupedEscortTable();
    } else {
        renderPaginatedEscortTable();
    }
}

/**
 * Render paginated escort records table
 */
function renderPaginatedEscortTable() {
    const tbody = document.getElementById('escortTableBody');
    if (!tbody) return;

    if (!escortFilteredData || escortFilteredData.length === 0) {
        if (typeof showEmptyState === 'function') {
            showEmptyState('escortTableBody', 'No escort records found for this date range. Add a record using the button above.', 11, 'fa-ship');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="px-4 py-8 text-center text-gray-500">
                        No escort records found for this date range
                    </td>
                </tr>
            `;
        }
        const paginationContainer = document.getElementById('escortPagination');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const result = paginate(escortFilteredData, escortPaginationState.currentPage, escortPaginationState.pageSize);

    tbody.innerHTML = result.items.map((record, localIndex) => {
        const displayIndex = result.startIndex + localIndex;
        const isOngoing = !record.endDate;
        return `
        <tr class="border-b border-gray-200 hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-600">${displayIndex}</td>
            <td class="px-4 py-3 text-sm text-gray-800">${escapeHtml(record.employeeName || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.clientName || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.vesselName || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.lighterName || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.startDate || '')} ${escapeHtml(record.startShift || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${isOngoing ? '<span class="text-blue-600 font-medium">Ongoing</span>' : escapeHtml(record.endDate || '') + ' ' + escapeHtml(record.endShift || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-800 font-medium">${isOngoing ? '-' : (record.totalDays || 0)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${record.conveyance || 0}</td>
            <td class="px-4 py-3 text-sm">
                <span class="px-2 py-1 rounded-full text-xs ${(record.status || '').toLowerCase() === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                    ${escapeHtml(record.status || '')}
                </span>
            </td>
            <td class="px-4 py-3 text-sm space-x-1">
                <button onclick="viewEscortRecord('${record.id}')" class="text-blue-600 hover:text-blue-800">View</button>
                <button onclick="editEscortRecord('${record.id}')" class="text-green-600 hover:text-green-800">Edit</button>
                <button onclick="deleteRecord('${record.id}')" class="text-red-600 hover:text-red-800">Delete</button>
            </td>
        </tr>
        `;
    }).join('');

    renderPaginationControls('escortPagination', {
        ...result,
        pageSize: escortPaginationState.pageSize
    }, {
        onPageChange: (page) => {
            escortPaginationState.currentPage = page;
            renderPaginatedEscortTable();
        },
        onPageSizeChange: (size) => {
            escortPaginationState.pageSize = size;
            escortPaginationState.currentPage = 1;
            renderPaginatedEscortTable();
        }
    });
}

/**
 * Render grouped escort records table (two-level: Client -> Vessel)
 */
function renderGroupedEscortTable() {
    renderTwoLevelGroupedTable({
        tbodyId: 'escortTableBody',
        paginationId: 'escortPagination',
        data: escortFilteredData,
        l1KeyFn: (r) => normalizeGroupKey(r.clientName || r.clientId),
        l2KeyFn: (r) => normalizeGroupKey(r.vesselName) === 'General' ? 'Unknown Vessel' : normalizeGroupKey(r.vesselName),
        colSpan: 11,
        emptyMessage: 'No escort records found for this date range.',
        renderRowFn: (record) => {
            const isOngoing = !record.endDate;
            return `
            <td class="px-4 py-3 text-sm text-gray-800">${escapeHtml(record.employeeName || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.clientName || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.vesselName || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.lighterName || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.startDate || '')} ${escapeHtml(record.startShift || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${isOngoing ? '<span class="text-blue-600 font-medium">Ongoing</span>' : escapeHtml(record.endDate || '') + ' ' + escapeHtml(record.endShift || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-800 font-medium">${isOngoing ? '-' : (record.totalDays || 0)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${record.conveyance || 0}</td>
            <td class="px-4 py-3 text-sm">
                <span class="px-2 py-1 rounded-full text-xs ${(record.status || '').toLowerCase() === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                    ${escapeHtml(record.status || '')}
                </span>
            </td>
            <td class="px-4 py-3 text-sm space-x-1">
                <button onclick="viewEscortRecord('${record.id}')" class="text-blue-600 hover:text-blue-800">View</button>
                <button onclick="editEscortRecord('${record.id}')" class="text-green-600 hover:text-green-800">Edit</button>
                <button onclick="deleteRecord('${record.id}')" class="text-red-600 hover:text-red-800">Delete</button>
            </td>`;
        },
        l1SummaryFn: (key, items) => {
            const total = items.length;
            const totalDays = items.reduce((s, r) => r.endDate ? s + (Number(r.totalDays) || 0) : s, 0);
            const active = items.filter(r => (r.status || '').toLowerCase() === 'active').length;
            const conv = items.reduce((s, r) => s + (Number(r.conveyance) || 0), 0);
            return `${total} rec | ${totalDays} days | ${active} active | Conv: ${conv}`;
        },
        l2SummaryFn: (key, items) => {
            const totalDays = items.reduce((s, r) => r.endDate ? s + (Number(r.totalDays) || 0) : s, 0);
            const ongoing = items.filter(r => !r.endDate).length;
            return `${totalDays} days` + (ongoing ? ` | ${ongoing} ongoing` : '');
        }
    });
}

/**
 * Toggle escort view mode between flat and grouped
 * @param {string} mode - 'flat' or 'grouped'
 */
function setEscortViewMode(mode) {
    escortViewMode = mode;
    const flatBtn = document.getElementById('escortFlatBtn');
    const groupedBtn = document.getElementById('escortGroupedBtn');
    const expandBtn = document.getElementById('escortExpandAllBtn');
    const collapseBtn = document.getElementById('escortCollapseAllBtn');
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
    renderEscortTable(escortFilteredData);
}

/**
 * Update summary metrics
 * @param {Array} data - Array of escort records
 */
function updateEscortSummary(data) {
    const totalRecords = data.length;
    const totalDays = data.reduce((sum, r) => r.endDate ? sum + (Number(r.totalDays) || 0) : sum, 0);
    const ongoingCount = data.filter(r => !r.endDate).length;
    const activeCount = data.filter(r => (r.status || '').toLowerCase() === 'active').length;
    const inactiveCount = data.filter(r => (r.status || '').toLowerCase() === 'inactive').length;

    setElementText('summaryTotalRecords', totalRecords);
    setElementText('summaryTotalDays', totalDays);
    setElementText('summaryActiveEscorts', activeCount);
    setElementText('summaryOngoingEscorts', ongoingCount);
    setElementText('summaryInactiveEscorts', inactiveCount);
}

/**
 * Update date range display in navigation
 */
function updateDateRangeDisplay() {
    setElementText('startDateDisplay', currentRange.startDate);
    setElementText('endDateDisplay', currentRange.endDate);
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
// DATE RANGE NAVIGATION
// ============================================

/**
 * Apply date range filter from inputs
 */
function applyDateRange() {
    const startInput = document.getElementById('filterStartDate');
    const endInput = document.getElementById('filterEndDate');
    
    if (startInput && endInput) {
        currentRange.startDate = startInput.value || getTodayISO();
        currentRange.endDate = endInput.value || getTodayISO();
        
        // Ensure start is not after end
        if (currentRange.startDate > currentRange.endDate) {
            currentRange.endDate = currentRange.startDate;
            endInput.value = currentRange.endDate;
        }
        
        refreshEscortDuty(currentRange);
    }
}

/**
 * Reset date range to today
 */
function resetDateRange() {
    const today = getTodayISO();
    currentRange.startDate = today;
    currentRange.endDate = today;
    
    const startInput = document.getElementById('filterStartDate');
    const endInput = document.getElementById('filterEndDate');
    
    if (startInput) startInput.value = today;
    if (endInput) endInput.value = today;
    
    refreshEscortDuty(currentRange);
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
// TOTAL DAYS CALCULATION
// ============================================

/**
 * Calculate total days based on start/end date and shifts
 * Two shifts = one full day
 * Day = shift 1, Night = shift 2
 * 
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} startShift - 'Day' or 'Night'
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {string} endShift - 'Day' or 'Night'
 * @returns {number} Total days (can be .5 increments)
 */
function calculateTotalDays(startDate, startShift, endDate, endShift) {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    
    // Calculate full days between dates
    const daysDiff = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    
    // Assign shift numbers: Day = 1, Night = 2
    const startShiftNum = startShift === 'Day' ? 1 : 2;
    const endShiftNum = endShift === 'Day' ? 1 : 2;
    
    // Calculate total half-days
    // Formula: (days_diff * 2) + (endShiftNum - startShiftNum + 1)
    const totalHalfDays = (daysDiff * 2) + (endShiftNum - startShiftNum + 1);
    
    // Convert to days (2 half-days = 1 day)
    return totalHalfDays / 2;
}

// ============================================
// FORM HANDLING
// ============================================

/**
 * Open add escort modal
 */
function openAddEscortModal() {
    const modal = document.getElementById('escortFormModal');
    const form = document.getElementById('escortForm');
    const modalTitle = document.getElementById('escortFormModalTitle');
    
    if (form) {
        form.reset();
        // Clear hidden fields
        form.employeeId.value = '';
        // Remove edit mode marker
        delete form.dataset.editId;
        // Pre-fill start date
        form.startDate.value = currentRange.startDate;
        form.startShift.value = '';
        form.endDate.value = '';
        form.endShift.value = '';
        form.status.value = 'Active';
    }
    
    if (modalTitle) {
        modalTitle.textContent = 'Add Escort Duty';
    }
    
    // Update submit button text
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    if (submitBtn) submitBtn.textContent = 'Save Escort';
    
    if (modal) {
        modal.classList.remove('hidden');
    }
}

/**
 * Close escort modal
 */
function closeEscortModal() {
    const modal = document.getElementById('escortFormModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Handle form submission for adding/editing escort record
 * @param {Event} event - Form submit event
 */
async function handleSubmit(event) {
    event.preventDefault();

    const form = document.getElementById('escortForm');
    if (!form) return;
    
    // Validate form
    if (typeof validateForm === 'function' && !validateForm('escortForm')) {
        return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const restoreBtn = typeof setButtonLoading === 'function' 
        ? setButtonLoading(submitBtn, 'Saving...') 
        : () => {};

    // Check if editing existing record
    const editId = form.dataset.editId || '';
    const isEdit = !!editId;

    // Generate unique ID for new records
    const id = isEdit ? editId : 'ED-' + Date.now();

    // Get form values
    const startDate = String(form.startDate.value).trim();
    const startShift = String(form.startShift.value).trim();
    const endDate = String(form.endDate.value).trim();
    const endShift = String(form.endShift.value).trim();
    
    // Calculate totalDays — only if both start and end dates exist
    let totalDays = 0;
    if (startDate && endDate) {
        const sShift = startShift || 'Day';
        const eShift = endShift || 'Night';
        totalDays = calculateTotalDays(startDate, sShift, endDate, eShift);
    }

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
        vesselName: String(form.vesselName.value).trim(),
        lighterName: String(form.lighterName.value).trim(),
        startDate: startDate,
        startShift: startShift,
        endDate: endDate,
        endShift: endShift,
        releasePoint: String(form.releasePoint.value).trim(),
        totalDays: totalDays,
        conveyance: Number(form.conveyance.value) || 0,
        status: String(form.status.value).trim(),
        notes: String(form.notes.value).trim()
    };

    // Debug logging (enable with: window._ESCORT_DUTY_DEBUG = true)
    if (window._ESCORT_DUTY_DEBUG) {
        console.log('[escort-duty] submit payload:', JSON.stringify(payload, null, 2));
    }

    try {
        const action = isEdit ? 'updateEscortDuty' : 'addEscortDuty';
        const response = await request(action, payload);

        if (window._ESCORT_DUTY_DEBUG) {
            console.log('[escort-duty] response:', JSON.stringify(response));
        }

        if (response.success) {
            closeEscortModal();
            await refreshEscortDuty(currentRange);
            if (typeof markDashboardDirty === 'function') markDashboardDirty('escort-duty');
            if (typeof refreshDashboard === 'function') refreshDashboard('escort-duty');
            if (typeof showToast === 'function') {
                showToast(isEdit ? 'Escort record updated successfully' : 'Escort record saved successfully', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to save escort record', 'error');
            }
        }
    } catch (error) {
        console.error("Error saving escort record:", error);
        if (typeof showToast === 'function') {
            showToast('Error saving escort record', 'error');
        }
    } finally {
        restoreBtn();
    }
}

// ============================================
// VIEW & EDIT OPERATIONS
// ============================================

/**
 * View escort record details in a modal
 * @param {string} id - Record ID
 */
function viewEscortRecord(id) {
    const record = escortRecords.find(r => String(r.id) === String(id));
    if (!record) {
        console.error("Escort record not found:", id);
        return;
    }

    const isOngoing = !record.endDate;
    const details = `
        <div class="space-y-2 text-sm">
            <p><strong>Employee:</strong> ${escapeHtml(record.employeeName || '')} ${record.employeeId ? '(' + escapeHtml(record.employeeId) + ')' : ''}</p>
            <p><strong>Client:</strong> ${escapeHtml(record.clientName || '')}</p>
            <p><strong>Vessel:</strong> ${escapeHtml(record.vesselName || '-')}</p>
            <p><strong>Lighter:</strong> ${escapeHtml(record.lighterName || '-')}</p>
            <hr class="my-2">
            <p><strong>Start Date:</strong> ${escapeHtml(record.startDate || '')} ${escapeHtml(record.startShift || '')}</p>
            <p><strong>End Date:</strong> ${isOngoing ? '<span class="text-blue-600 font-medium">Ongoing</span>' : escapeHtml(record.endDate || '') + ' ' + escapeHtml(record.endShift || '')}</p>
            <p><strong>Total Days:</strong> ${isOngoing ? 'N/A (ongoing)' : (record.totalDays || 0)}</p>
            <p><strong>Release Point:</strong> ${escapeHtml(record.releasePoint || '-')}</p>
            <p><strong>Conveyance:</strong> ${record.conveyance || 0}</p>
            <p><strong>Salary:</strong> ${isOngoing ? '<span class="text-amber-600 font-medium">Pending (duty ongoing)</span>' : 'Calculated on completion'}</p>
            <p><strong>Status:</strong> ${escapeHtml(record.status || '')}</p>
            <p><strong>Notes:</strong> ${escapeHtml(record.notes || '-')}</p>
        </div>
    `;

    // Use the escort-specific view modal
    showEscortViewModal('Escort Duty Details', details);
}

/**
 * Edit escort record — populate modal with existing data
 * @param {string} id - Record ID
 */
function editEscortRecord(id) {
    const record = escortRecords.find(r => String(r.id) === String(id));
    if (!record) {
        console.error("Escort record not found:", id);
        return;
    }

    const modal = document.getElementById('escortFormModal');
    const form = document.getElementById('escortForm');
    const modalTitle = document.getElementById('escortFormModalTitle');

    if (!form) return;

    // Set edit mode
    form.dataset.editId = record.id;

    // Populate form fields
    form.employeeId.value = record.employeeId || '';
    form.employeeName.value = record.employeeName || '';
    form.clientId.value = record.clientId || '';
    // Select option by clientId (option values are IDs, not names)
    // Fall back to matching by option text for backward compat with old records
    const cSelect = form.clientName;
    let cMatched = false;
    if (record.clientId) {
        cSelect.value = record.clientId;
        if (cSelect.value === record.clientId) cMatched = true;
    }
    if (!cMatched && record.clientName) {
        for (let i = 0; i < cSelect.options.length; i++) {
            if (cSelect.options[i].text === record.clientName) {
                cSelect.selectedIndex = i;
                cMatched = true;
                break;
            }
        }
    }
    if (!cMatched) cSelect.value = '';
    form.vesselName.value = record.vesselName || '';
    form.lighterName.value = record.lighterName || '';
    form.startDate.value = record.startDate || '';
    form.startShift.value = record.startShift || '';
    form.endDate.value = record.endDate || '';
    form.endShift.value = record.endShift || '';
    form.releasePoint.value = record.releasePoint || '';
    form.conveyance.value = record.conveyance || 0;
    form.status.value = record.status || 'Active';
    form.notes.value = record.notes || '';

    if (modalTitle) {
        modalTitle.textContent = 'Edit Escort Duty';
    }

    // Update submit button text
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Update Escort';

    if (modal) {
        modal.classList.remove('hidden');
    }
}

/**
 * Show escort view modal (reusable for view details)
 * @param {string} title - Modal title
 * @param {string} content - HTML content
 */
function showEscortViewModal(title, content) {
    // Check if a generic view modal exists, otherwise create one
    let modal = document.getElementById('escortViewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'escortViewModal';
        modal.className = 'hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg shadow-lg max-w-lg w-full mx-4">
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h3 id="escortViewModalTitle" class="text-lg font-semibold text-gray-800"></h3>
                    <button onclick="closeEscortViewModal()" class="text-gray-500 hover:text-gray-700" title="Close">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div id="escortViewModalContent" class="px-6 py-4"></div>
                <div class="px-6 py-4 border-t border-gray-200 flex justify-end">
                    <button onclick="closeEscortViewModal()" class="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('escortViewModalTitle').textContent = title;
    document.getElementById('escortViewModalContent').innerHTML = content;
    modal.classList.remove('hidden');
}

/**
 * Close escort view modal
 */
function closeEscortViewModal() {
    const modal = document.getElementById('escortViewModal');
    if (modal) modal.classList.add('hidden');
}

// ============================================
// DELETE OPERATION
// ============================================

/**
 * Delete an escort record
 * @param {string} id - Record ID
 */
async function deleteRecord(id) {
    const record = escortRecords.find(r => String(r.id) === String(id));
    const recordName = record ? `${record.employeeName}'s escort record` : 'this escort record';
    
    let confirmed = false;
    if (typeof confirmDelete === 'function') {
        confirmed = await confirmDelete(recordName);
    } else {
        confirmed = confirm('Are you sure you want to delete this escort record?');
    }
    
    if (!confirmed) return;

    try {
        const response = await request("deleteEscortDuty", { id: id });
        if (response.success) {
            await refreshEscortDuty(currentRange);
            if (typeof markDashboardDirty === 'function') markDashboardDirty('escort-duty');
            if (typeof refreshDashboard === 'function') refreshDashboard('escort-duty');
            if (typeof showToast === 'function') {
                showToast('Escort record deleted successfully', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to delete escort record', 'error');
            }
        }
    } catch (error) {
        console.error("Error deleting escort record:", error);
        if (typeof showToast === 'function') {
            showToast('Error deleting escort record', 'error');
        }
    }
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize escort duty module on page load
 */
document.addEventListener('DOMContentLoaded', async function() {
    // Verify session with backend before proceeding
    if (typeof requireAuth === 'function') {
        const authed = await requireAuth();
        if (!authed) return;
    }
    if (typeof renderUserInfo === 'function') renderUserInfo('userInfo');
    
    // Initialize UX enhancements
    if (typeof initFormValidation === 'function') initFormValidation('escortForm');
    if (typeof initModalAccessibility === 'function') initModalAccessibility('escortFormModal', closeEscortModal);
    
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
    
    // Set initial date range inputs
    const startInput = document.getElementById('filterStartDate');
    const endInput = document.getElementById('filterEndDate');
    
    if (startInput) startInput.value = currentRange.startDate;
    if (endInput) endInput.value = currentRange.endDate;
    
    // Initial data load
    await refreshEscortDuty(currentRange);
});
