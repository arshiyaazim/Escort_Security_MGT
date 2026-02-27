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

// Margin analytics cache — avoids repeated GAS calls per client
const marginCache = new Map();

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
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.lighterVessel || record.lighterName || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(record.startDate || '')} ${escapeHtml(record.startShift || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${isOngoing ? '<span class="text-blue-600 font-medium">Ongoing</span>' : escapeHtml(record.endDate || '') + ' ' + escapeHtml(record.endShift || '')}</td>
            <td class="px-4 py-3 text-sm text-gray-800 font-medium">${durationDisplay(record)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${record.conveyance || 0}</td>
            <td class="px-4 py-3 text-sm">
                <span class="px-2 py-1 rounded-full text-xs ${getStatusBadge(record).cssClass}">
                    ${escapeHtml(getStatusBadge(record).text)}
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
 * Sort records for predictable grouping order.
 * Sort by: clientName → vesselName → lighterVessel → employeeName → startDate
 * @param {Array} records
 * @returns {Array} sorted copy
 */
function sortEscortForGrouping(records) {
    return (records || []).slice().sort(function(a, b) {
        var cmp;
        cmp = (a.clientName || '').localeCompare(b.clientName || '');
        if (cmp !== 0) return cmp;
        cmp = (a.vesselName || '').localeCompare(b.vesselName || '');
        if (cmp !== 0) return cmp;
        var aL = ((a.lighterVessel || a.lighterName || '') + '').trim();
        var bL = ((b.lighterVessel || b.lighterName || '') + '').trim();
        cmp = aL.localeCompare(bL);
        if (cmp !== 0) return cmp;
        cmp = (a.employeeName || '').localeCompare(b.employeeName || '');
        if (cmp !== 0) return cmp;
        return (a.startDate || '').localeCompare(b.startDate || '');
    });
}

/**
 * Normalize lighter vessel value for grouping.
 * Trims whitespace; returns 'N/A' for empty/null values.
 * @param {Object} record
 * @returns {string}
 */
function normalizeLighter(record) {
    return ((record.lighterVessel || record.lighterName || '') + '').trim() || 'N/A';
}

/**
 * Calculate number of days from startDate to today for ongoing records.
 * Returns 0 if startDate is missing or in the future.
 * @param {Object} record
 * @returns {number}
 */
function calcOngoingDays(record) {
    if (!record.startDate) return 0;
    var parts = String(record.startDate).split('-');
    if (parts.length < 3) return 0;
    var start = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var diff = Math.floor((today - start) / 86400000);
    return diff > 0 ? diff : 0;
}

/**
 * Build duration display HTML for the Total Days column.
 * Ongoing: shows calculated days with "so far" label in blue.
 * Completed: shows the recorded totalDays value.
 * @param {Object} record
 * @returns {string} HTML
 */
function durationDisplay(record) {
    var isOngoing = !record.endDate;
    if (isOngoing) {
        var days = calcOngoingDays(record);
        return '<span class="text-blue-600 font-medium">' + days + '</span> <span class="text-xs text-gray-400">days so far</span>';
    }
    return String(record.totalDays || 0);
}

/**
 * Return status badge CSS class and display text.
 * Green = Completed, Blue = On-going / Active, Gray = other.
 * @param {Object} record
 * @returns {{ cssClass: string, text: string }}
 */
function getStatusBadge(record) {
    var isOngoing = !record.endDate;
    var status = (record.status || '').trim();
    var lower = status.toLowerCase();
    var text = status || (isOngoing ? 'On-going' : 'Completed');
    var cssClass;
    if (lower === 'completed' || (!isOngoing && lower !== 'on-going' && lower !== 'active')) {
        cssClass = 'bg-green-100 text-green-800';
    } else if (isOngoing || lower === 'on-going' || lower === 'active') {
        cssClass = 'bg-blue-100 text-blue-800';
    } else {
        cssClass = 'bg-gray-100 text-gray-800';
    }
    return { cssClass: cssClass, text: text };
}

/**
 * Render grouped escort records table
 * Hierarchy: Client → Vessel → Lighter → Employee rows
 */
function renderGroupedEscortTable() {
    var tbody = document.getElementById('escortTableBody');
    if (!tbody) return;

    var pagEl = document.getElementById('escortPagination');
    if (pagEl) pagEl.innerHTML = '';

    var data = sortEscortForGrouping(escortFilteredData);

    if (data.length === 0) {
        if (typeof showEmptyState === 'function') {
            showEmptyState('escortTableBody', 'No escort records found for this date range.', 11, 'fa-ship');
        } else {
            tbody.innerHTML = '<tr><td colspan="11" class="px-4 py-8 text-center text-gray-500">No escort records found for this date range.</td></tr>';
        }
        return;
    }

    // L1: Client
    var l1Groups = groupBy(data, function(r) { return normalizeGroupKey(r.clientName || r.clientId); });
    var html = '';
    var globalIndex = 1;

    l1Groups.forEach(function(l1) {
        var l1Id = 'grp-escort-L1-' + l1.key.replace(/[^a-zA-Z0-9]/g, '_');
        var l1Total = l1.items.length;
        var l1Days = l1.items.reduce(function(s, r) { return r.endDate ? s + (Number(r.totalDays) || 0) : s; }, 0);
        var l1Active = l1.items.filter(function(r) { return (r.status || '').toLowerCase() === 'active' || (r.status || '') === 'On-going'; }).length;
        var l1Conv = l1.items.reduce(function(s, r) { return s + (Number(r.conveyance) || 0); }, 0);

        // L1 header
        html += '<tr class="bg-blue-100 border-b-2 border-blue-300 cursor-pointer" onclick="toggleGroup(\'' + l1Id + '\')"><td colspan="11" class="px-4 py-3"><div class="flex items-center justify-between"><div class="flex items-center gap-2">';
        html += '<svg id="' + l1Id + '-icon" class="w-4 h-4 text-blue-700 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>';
        html += '<span class="font-bold text-blue-900">' + escapeHtml(l1.key) + '</span>';
        html += '<span class="text-sm text-blue-700 ml-2">(' + l1Total + ' record' + (l1Total !== 1 ? 's' : '') + ')</span>';
        html += '</div><span class="text-xs text-blue-700">' + l1Total + ' rec | ' + l1Days + ' days | ' + l1Active + ' active | Conv: ' + l1Conv + '</span></div></td></tr>';

        // L2: Vessel
        var l2Groups = groupBy(l1.items, function(r) {
            var v = normalizeGroupKey(r.vesselName);
            return v === 'General' ? 'Unknown Vessel' : v;
        });

        l2Groups.forEach(function(l2) {
            var l2Id = l1Id + '-L2-' + l2.key.replace(/[^a-zA-Z0-9]/g, '_');
            var l2Days = l2.items.reduce(function(s, r) { return r.endDate ? s + (Number(r.totalDays) || 0) : s; }, 0);
            var l2Ongoing = l2.items.filter(function(r) { return !r.endDate; }).length;

            html += '<tr class="' + l1Id + '-row bg-blue-50 border-b border-blue-200 cursor-pointer" onclick="toggleGroup(\'' + l2Id + '\')"><td colspan="11" class="px-4 py-2 pl-8"><div class="flex items-center justify-between"><div class="flex items-center gap-2">';
            html += '<svg id="' + l2Id + '-icon" class="w-3.5 h-3.5 text-blue-500 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>';
            html += '<span class="font-semibold text-blue-700">' + escapeHtml(l2.key) + '</span>';
            html += '<span class="text-xs text-blue-500 ml-2">(' + l2.items.length + ')</span>';
            html += '</div><span class="text-xs text-blue-500">' + l2Days + ' days' + (l2Ongoing ? ' | ' + l2Ongoing + ' ongoing' : '') + '</span></div></td></tr>';

            // L3: Lighter Vessel
            var l3Groups = groupBy(l2.items, function(r) {
                return normalizeLighter(r);
            });

            l3Groups.forEach(function(l3) {
                var l3Id = l2Id + '-L3-' + l3.key.replace(/[^a-zA-Z0-9]/g, '_');
                var l3Days = l3.items.reduce(function(s, r) { return r.endDate ? s + (Number(r.totalDays) || 0) : s; }, 0);

                html += '<tr class="' + l1Id + '-row ' + l2Id + '-row bg-gray-50 border-b border-gray-200 cursor-pointer" onclick="toggleGroup(\'' + l3Id + '\')"><td colspan="11" class="px-4 py-2 pl-14"><div class="flex items-center justify-between"><div class="flex items-center gap-2">';
                html += '<svg id="' + l3Id + '-icon" class="w-3 h-3 text-gray-500 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>';
                html += '<span class="font-medium text-gray-700">Lighter: ' + escapeHtml(l3.key) + '</span>';
                html += '<span class="text-xs text-gray-500 ml-2">(' + l3.items.length + ' employee' + (l3.items.length !== 1 ? 's' : '') + ')</span>';
                html += '</div><span class="text-xs text-gray-500">' + l3Days + ' days</span></div></td></tr>';

                // Employee rows
                l3.items.forEach(function(record) {
                    var isOngoing = !record.endDate;
                    var badge = getStatusBadge(record);
                    html += '<tr class="' + l1Id + '-row ' + l2Id + '-row ' + l3Id + '-row border-b border-gray-200 hover:bg-gray-50">';
                    html += '<td class="px-4 py-3 text-sm text-gray-600">' + globalIndex + '</td>';
                    html += '<td class="px-4 py-3 text-sm text-gray-800">' + escapeHtml(record.employeeId || '') + ' — ' + escapeHtml(record.employeeName || '') + '</td>';
                    html += '<td class="px-4 py-3 text-sm text-gray-600">' + escapeHtml(record.clientName || '') + '</td>';
                    html += '<td class="px-4 py-3 text-sm text-gray-600">' + escapeHtml(record.vesselName || '') + '</td>';
                    html += '<td class="px-4 py-3 text-sm text-gray-600">' + escapeHtml(record.lighterVessel || record.lighterName || '') + '</td>';
                    html += '<td class="px-4 py-3 text-sm text-gray-600">' + escapeHtml(record.startDate || '') + ' ' + escapeHtml(record.startShift || '') + '</td>';
                    html += '<td class="px-4 py-3 text-sm text-gray-600">' + (isOngoing ? '<span class="text-blue-600 font-medium">Ongoing</span>' : escapeHtml(record.endDate || '') + ' ' + escapeHtml(record.endShift || '')) + '</td>';
                    html += '<td class="px-4 py-3 text-sm text-gray-800 font-medium">' + durationDisplay(record) + '</td>';
                    html += '<td class="px-4 py-3 text-sm text-gray-600">' + (record.conveyance || 0) + '</td>';
                    html += '<td class="px-4 py-3 text-sm"><span class="px-2 py-1 rounded-full text-xs ' + badge.cssClass + '">' + escapeHtml(badge.text) + '</span></td>';
                    html += '<td class="px-4 py-3 text-sm space-x-1"><button onclick="viewEscortRecord(\'' + record.id + '\')" class="text-blue-600 hover:text-blue-800">View</button> <button onclick="editEscortRecord(\'' + record.id + '\')" class="text-green-600 hover:text-green-800">Edit</button> <button onclick="deleteRecord(\'' + record.id + '\')" class="text-red-600 hover:text-red-800">Delete</button></td>';
                    html += '</tr>';
                    globalIndex++;
                });
            });
        });
    });

    tbody.innerHTML = html;
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
            <p><strong>Lighter:</strong> ${escapeHtml(record.lighterVessel || record.lighterName || '-')}</p>
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
    form.lighterName.value = record.lighterVessel || record.lighterName || '';
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
// DUAL SEARCH — EMPLOYEE & CLIENT
// ============================================

let _searchDebounceTimer = null;

/**
 * Initialize the dual search system (employee typeahead + client dropdown)
 * Called from DOMContentLoaded
 */
function initDualSearch() {
    // Employee search typeahead
    var empInput = document.getElementById('searchEmployeeInput');
    var empHidden = document.getElementById('searchEmployeeId');
    if (empInput) {
        var wrapper = empInput.parentElement;
        var dropdown = document.createElement('div');
        dropdown.id = 'searchEmployeeLookupDropdown';
        dropdown.style.cssText = 'display:none; position:absolute; top:100%; left:0; right:0; max-height:200px; overflow-y:auto; background:#fff; border:1px solid #d1d5db; border-top:none; border-radius:0 0 0.5rem 0.5rem; z-index:100; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);';
        wrapper.appendChild(dropdown);

        var selectedEmp = null;

        empInput.addEventListener('input', function() {
            selectedEmp = null;
            if (empHidden) empHidden.value = '';
            clearTimeout(_searchDebounceTimer);
            _searchDebounceTimer = setTimeout(async function() {
                var term = empInput.value.trim().toLowerCase();
                if (term.length < 1) { dropdown.style.display = 'none'; return; }

                var employees = await fetchLookupEmployees();
                var matches = employees.filter(function(emp) {
                    var name = (emp.name || '').toLowerCase();
                    var id = (emp.id || '').toString().toLowerCase();
                    var phone = (emp.phone || '').toString().toLowerCase();
                    return name.includes(term) || id.includes(term) || phone.includes(term);
                }).slice(0, 10);

                if (matches.length === 0) {
                    dropdown.innerHTML = '<div style="padding:8px 12px; color:#9ca3af; font-size:0.875rem;">No employees found</div>';
                    dropdown.style.display = 'block';
                    return;
                }

                dropdown.innerHTML = matches.map(function(emp, idx) {
                    return '<div class="search-emp-item" data-index="' + idx + '" style="padding:8px 12px; cursor:pointer; font-size:0.875rem; border-bottom:1px solid #f3f4f6;" onmouseenter="this.style.backgroundColor=\'#eff6ff\'" onmouseleave="this.style.backgroundColor=\'#fff\'"><div style="font-weight:500; color:#1f2937;">' + escapeHtml(emp.name || '') + '</div><div style="font-size:0.75rem; color:#6b7280;">ID: ' + escapeHtml(emp.phone || emp.id || '') + '</div></div>';
                }).join('');

                dropdown.querySelectorAll('.search-emp-item').forEach(function(item, idx) {
                    item.addEventListener('mousedown', function(e) {
                        e.preventDefault();
                        var emp = matches[idx];
                        selectedEmp = emp;
                        empInput.value = emp.name || '';
                        if (empHidden) empHidden.value = emp.id || emp.phone || '';
                        dropdown.style.display = 'none';
                        // Mutual exclusion: clear client search
                        var cs = document.getElementById('searchClientDropdown');
                        if (cs) cs.value = '';
                        executeEmployeeSearch(emp.id || emp.phone || '');
                    });
                });
                dropdown.style.display = 'block';
            }, 300);
        });

        empInput.addEventListener('blur', function() {
            setTimeout(function() { dropdown.style.display = 'none'; }, 200);
        });

        empInput.addEventListener('keydown', function(e) {
            var items = dropdown.querySelectorAll('.search-emp-item');
            if (items.length === 0) return;
            var activeIdx = -1;
            items.forEach(function(it, i) { if (it.style.backgroundColor === 'rgb(239, 246, 255)') activeIdx = i; });
            if (e.key === 'ArrowDown') { e.preventDefault(); var n = activeIdx < items.length - 1 ? activeIdx + 1 : 0; items.forEach(function(it) { it.style.backgroundColor = '#fff'; }); items[n].style.backgroundColor = '#eff6ff'; items[n].scrollIntoView({ block: 'nearest' }); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); var p = activeIdx > 0 ? activeIdx - 1 : items.length - 1; items.forEach(function(it) { it.style.backgroundColor = '#fff'; }); items[p].style.backgroundColor = '#eff6ff'; items[p].scrollIntoView({ block: 'nearest' }); }
            else if (e.key === 'Enter') { e.preventDefault(); if (activeIdx >= 0) items[activeIdx].dispatchEvent(new Event('mousedown')); }
            else if (e.key === 'Escape') { dropdown.style.display = 'none'; }
        });
    }

    // Client search dropdown
    var clientSelect = document.getElementById('searchClientDropdown');
    if (clientSelect) {
        // Populate with clients
        populateSearchClientDropdown();

        clientSelect.addEventListener('change', function() {
            var clientId = clientSelect.value;
            if (clientId) {
                // Mutual exclusion: clear employee search
                var ei = document.getElementById('searchEmployeeInput');
                var eh = document.getElementById('searchEmployeeId');
                if (ei) ei.value = '';
                if (eh) eh.value = '';
                executeClientSearch(clientId);
            }
        });
    }
}

/**
 * Populate search client dropdown (separate from form dropdown)
 */
async function populateSearchClientDropdown() {
    var select = document.getElementById('searchClientDropdown');
    if (!select) return;

    var clients = await fetchLookupClients();
    var activeClients = clients.filter(function(c) { return typeof isClientActive === 'function' ? isClientActive(c) : true; });

    select.innerHTML = '<option value="">-- Select Client --</option>';
    activeClients.forEach(function(c) {
        var displayName = typeof getClientDisplayName === 'function' ? getClientDisplayName(c) : (c.companyName || c.name || '');
        var opt = document.createElement('option');
        opt.value = c.id || '';
        opt.textContent = displayName;
        select.appendChild(opt);
    });
}

/**
 * Execute employee search: fetch all escort-duty records for this employee
 * @param {string} employeeId
 */
async function executeEmployeeSearch(employeeId) {
    if (!employeeId) return;
    showSearchLoading('Searching employee records...');

    try {
        var response = await request('getEscortDutyFiltered', { employeeId: employeeId });
        if (response.success && Array.isArray(response.data)) {
            renderEmployeeSearchResults(response.data);
        } else {
            showSearchEmpty('No escort duty records found for this employee.');
        }
    } catch (error) {
        console.error('Employee search failed:', error);
        showSearchEmpty('Failed to fetch employee records.');
    }
}

/**
 * Execute client search: fetch all escort-duty records for this client
 * @param {string} clientId
 */
async function executeClientSearch(clientId) {
    if (!clientId) return;
    showSearchLoading('Searching client records...');

    try {
        var response = await request('getEscortDutyFiltered', { clientId: clientId });
        if (response.success && Array.isArray(response.data)) {
            renderClientSearchResults(response.data);
            // Best-effort margin indicator (requires Analytics.canView)
            fetchMarginForClient(clientId, response.data);
        } else {
            showSearchEmpty('No escort duty records found for this client.');
        }
    } catch (error) {
        console.error('Client search failed:', error);
        showSearchEmpty('Failed to fetch client records.');
    }
}

/**
 * Show loading state in search results
 * @param {string} message
 */
function showSearchLoading(message) {
    var section = document.getElementById('searchResultsSection');
    var container = document.getElementById('searchResultsContainer');
    var title = document.getElementById('searchResultsTitle');
    if (section) section.classList.remove('hidden');
    if (title) title.textContent = 'Search Results';
    if (container) container.innerHTML = '<div class="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500"><div class="animate-pulse">' + escapeHtml(message) + '</div></div>';
}

/**
 * Show empty state in search results
 * @param {string} message
 */
function showSearchEmpty(message) {
    var section = document.getElementById('searchResultsSection');
    var container = document.getElementById('searchResultsContainer');
    if (section) section.classList.remove('hidden');
    if (container) container.innerHTML = '<div class="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">' + escapeHtml(message) + '</div>';
}

/**
 * Clear search results and inputs
 */
function clearSearchResults() {
    var section = document.getElementById('searchResultsSection');
    var container = document.getElementById('searchResultsContainer');
    if (section) section.classList.add('hidden');
    if (container) container.innerHTML = '';

    // Flush margin cache on clear so fresh data is fetched next search
    marginCache.clear();

    var empInput = document.getElementById('searchEmployeeInput');
    var empHidden = document.getElementById('searchEmployeeId');
    if (empInput) empInput.value = '';
    if (empHidden) empHidden.value = '';

    var clientSelect = document.getElementById('searchClientDropdown');
    if (clientSelect) clientSelect.value = '';
}

/**
 * Render employee search results grouped by:
 *   Employee Name → Client → Vessel → Lighter → Date Range
 * @param {Array} records
 */
function renderEmployeeSearchResults(records) {
    var section = document.getElementById('searchResultsSection');
    var container = document.getElementById('searchResultsContainer');
    var title = document.getElementById('searchResultsTitle');
    if (!container) return;
    if (section) section.classList.remove('hidden');

    if (!records || records.length === 0) {
        container.innerHTML = '<div class="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">No records found.</div>';
        return;
    }

    if (title) title.textContent = 'Employee Search Results (' + records.length + ' records)';

    // Sort for predictable accordion order
    records = sortEscortForGrouping(records);

    // Group: Employee → Client → Vessel → Lighter
    var empGroups = groupByMap(records, function(r) { return (r.employeeName || 'Unknown') + (r.employeeId ? ' (' + r.employeeId + ')' : ''); });
    var html = '';
    var accordionIdx = 0;

    empGroups.forEach(function(empGroup) {
        var empKey = empGroup.key;
        var empId = 'search-emp-' + (accordionIdx++);

        html += buildAccordionHeader(empId, empKey, empGroup.items.length + ' record(s)', 'bg-indigo-50 border-indigo-200', 'text-indigo-800', 'text-indigo-600');

        var clientGroups = groupByMap(empGroup.items, function(r) { return r.clientName || 'Unknown Client'; });
        var innerHtml = '';

        clientGroups.forEach(function(cg) {
            var cgId = empId + '-c' + (accordionIdx++);
            innerHtml += buildAccordionHeader(cgId, cg.key, cg.items.length + ' record(s)', 'bg-blue-50 border-blue-200 ml-4', 'text-blue-800', 'text-blue-600');

            var vesselGroups = groupByMap(cg.items, function(r) { return r.vesselName || 'Unknown Vessel'; });
            var vesselHtml = '';

            vesselGroups.forEach(function(vg) {
                var vgId = cgId + '-v' + (accordionIdx++);
                vesselHtml += buildAccordionHeader(vgId, vg.key, vg.items.length + ' record(s)', 'bg-gray-50 border-gray-200 ml-8', 'text-gray-800', 'text-gray-500');

                var lighterGroups = groupByMap(vg.items, function(r) { return normalizeLighter(r); });
                var lighterHtml = '';

                lighterGroups.forEach(function(lg) {
                    var lgId = vgId + '-l' + (accordionIdx++);
                    lighterHtml += buildAccordionHeader(lgId, 'Lighter: ' + lg.key, lg.items.length + ' entry(ies)', 'bg-white border-gray-100 ml-12', 'text-gray-700', 'text-gray-400');

                    var recordsHtml = '<div id="' + lgId + '-body" class="ml-12">';
                    lg.items.forEach(function(r) {
                        var badge = getStatusBadge(r);
                        var isOngoing = !r.endDate;
                        recordsHtml += '<div class="bg-white border border-gray-100 rounded-lg p-3 mb-1 text-sm">';
                        recordsHtml += '<div class="grid grid-cols-2 md:grid-cols-4 gap-2">';
                        recordsHtml += '<div><span class="text-gray-500">Start:</span> ' + escapeHtml(r.startDate || '') + ' ' + escapeHtml(r.startShift || '') + '</div>';
                        recordsHtml += '<div><span class="text-gray-500">End:</span> ' + (isOngoing ? '<span class="text-blue-600 font-medium">Ongoing</span>' : escapeHtml(r.endDate || '') + ' ' + escapeHtml(r.endShift || '')) + '</div>';
                        recordsHtml += '<div><span class="text-gray-500">Total Days:</span> ' + durationDisplay(r) + '</div>';
                        recordsHtml += '<div><span class="text-gray-500">Rate:</span> ' + (r.rateSnapshot || 0) + '</div>';
                        recordsHtml += '<div><span class="text-gray-500">Conveyance:</span> ' + (r.conveyance || 0) + '</div>';
                        recordsHtml += '<div><span class="text-gray-500">Status:</span> <span class="px-1.5 py-0.5 rounded-full text-xs ' + badge.cssClass + '">' + escapeHtml(badge.text) + '</span></div>';
                        recordsHtml += '<div><span class="text-gray-500">Created:</span> ' + escapeHtml(r.createdAt || '') + '</div>';
                        recordsHtml += '</div></div>';
                    });
                    recordsHtml += '</div>';
                    lighterHtml += recordsHtml;
                });
                vesselHtml += '<div id="' + vgId + '-body">' + lighterHtml + '</div>';
            });
            innerHtml += '<div id="' + cgId + '-body">' + vesselHtml + '</div>';
        });
        html += '<div id="' + empId + '-body">' + innerHtml + '</div>';
    });

    container.innerHTML = html;
}

/**
 * Render client search results grouped by:
 *   Client → Vessel → Lighter → Employee Name → Date Range
 * @param {Array} records
 */
function renderClientSearchResults(records) {
    var section = document.getElementById('searchResultsSection');
    var container = document.getElementById('searchResultsContainer');
    var title = document.getElementById('searchResultsTitle');
    if (!container) return;
    if (section) section.classList.remove('hidden');

    if (!records || records.length === 0) {
        container.innerHTML = '<div class="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">No records found.</div>';
        return;
    }

    if (title) title.textContent = 'Client Search Results (' + records.length + ' records)';

    // Sort for predictable accordion order
    records = sortEscortForGrouping(records);

    var clientGroups = groupByMap(records, function(r) { return r.clientName || 'Unknown Client'; });
    var html = '';
    var accordionIdx = 0;

    clientGroups.forEach(function(cg) {
        var cgId = 'search-cli-' + (accordionIdx++);
        // Build client header with margin placeholder
        var clientHeader = '<div id="' + cgId + '-header" class="bg-blue-50 border-blue-200 border rounded-lg px-4 py-2 mb-1 cursor-pointer" onclick="toggleSearchAccordion(\'' + cgId + '\')">' +
            '<div class="flex items-center justify-between">' +
            '<div class="flex items-center gap-2">' +
            '<svg id="' + cgId + '-chevron" class="w-4 h-4 text-blue-600 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>' +
            '<span class="font-semibold text-sm text-blue-800">' + escapeHtml(cg.key) + '</span>' +
            '</div>' +
            '<div class="flex items-center gap-3">' +
            '<span id="' + cgId + '-margin" class="text-xs"></span>' +
            '<span class="text-xs text-blue-600">' + escapeHtml(cg.items.length + ' record(s)') + '</span>' +
            '</div>' +
            '</div></div>';
        html += clientHeader;

        var vesselGroups = groupByMap(cg.items, function(r) { return r.vesselName || 'Unknown Vessel'; });
        var innerHtml = '';

        vesselGroups.forEach(function(vg) {
            var vgId = cgId + '-v' + (accordionIdx++);
            innerHtml += buildAccordionHeader(vgId, vg.key, vg.items.length + ' record(s)', 'bg-gray-50 border-gray-200 ml-4', 'text-gray-800', 'text-gray-500');

            var lighterGroups = groupByMap(vg.items, function(r) { return normalizeLighter(r); });
            var vesselHtml = '';

            lighterGroups.forEach(function(lg) {
                var lgId = vgId + '-l' + (accordionIdx++);
                vesselHtml += buildAccordionHeader(lgId, 'Lighter: ' + lg.key, lg.items.length + ' employee(s)', 'bg-white border-gray-100 ml-8', 'text-gray-700', 'text-gray-400');

                var empGroups = groupByMap(lg.items, function(r) { return (r.employeeName || 'Unknown') + (r.employeeId ? ' (' + r.employeeId + ')' : ''); });
                var lighterHtml = '';

                empGroups.forEach(function(eg) {
                    var egId = lgId + '-e' + (accordionIdx++);
                    lighterHtml += buildAccordionHeader(egId, eg.key, eg.items.length + ' entry(ies)', 'bg-white border-gray-100 ml-12', 'text-gray-700', 'text-gray-400');

                    var recordsHtml = '<div id="' + egId + '-body" class="ml-12">';
                    eg.items.forEach(function(r) {
                        var badge = getStatusBadge(r);
                        var isOngoing = !r.endDate;
                        recordsHtml += '<div class="bg-white border border-gray-100 rounded-lg p-3 mb-1 text-sm">';
                        recordsHtml += '<div class="grid grid-cols-2 md:grid-cols-4 gap-2">';
                        recordsHtml += '<div><span class="text-gray-500">Employee:</span> ' + escapeHtml(r.employeeId || '') + ' — ' + escapeHtml(r.employeeName || '') + '</div>';
                        recordsHtml += '<div><span class="text-gray-500">Start:</span> ' + escapeHtml(r.startDate || '') + ' ' + escapeHtml(r.startShift || '') + '</div>';
                        recordsHtml += '<div><span class="text-gray-500">End:</span> ' + (isOngoing ? '<span class="text-blue-600 font-medium">Ongoing</span>' : escapeHtml(r.endDate || '') + ' ' + escapeHtml(r.endShift || '')) + '</div>';
                        recordsHtml += '<div><span class="text-gray-500">Total Days:</span> ' + durationDisplay(r) + '</div>';
                        recordsHtml += '<div><span class="text-gray-500">Status:</span> <span class="px-1.5 py-0.5 rounded-full text-xs ' + badge.cssClass + '">' + escapeHtml(badge.text) + '</span></div>';
                        recordsHtml += '<div><span class="text-gray-500">Conveyance:</span> ' + (r.conveyance || 0) + '</div>';
                        recordsHtml += '<div><span class="text-gray-500">Rate:</span> ' + (r.rateSnapshot || 0) + '</div>';
                        recordsHtml += '</div></div>';
                    });
                    recordsHtml += '</div>';
                    lighterHtml += recordsHtml;
                });
                vesselHtml += '<div id="' + lgId + '-body">' + lighterHtml + '</div>';
            });
            innerHtml += '<div id="' + vgId + '-body">' + vesselHtml + '</div>';
        });
        html += '<div id="' + cgId + '-body">' + innerHtml + '</div>';
    });

    container.innerHTML = html;
}

/**
 * Fetch margin analytics for a client and inject into the search results header.
 * Best-effort: silently skips if user lacks Analytics.canView permission.
 * Uses the date span of the escort records to set the margin period.
 * @param {string} clientId
 * @param {Array} records - escort records already fetched
 */
async function fetchMarginForClient(clientId, records) {
    try {
        // ── Cache check — avoid repeated GAS calls ──
        var marginData;
        if (marginCache.has(clientId)) {
            marginData = marginCache.get(clientId);
        } else {
            // Build distinct, non-overlapping date ranges from each escort program
            // to avoid including gap months (e.g. Feb when only Jan + Mar had duty).
            var ranges = [];
            (records || []).forEach(function(r) {
                if (!r.startDate) return;
                var end = r.endDate || new Date().toISOString().substring(0, 10); // ongoing → today
                ranges.push({ start: r.startDate, end: end });
            });
            if (ranges.length === 0) return;

            // Sort & merge overlapping ranges to minimise API calls
            ranges.sort(function(a, b) { return a.start.localeCompare(b.start); });
            var merged = [ranges[0]];
            for (var i = 1; i < ranges.length; i++) {
                var last = merged[merged.length - 1];
                if (ranges[i].start <= last.end) {
                    // overlapping — extend
                    if (ranges[i].end > last.end) last.end = ranges[i].end;
                } else {
                    merged.push({ start: ranges[i].start, end: ranges[i].end });
                }
            }

            // Fetch margin for each merged range (usually 1–2 calls)
            var totalRevenue = 0;
            var totalCost = 0;
            for (var mi = 0; mi < merged.length; mi++) {
                var resp = await request('getMarginAnalytics', {
                    periodStart: merged[mi].start,
                    periodEnd: merged[mi].end,
                    clientId: clientId
                });
                if (resp && resp.success && resp.data && resp.data.byClient) {
                    resp.data.byClient.forEach(function(c) {
                        totalRevenue += c.revenue || 0;
                        totalCost += c.cost || 0;
                    });
                }
            }

            marginData = { revenue: totalRevenue, cost: totalCost };
            marginCache.set(clientId, marginData);
        }

        if (marginData.revenue === 0 && marginData.cost === 0) return;

        var margin = marginData.revenue - marginData.cost;
        var marginPct = marginData.revenue > 0 ? ((margin / marginData.revenue) * 100).toFixed(1) : '0.0';
        var isNeg = margin < 0;

        // Inject into all client-level margin placeholders
        var placeholders = document.querySelectorAll('[id^="search-cli-"][id$="-margin"]');
        placeholders.forEach(function(el) {
            var colorClass = isNeg ? 'text-red-700 bg-red-50' : 'text-emerald-700 bg-emerald-50';
            el.innerHTML = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded ' + colorClass + '">' +
                '<span>Rev: ' + formatCurrency(marginData.revenue) + '</span>' +
                '<span class="mx-0.5">|</span>' +
                '<span>Cost: ' + formatCurrency(marginData.cost) + '</span>' +
                '<span class="mx-0.5">|</span>' +
                '<span class="font-semibold">Margin: ' + marginPct + '%</span>' +
                '</span>';
        });
    } catch (e) {
        // Silently ignore — user may lack Analytics permission
        console.debug('Margin fetch skipped:', e.message || e);
    }
}

/**
 * Format a number as currency (compact).
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
    if (typeof amount !== 'number') amount = Number(amount) || 0;
    if (Math.abs(amount) >= 1000000) {
        return '৳' + (amount / 1000000).toFixed(1) + 'M';
    }
    if (Math.abs(amount) >= 1000) {
        return '৳' + (amount / 1000).toFixed(1) + 'K';
    }
    return '৳' + amount.toFixed(0);
}

/**
 * Build an accordion header HTML string
 * @param {string} id - Unique accordion group identifier
 * @param {string} label - Display text
 * @param {string} badge - Small info badge (e.g. record count)
 * @param {string} bgClass - Background CSS classes
 * @param {string} textClass - Text CSS class for label
 * @param {string} badgeClass - Text CSS class for badge
 * @returns {string} HTML
 */
function buildAccordionHeader(id, label, badge, bgClass, textClass, badgeClass) {
    return '<div id="' + id + '-header" class="' + bgClass + ' border rounded-lg px-4 py-2 mb-1 cursor-pointer flex items-center justify-between" onclick="toggleSearchAccordion(\'' + id + '\')">' +
        '<div class="flex items-center gap-2">' +
        '<svg id="' + id + '-chevron" class="w-4 h-4 ' + badgeClass + ' transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>' +
        '<span class="font-semibold text-sm ' + textClass + '">' + escapeHtml(label) + '</span>' +
        '</div>' +
        '<span class="text-xs ' + badgeClass + '">' + escapeHtml(badge) + '</span>' +
        '</div>';
}

/**
 * Toggle a search accordion section
 * @param {string} id - Section identifier
 */
function toggleSearchAccordion(id) {
    var body = document.getElementById(id + '-body');
    var chevron = document.getElementById(id + '-chevron');
    if (!body) return;
    var isHidden = body.style.display === 'none';
    body.style.display = isHidden ? '' : 'none';
    if (chevron) chevron.style.transform = isHidden ? '' : 'rotate(-90deg)';
}

/**
 * Group records by key function using Map for stable insertion order.
 * Returns array of { key, items }.
 * @param {Array} records
 * @param {Function} keyFn
 * @returns {Array<{key: string, items: Array}>}
 */
function groupByMap(records, keyFn) {
    var map = new Map();
    (records || []).forEach(function(r) {
        var key = keyFn(r);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(r);
    });
    var result = [];
    map.forEach(function(items, key) { result.push({ key: key, items: items }); });
    return result;
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
    
    // Initialize dual search (employee typeahead + client dropdown)
    initDualSearch();
    
    // Set initial date range inputs
    const startInput = document.getElementById('filterStartDate');
    const endInput = document.getElementById('filterEndDate');
    
    if (startInput) startInput.value = currentRange.startDate;
    if (endInput) endInput.value = currentRange.endDate;
    
    // Initial data load
    await refreshEscortDuty(currentRange);
});
