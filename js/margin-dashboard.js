// Margin Analytics Dashboard Module
// READ-ONLY — No mutations. Calls getMarginAnalytics backend action.
// Role-based display: Operations sees no margin %, Viewer has no access.

// ============================================
// STATE
// ============================================
let marginData = null;          // last response.data
let clientSortKey = 'margin';
let clientSortAsc = true;

// Pagination for invoice table
let invPaginationState = null;
let invFilteredData = [];

// ============================================
// INIT
// ============================================

function initMarginDashboard() {
    // Default period: current month
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    document.getElementById('periodStart').value = y + '-' + m + '-01';

    // Last day of month
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    document.getElementById('periodEnd').value = y + '-' + m + '-' + String(lastDay).padStart(2, '0');

    // Init pagination
    if (typeof createPaginationState === 'function') {
        invPaginationState = createPaginationState(10);
    }

    // Check role for export visibility and margin % column
    applyRoleRestrictions();
}

function applyRoleRestrictions() {
    const user = getSessionUser ? getSessionUser() : null;
    const role = user ? user.role : '';

    // Export button: Admin + Finance only
    const btnExport = document.getElementById('btnExport');
    if (btnExport) {
        btnExport.style.display = (role === 'Admin' || role === 'Finance') ? '' : 'none';
    }
}

// ============================================
// LOAD ANALYTICS
// ============================================

async function loadAnalytics() {
    const periodStart = document.getElementById('periodStart').value;
    const periodEnd = document.getElementById('periodEnd').value;
    const clientId = document.getElementById('filterClientId').value.trim();

    if (!periodStart || !periodEnd) {
        if (typeof showToast === 'function') showToast('Select period start and end dates', 'error');
        return;
    }

    // Show loading
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('kpiSection').classList.add('hidden');
    document.getElementById('clientSection').classList.add('hidden');
    document.getElementById('dutyTypeSection').classList.add('hidden');
    document.getElementById('invoiceSection').classList.add('hidden');

    try {
        const payload = { periodStart: periodStart, periodEnd: periodEnd };
        if (clientId) payload.clientId = clientId;

        const response = await request('getMarginAnalytics', payload);

        if (!response.success) {
            if (typeof showToast === 'function') showToast(response.message || 'Failed to load analytics', 'error');
            document.getElementById('emptyState').classList.remove('hidden');
            return;
        }

        marginData = response.data;
        renderDashboard();

    } catch (error) {
        console.error('Margin analytics error:', error);
        if (typeof showToast === 'function') showToast('Failed to load analytics', 'error');
        document.getElementById('emptyState').classList.remove('hidden');
    }
}

function resetPeriod() {
    initMarginDashboard();
    document.getElementById('filterClientId').value = '';
    marginData = null;
    document.getElementById('kpiSection').classList.add('hidden');
    document.getElementById('clientSection').classList.add('hidden');
    document.getElementById('dutyTypeSection').classList.add('hidden');
    document.getElementById('invoiceSection').classList.add('hidden');
    document.getElementById('emptyState').classList.remove('hidden');
}

// ============================================
// RENDER
// ============================================

function renderDashboard() {
    if (!marginData) return;

    const restricted = marginData.restrictedView;

    renderKPIs(restricted);
    renderClientTable(restricted);
    renderDutyTypeCards(restricted);
    renderInvoiceTable(restricted);

    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('kpiSection').classList.remove('hidden');
    document.getElementById('clientSection').classList.remove('hidden');
    document.getElementById('dutyTypeSection').classList.remove('hidden');
    document.getElementById('invoiceSection').classList.remove('hidden');

    applyRoleRestrictions();
}

// ── KPI Cards ────────────────────────────────

function renderKPIs(restricted) {
    const s = marginData.summary;
    document.getElementById('kpiRevenue').textContent = formatCurrency(s.totalRevenue);
    document.getElementById('kpiCost').textContent = formatCurrency(s.totalCost);

    const marginEl = document.getElementById('kpiMargin');
    marginEl.textContent = formatCurrency(s.totalMargin);
    marginEl.className = 'text-2xl font-bold mt-1 ' + (s.totalMargin < 0 ? 'text-red-600' : 'text-green-700');

    const pctCard = document.getElementById('kpiMarginPctCard');
    const pctEl = document.getElementById('kpiMarginPct');
    if (restricted) {
        pctCard.classList.add('hidden');
    } else {
        pctCard.classList.remove('hidden');
        pctEl.textContent = s.marginPercent != null ? s.marginPercent.toFixed(2) + '%' : '-';
    }
}

// ── Client Profitability Table ───────────────

function renderClientTable(restricted) {
    // Hide margin % column for Operations
    const colPct = document.getElementById('colMarginPct');
    if (colPct) colPct.style.display = restricted ? 'none' : '';

    const rows = getSortedClients();
    const tbody = document.getElementById('clientTableBody');
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">No client data</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map(function(c) {
        const marginClass = c.margin < 0 ? 'text-red-600 font-semibold' : 'text-green-700';
        const badge = c.negativeMargin
            ? '<span class="inline-block px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">Loss</span>'
            : '<span class="inline-block px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">Profit</span>';

        return '<tr class="hover:bg-gray-50">' +
            '<td class="px-4 py-3 text-sm text-gray-800">' + escapeHtml(c.clientName || c.clientId) + '</td>' +
            '<td class="px-4 py-3 text-sm text-right text-gray-800">' + formatCurrency(c.revenue) + '</td>' +
            '<td class="px-4 py-3 text-sm text-right text-gray-800">' + formatCurrency(c.cost) + '</td>' +
            '<td class="px-4 py-3 text-sm text-right ' + marginClass + '">' + formatCurrency(c.margin) + '</td>' +
            (restricted ? '' : '<td class="px-4 py-3 text-sm text-right text-gray-700">' + (c.marginPercent != null ? c.marginPercent.toFixed(2) + '%' : '-') + '</td>') +
            '<td class="px-4 py-3 text-center">' + badge + '</td>' +
            '</tr>';
    }).join('');
}

function getSortedClients() {
    if (!marginData || !marginData.byClient) return [];
    var arr = marginData.byClient.slice();
    arr.sort(function(a, b) {
        var va = a[clientSortKey], vb = b[clientSortKey];
        if (typeof va === 'string') {
            va = va.toLowerCase();
            vb = (vb || '').toLowerCase();
        }
        if (va < vb) return clientSortAsc ? -1 : 1;
        if (va > vb) return clientSortAsc ? 1 : -1;
        return 0;
    });
    return arr;
}

function sortClientTable(key) {
    if (clientSortKey === key) {
        clientSortAsc = !clientSortAsc;
    } else {
        clientSortKey = key;
        clientSortAsc = key === 'clientName'; // alpha ascending, numbers descending by default
    }
    renderClientTable(marginData ? marginData.restrictedView : false);
}

// ── Duty-Type Cards ──────────────────────────

function renderDutyTypeCards(restricted) {
    const container = document.getElementById('dutyTypeCards');
    const items = marginData.byDutyType || [];

    if (items.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-sm col-span-3">No duty-type data</p>';
        return;
    }

    container.innerHTML = items.map(function(dt) {
        const marginClass = dt.margin < 0 ? 'text-red-600' : 'text-green-700';
        const iconMap = { Guard: 'fa-shield-alt', Escort: 'fa-car', DayLabor: 'fa-hard-hat' };
        const icon = iconMap[dt.dutyType] || 'fa-briefcase';

        return '<div class="bg-white rounded-lg shadow-sm p-5">' +
            '<div class="flex items-center gap-2 mb-3">' +
            '<i class="fas ' + icon + ' text-blue-600"></i>' +
            '<span class="font-semibold text-gray-800">' + escapeHtml(dt.dutyType) + '</span>' +
            '</div>' +
            '<div class="space-y-2 text-sm">' +
            '<div class="flex justify-between"><span class="text-gray-500">Revenue</span><span class="text-gray-800 font-medium">' + formatCurrency(dt.revenue) + '</span></div>' +
            '<div class="flex justify-between"><span class="text-gray-500">Cost</span><span class="text-gray-800 font-medium">' + formatCurrency(dt.cost) + '</span></div>' +
            '<div class="flex justify-between border-t pt-2"><span class="text-gray-500">Margin</span><span class="font-bold ' + marginClass + '">' + formatCurrency(dt.margin) + '</span></div>' +
            '</div></div>';
    }).join('');
}

// ── Invoice Detail Table ─────────────────────

function renderInvoiceTable(restricted) {
    const colPct = document.getElementById('colInvMarginPct');
    if (colPct) colPct.style.display = restricted ? 'none' : '';

    invFilteredData = marginData.byInvoice || [];

    if (invPaginationState) {
        invPaginationState.currentPage = 1;
    }

    renderInvoicePage(restricted);
}

function renderInvoicePage(restricted) {
    const tbody = document.getElementById('invoiceTableBody');

    if (invFilteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-400">No invoice data</td></tr>';
        return;
    }

    // Simple pagination
    const pageSize = invPaginationState ? invPaginationState.pageSize : 10;
    const page = invPaginationState ? invPaginationState.currentPage : 1;
    const startIdx = (page - 1) * pageSize;
    const pageData = invFilteredData.slice(startIdx, startIdx + pageSize);

    tbody.innerHTML = pageData.map(function(inv) {
        const marginClass = inv.negativeMargin ? 'text-red-600 font-semibold' : 'text-green-700';
        const statusBadge = inv.status === 'Paid'
            ? '<span class="inline-block px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">' + inv.status + '</span>'
            : '<span class="inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">' + inv.status + '</span>';

        return '<tr class="hover:bg-gray-50">' +
            '<td class="px-4 py-3 text-sm text-gray-800 font-mono">' + escapeHtml(inv.invoiceId) + '</td>' +
            '<td class="px-4 py-3 text-sm text-gray-800">' + escapeHtml(inv.clientName || inv.clientId) + '</td>' +
            '<td class="px-4 py-3 text-sm text-center text-gray-600">' + inv.periodStart + ' — ' + inv.periodEnd + '</td>' +
            '<td class="px-4 py-3 text-center">' + statusBadge + '</td>' +
            '<td class="px-4 py-3 text-sm text-right text-gray-800">' + formatCurrency(inv.revenue) + '</td>' +
            '<td class="px-4 py-3 text-sm text-right text-gray-800">' + formatCurrency(inv.cost) + '</td>' +
            '<td class="px-4 py-3 text-sm text-right ' + marginClass + '">' + formatCurrency(inv.margin) + '</td>' +
            (restricted ? '' : '<td class="px-4 py-3 text-sm text-right text-gray-700">' + (inv.marginPercent != null ? inv.marginPercent.toFixed(2) + '%' : '-') + '</td>') +
            '</tr>';
    }).join('');

    // Render pagination
    if (invPaginationState && typeof renderPaginationControls === 'function') {
        renderPaginationControls(
            'invoicePagination',
            invFilteredData.length,
            invPaginationState,
            function(newPage) {
                invPaginationState.currentPage = newPage;
                renderInvoicePage(marginData ? marginData.restrictedView : false);
            }
        );
    }
}

// ============================================
// HELPERS
// ============================================

function formatCurrency(val) {
    if (val == null || isNaN(val)) return '-';
    return '৳ ' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ============================================
// CSV EXPORT (Admin + Finance only)
// ============================================

function exportCSV() {
    if (!marginData || !marginData.byClient) {
        if (typeof showToast === 'function') showToast('No data to export', 'error');
        return;
    }

    const restricted = marginData.restrictedView;
    var headers = ['Client', 'Revenue', 'Cost', 'Margin'];
    if (!restricted) headers.push('Margin %');
    headers.push('Status');

    var rows = [headers.join(',')];
    marginData.byClient.forEach(function(c) {
        var row = [
            '"' + (c.clientName || c.clientId || '').replace(/"/g, '""') + '"',
            c.revenue,
            c.cost,
            c.margin
        ];
        if (!restricted) row.push(c.marginPercent != null ? c.marginPercent : '');
        row.push(c.negativeMargin ? 'Loss' : 'Profit');
        rows.push(row.join(','));
    });

    var csvContent = rows.join('\n');
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'margin_report_' + (marginData.period ? marginData.period.start + '_' + marginData.period.end : 'export') + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);

    if (typeof showToast === 'function') showToast('CSV exported', 'success');
}
