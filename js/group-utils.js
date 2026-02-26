/**
 * Group Utilities - shared helpers for grouped list views
 * Used by guard-duty.js, escort-duty.js, day-labor.js
 *
 * Provides: groupBy, normalizeGroupKey, renderGroupedTable,
 *           renderTwoLevelGroupedTable, toggleGroup, toggleAllGroups
 */

// ============================================
// GROUPING HELPERS
// ============================================

/**
 * Group an array of records by a key function.
 * @param {Array} records - Array of objects
 * @param {Function} keyFn - (record) => string groupKey
 * @returns {Array} [ { key, items } ] (insertion order preserved)
 */
function groupBy(records, keyFn) {
    var groups = {};
    var order = [];
    (records || []).forEach(function(r) {
        var key = keyFn(r);
        if (!groups[key]) {
            groups[key] = [];
            order.push(key);
        }
        groups[key].push(r);
    });
    return order.map(function(k) { return { key: k, items: groups[k] }; });
}

/**
 * Normalize a group key - blank/null becomes "General"
 * @param {string} value
 * @returns {string}
 */
function normalizeGroupKey(value) {
    var v = String(value || '').trim();
    return v || 'General';
}

// ============================================
// SINGLE-LEVEL GROUPED TABLE RENDERER
// ============================================

/**
 * Render a grouped table into a tbody element.
 *
 * @param {Object} opts
 * @param {string}   opts.tbodyId        - DOM id of the <tbody>
 * @param {string}   opts.paginationId   - DOM id of the pagination container (cleared when grouped)
 * @param {Array}    opts.data           - full data set
 * @param {Function} opts.groupKeyFn     - (record) => string group key
 * @param {Function} opts.renderRowFn    - (record, index) => HTML string for <td>s
 * @param {number}   opts.colSpan        - number of columns in the table
 * @param {string}   [opts.emptyMessage] - message when data is empty
 * @param {string}   [opts.emptyIcon]    - FontAwesome icon class for empty state
 * @param {Function} [opts.groupSummaryFn] - (key, items) => HTML string placed inside a summary <tr>
 */
function renderGroupedTable(opts) {
    var tbody = document.getElementById(opts.tbodyId);
    if (!tbody) return;

    var pagEl = document.getElementById(opts.paginationId);
    if (pagEl) pagEl.innerHTML = '';

    var data = opts.data || [];

    if (data.length === 0) {
        if (typeof showEmptyState === 'function') {
            showEmptyState(opts.tbodyId, opts.emptyMessage || 'No records found.', opts.colSpan, opts.emptyIcon || 'fa-list');
        } else {
            tbody.innerHTML = '<tr><td colspan="' + opts.colSpan + '" class="px-4 py-8 text-center text-gray-500">' + (opts.emptyMessage || 'No records found.') + '</td></tr>';
        }
        return;
    }

    var groups = groupBy(data, opts.groupKeyFn);
    var html = '';
    var globalIndex = 1;

    groups.forEach(function(g) {
        var groupId = 'grp-' + opts.tbodyId + '-' + g.key.replace(/[^a-zA-Z0-9]/g, '_');

        // Group header row
        html += '<tr class="bg-blue-50 border-b-2 border-blue-200 cursor-pointer" onclick="toggleGroup(\'' + groupId + '\')">';
        html += '<td colspan="' + opts.colSpan + '" class="px-4 py-3">';
        html += '<div class="flex items-center justify-between">';
        html += '<div class="flex items-center gap-2">';
        html += '<svg id="' + groupId + '-icon" class="w-4 h-4 text-blue-600 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>';
        html += '<span class="font-semibold text-blue-800">' + escapeHtmlGroup(g.key) + '</span>';
        html += '<span class="text-sm text-blue-600 ml-2">(' + g.items.length + ' record' + (g.items.length !== 1 ? 's' : '') + ')</span>';
        html += '</div>';
        if (opts.groupSummaryFn) {
            html += '<span class="text-xs text-blue-600">' + opts.groupSummaryFn(g.key, g.items) + '</span>';
        }
        html += '</div></td></tr>';

        // Data rows (expanded by default)
        g.items.forEach(function(record) {
            html += '<tr class="' + groupId + '-row border-b border-gray-200 hover:bg-gray-50">';
            html += opts.renderRowFn(record, globalIndex);
            html += '</tr>';
            globalIndex++;
        });
    });

    tbody.innerHTML = html;
}

// ============================================
// TWO-LEVEL GROUPED TABLE RENDERER
// ============================================

/**
 * Render a two-level grouped table: L1 (outer) -> L2 (inner) -> rows.
 *
 * @param {Object} opts
 * @param {string}   opts.tbodyId        - DOM id of the <tbody>
 * @param {string}   opts.paginationId   - DOM id of the pagination container (cleared)
 * @param {Array}    opts.data           - full data set
 * @param {Function} opts.l1KeyFn        - (record) => string L1 group key
 * @param {Function} opts.l2KeyFn        - (record) => string L2 group key
 * @param {Function} opts.renderRowFn    - (record, index) => HTML <td>s
 * @param {number}   opts.colSpan        - number of columns
 * @param {string}   [opts.emptyMessage]
 * @param {Function} [opts.l1SummaryFn]  - (key, items) => summary text for L1 header
 * @param {Function} [opts.l2SummaryFn]  - (key, items) => summary text for L2 header
 */
function renderTwoLevelGroupedTable(opts) {
    var tbody = document.getElementById(opts.tbodyId);
    if (!tbody) return;

    var pagEl = document.getElementById(opts.paginationId);
    if (pagEl) pagEl.innerHTML = '';

    var data = opts.data || [];

    if (data.length === 0) {
        if (typeof showEmptyState === 'function') {
            showEmptyState(opts.tbodyId, opts.emptyMessage || 'No records found.', opts.colSpan, 'fa-list');
        } else {
            tbody.innerHTML = '<tr><td colspan="' + opts.colSpan + '" class="px-4 py-8 text-center text-gray-500">' + (opts.emptyMessage || 'No records found.') + '</td></tr>';
        }
        return;
    }

    // L1 grouping
    var l1Groups = groupBy(data, opts.l1KeyFn);
    var html = '';
    var globalIndex = 1;

    l1Groups.forEach(function(l1) {
        var l1Id = 'grp-' + opts.tbodyId + '-L1-' + l1.key.replace(/[^a-zA-Z0-9]/g, '_');

        // L1 header (darker blue)
        html += '<tr class="bg-blue-100 border-b-2 border-blue-300 cursor-pointer" onclick="toggleGroup(\'' + l1Id + '\')">';
        html += '<td colspan="' + opts.colSpan + '" class="px-4 py-3">';
        html += '<div class="flex items-center justify-between">';
        html += '<div class="flex items-center gap-2">';
        html += '<svg id="' + l1Id + '-icon" class="w-4 h-4 text-blue-700 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>';
        html += '<span class="font-bold text-blue-900">' + escapeHtmlGroup(l1.key) + '</span>';
        html += '<span class="text-sm text-blue-700 ml-2">(' + l1.items.length + ' record' + (l1.items.length !== 1 ? 's' : '') + ')</span>';
        html += '</div>';
        if (opts.l1SummaryFn) {
            html += '<span class="text-xs text-blue-700">' + opts.l1SummaryFn(l1.key, l1.items) + '</span>';
        }
        html += '</div></td></tr>';

        // L2 sub-groups within this L1 group
        var l2Groups = groupBy(l1.items, opts.l2KeyFn);
        l2Groups.forEach(function(l2) {
            var l2Id = l1Id + '-L2-' + l2.key.replace(/[^a-zA-Z0-9]/g, '_');

            // L2 header (lighter blue, indented)
            html += '<tr class="' + l1Id + '-row bg-blue-50 border-b border-blue-200 cursor-pointer" onclick="toggleGroup(\'' + l2Id + '\')">';
            html += '<td colspan="' + opts.colSpan + '" class="px-4 py-2 pl-8">';
            html += '<div class="flex items-center justify-between">';
            html += '<div class="flex items-center gap-2">';
            html += '<svg id="' + l2Id + '-icon" class="w-3 h-3 text-blue-500 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>';
            html += '<span class="font-semibold text-blue-700">' + escapeHtmlGroup(l2.key) + '</span>';
            html += '<span class="text-xs text-blue-500 ml-2">(' + l2.items.length + ')</span>';
            html += '</div>';
            if (opts.l2SummaryFn) {
                html += '<span class="text-xs text-blue-500">' + opts.l2SummaryFn(l2.key, l2.items) + '</span>';
            }
            html += '</div></td></tr>';

            // Data rows (belong to both L1 and L2 groups)
            l2.items.forEach(function(record) {
                html += '<tr class="' + l1Id + '-row ' + l2Id + '-row border-b border-gray-200 hover:bg-gray-50">';
                html += opts.renderRowFn(record, globalIndex);
                html += '</tr>';
                globalIndex++;
            });
        });
    });

    tbody.innerHTML = html;
}

// ============================================
// TOGGLE HELPERS
// ============================================

/**
 * Toggle visibility of a group's rows
 * @param {string} groupId - group identifier
 */
function toggleGroup(groupId) {
    var rows = document.querySelectorAll('.' + groupId + '-row');
    var icon = document.getElementById(groupId + '-icon');
    if (!rows.length) return;

    var isHidden = rows[0].style.display === 'none';
    rows.forEach(function(r) { r.style.display = isHidden ? '' : 'none'; });
    if (icon) icon.style.transform = isHidden ? '' : 'rotate(-90deg)';
}

/**
 * Toggle all groups in a given tbody
 * @param {string} tbodyId
 * @param {boolean} expand - true to expand, false to collapse
 */
function toggleAllGroups(tbodyId, expand) {
    var tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    var headers = tbody.querySelectorAll('tr[onclick^="toggleGroup"]');
    headers.forEach(function(header) {
        var onclick = header.getAttribute('onclick');
        var match = onclick.match(/toggleGroup\('([^']+)'\)/);
        if (!match) return;
        var groupId = match[1];
        var rows = document.querySelectorAll('.' + groupId + '-row');
        var icon = document.getElementById(groupId + '-icon');
        if (rows.length) {
            rows.forEach(function(r) { r.style.display = expand ? '' : 'none'; });
        }
        if (icon) icon.style.transform = expand ? '' : 'rotate(-90deg)';
    });
}

/**
 * Escape HTML for group display
 * @param {string} str
 * @returns {string}
 */
function escapeHtmlGroup(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
