// ============================================
// CLIENT LOOKUP — Reusable Dropdown Population & Type-Ahead
// ============================================
// Shared component for client selection across all modules.
// Provides:
//   1. populateClientDropdown() — for <select> dropdowns (escort-duty, day-labor)
//   2. initClientLookup()       — for type-ahead text inputs (guard-duty)
//   3. preloadClientLookup()    — eagerly load client data
//
// Shared helpers (used everywhere):
//   getClientDisplayName(client) — canonical display name
//   isClientActive(client)       — robust active status check
//   normalizeStatus(status)      — normalize status string
//
// Fetches clients via existing getClients endpoint.
// NO permission logic — data comes from existing getClients action.

/**
 * Debug flag — set to true in browser console to enable logging:
 *   window._CLIENT_LOOKUP_DEBUG = true;
 */
var _CLIENT_LOOKUP_DEBUG = false;

function _clDebug() {
    if (window._CLIENT_LOOKUP_DEBUG || _CLIENT_LOOKUP_DEBUG) {
        console.log('[client-lookup]', ...arguments);
    }
}

/**
 * Cached client list (fetched once per page load)
 * @type {Array}
 */
let _lookupClients = [];
let _lookupClientsLoaded = false;

// ============================================
// SHARED HELPERS — used by all modules
// ============================================

/**
 * Get the canonical display name for a client object.
 *   displayName = (companyName || name || '').trim()
 *
 * @param {Object} client
 * @returns {string}
 */
function getClientDisplayName(client) {
    if (!client) return '';
    return (client.companyName || client.name || '').toString().trim();
}

/**
 * Normalize a status string for comparison.
 * Trims whitespace and lowercases.
 *
 * @param {string} status
 * @returns {string} normalized status (e.g. 'active', 'inactive', '')
 */
function normalizeStatus(status) {
    return (status || '').toString().trim().toLowerCase();
}

/**
 * Check if a client should be treated as active.
 * Active if status is blank, empty, or any case/whitespace variation of "active".
 *
 * @param {Object} client
 * @returns {boolean}
 */
function isClientActive(client) {
    var s = normalizeStatus(client.status);
    return s === '' || s === 'active';
}

// Keep legacy alias for backward compatibility within this file
var _isClientActive = isClientActive;

// ============================================
// DATA FETCHING
// ============================================

/**
 * Fetch clients for lookup/dropdown (cached per page load).
 * Reuses the existing 'getClients' backend action.
 * @returns {Promise<Array>} Array of client objects
 */
async function fetchLookupClients() {
    if (_lookupClientsLoaded && _lookupClients.length > 0) {
        return _lookupClients;
    }

    try {
        _clDebug('Fetching clients from backend...');
        const response = await request('getClients', {});
        if (response.success && Array.isArray(response.data)) {
            _lookupClients = response.data;
            _clDebug('Fetched', _lookupClients.length, 'clients');
            if (_lookupClients.length > 0) {
                _clDebug('Sample client:', JSON.stringify(_lookupClients[0]));
            }
        } else {
            _lookupClients = [];
            console.warn('[client-lookup] getClients returned unexpected shape:', response);
        }
    } catch (error) {
        console.error('[client-lookup] Failed to fetch clients:', error);
        _lookupClients = [];
        if (typeof showToast === 'function') {
            showToast('Failed to load client list — check permissions or network', 'error');
        }
    }
    _lookupClientsLoaded = true;

    if (_lookupClients.length === 0) {
        console.warn('[client-lookup] No clients available after fetch');
        if (typeof showToast === 'function') {
            showToast('No clients available (check permissions or client list)', 'warning');
        }
    }

    return _lookupClients;
}

/**
 * Safely get the display name of the currently selected client from a <select>.
 * Returns '' if no real client is selected (empty option or nothing).
 *
 * @param {HTMLSelectElement} selectEl - The select element
 * @returns {string} Display name or ''
 */
function getSelectedClientDisplayName(selectEl) {
    if (!selectEl || selectEl.selectedIndex < 0) return '';
    const opt = selectEl.options[selectEl.selectedIndex];
    // If the selected option has no value, it's the placeholder — return ''
    if (!opt || !opt.value) return '';
    return opt.text || '';
}

// ============================================
// DROPDOWN POPULATION (legacy select support)
// ============================================

/**
 * Populate a <select> element with client names from the cached client list.
 * Used by escort-duty.js and day-labor.js (and any other <select> based modules).
 *
 * Option value is the client ID (not name), display text is displayName.
 * If hiddenIdField is provided, keeps it synced to select.value (which is client.id).
 *
 * @param {Object} options
 * @param {string} options.selectId       - ID of the <select> element to populate
 * @param {string} [options.hiddenIdField] - ID of a hidden input to auto-set with client ID on change
 * @param {boolean} [options.includeEmpty] - Whether to include an empty/default option (default: true)
 * @param {string} [options.emptyLabel]   - Label for the empty option (default: '-- Select Client --')
 */
async function populateClientDropdown(options) {
    const {
        selectId,
        hiddenIdField = '',
        includeEmpty = true,
        emptyLabel = '-- Select Client --'
    } = options;

    const select = document.getElementById(selectId);
    if (!select) return;

    // Fetch clients (uses cache if already loaded)
    const clients = await fetchLookupClients();

    // Build options HTML
    let optionsHtml = '';

    if (includeEmpty) {
        optionsHtml += `<option value="">${emptyLabel}</option>`;
    }

    // Sort clients alphabetically by display name, active only
    const sorted = [...clients]
        .filter(c => isClientActive(c))
        .sort((a, b) => {
            const nameA = getClientDisplayName(a).toLowerCase();
            const nameB = getClientDisplayName(b).toLowerCase();
            return nameA.localeCompare(nameB);
        });

    for (const client of sorted) {
        const displayName = getClientDisplayName(client);
        const id = client.id || '';
        optionsHtml += `<option value="${escapeAttr(id)}">${escapeAttr(displayName)}</option>`;
    }

    // Populate the EXISTING <select> — NO cloneNode, NO replaceChild
    select.innerHTML = optionsHtml;

    // If a hidden ID field is specified, sync it on change
    if (hiddenIdField) {
        const hiddenInput = document.getElementById(hiddenIdField);
        if (hiddenInput) {
            // Attach change listener only once (tracked by data attribute)
            if (!select.dataset.clientDropdownBound) {
                select.addEventListener('change', function () {
                    hiddenInput.value = select.value || '';
                    _clDebug('dropdown change → hiddenId =', hiddenInput.value,
                             'selectedText =', select.options[select.selectedIndex]?.text);
                });
                select.dataset.clientDropdownBound = '1';
            }

            // Initialize hidden field to current (empty) value
            hiddenInput.value = select.value || '';
        }
    }
}

/**
 * Escape a value for safe use in HTML attributes / text content.
 * Safely handles numbers, booleans, null, and undefined in addition to strings.
 * @param {*} value
 * @returns {string}
 */
function escapeAttr(value) {
    if (value == null) return '';          // null / undefined
    if (typeof value !== 'string') {
        _clDebug('escapeAttr: coercing non-string value', typeof value, value);
        value = String(value);            // number, boolean, etc.
    }
    if (!value) return '';
    return value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ============================================
// TYPE-AHEAD LOOKUP
// ============================================
// Same UX pattern as employee-lookup.js.
// Dropdown is appended to document.body to avoid overflow clipping inside modals.

/**
 * Initialize a client lookup (type-ahead) on a text input field.
 *
 * When the user types, a dropdown shows matching active clients.
 * Selecting a client sets both the visible name and hidden ID fields.
 * Dropdown is positioned with position:fixed and high z-index to avoid modal clipping.
 *
 * @param {Object} options
 * @param {string} options.inputId       - ID of the text input for client name
 * @param {string} options.hiddenIdField - ID of the hidden input for client ID
 */
function initClientLookup(options) {
    const { inputId, hiddenIdField } = options;

    const input = document.getElementById(inputId);
    const hiddenInput = document.getElementById(hiddenIdField);
    if (!input) {
        console.error('[client-lookup] initClientLookup: input #' + inputId + ' not found');
        return;
    }
    _clDebug('initClientLookup() running for #' + inputId);

    // Create dropdown container — append to body to avoid modal overflow clipping
    const dropdown = document.createElement('div');
    dropdown.id = inputId + '_client_lookup_dropdown';
    dropdown.className = 'client-lookup-dropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.style.cssText = 'display:none; position:fixed; max-height:200px; overflow-y:auto; background:#fff; border:1px solid #d1d5db; border-radius:0 0 0.5rem 0.5rem; z-index:9999; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);';
    document.body.appendChild(dropdown);

    // Track selection state
    let selectedClient = null;

    // Update aria attributes
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');

    /**
     * Position the dropdown below the input using getBoundingClientRect.
     */
    function positionDropdown() {
        const rect = input.getBoundingClientRect();
        dropdown.style.top = rect.bottom + 'px';
        dropdown.style.left = rect.left + 'px';
        dropdown.style.width = rect.width + 'px';
    }

    /**
     * Show the dropdown (with correct position).
     */
    function showDropdown() {
        positionDropdown();
        dropdown.style.display = 'block';
        input.setAttribute('aria-expanded', 'true');
    }

    /**
     * Hide the dropdown.
     */
    function hideDropdown() {
        dropdown.style.display = 'none';
        input.setAttribute('aria-expanded', 'false');
    }

    /**
     * Filter active clients by search term (case-insensitive substring match)
     * Matches by displayName and id.
     * @param {Array} clients
     * @param {string} term
     * @returns {Array}
     */
    function filterClients(clients, term) {
        return clients
            .filter(c => isClientActive(c))
            .filter(c => {
                const name = getClientDisplayName(c).toLowerCase();
                const id = (c.id || '').toString().toLowerCase();
                return name.includes(term) || id.includes(term);
            })
            .sort((a, b) => {
                const nameA = getClientDisplayName(a).toLowerCase();
                const nameB = getClientDisplayName(b).toLowerCase();
                return nameA.localeCompare(nameB);
            })
            .slice(0, 10);
    }

    // Input event — type-ahead search
    input.addEventListener('input', async function () {
        // On manual typing after selection, clear hidden client id to prevent stale IDs
        selectedClient = null;
        if (hiddenInput) hiddenInput.value = '';

        const term = input.value.trim().toLowerCase();
        if (term.length < 1) {
            hideDropdown();
            return;
        }

        const clients = await fetchLookupClients();
        const matches = filterClients(clients, term);

        _clDebug('Query "' + term + '" → ' + matches.length + ' matches (of ' + clients.length + ' total)');

        if (matches.length === 0) {
            dropdown.innerHTML = '<div role="option" style="padding:8px 12px; color:#9ca3af; font-size:0.875rem;">No clients found</div>';
            showDropdown();
            return;
        }

        dropdown.innerHTML = matches.map((client, idx) => {
            const displayName = getClientDisplayName(client);
            const displayId = client.id || '';
            return `<div class="client-lookup-item" role="option" data-index="${idx}"
                style="padding:8px 12px; cursor:pointer; font-size:0.875rem; border-bottom:1px solid #f3f4f6;"
                onmouseenter="this.style.backgroundColor='#eff6ff'"
                onmouseleave="this.style.backgroundColor='#fff'">
                <div style="font-weight:500; color:#1f2937;">${escapeAttr(displayName)}</div>
                <div style="font-size:0.75rem; color:#6b7280;">ID: ${escapeAttr(displayId)}</div>
            </div>`;
        }).join('');

        // Attach click handlers
        dropdown.querySelectorAll('.client-lookup-item').forEach((item, idx) => {
            item.addEventListener('mousedown', function (e) {
                e.preventDefault(); // Prevent blur before click fires
                selectClient(matches[idx]);
            });
        });

        showDropdown();
    });

    // Select client helper
    function selectClient(client) {
        selectedClient = client;
        input.value = getClientDisplayName(client);
        if (hiddenInput) {
            hiddenInput.value = client.id || '';
        }
        _clDebug('Selected client:', client.id, getClientDisplayName(client));
        hideDropdown();
    }

    // Close dropdown on blur
    input.addEventListener('blur', function () {
        setTimeout(function () {
            hideDropdown();
            // If user typed but didn't select, try exact match or clear
            if (!selectedClient && input.value.trim()) {
                const term = input.value.trim().toLowerCase();
                const exactMatch = _lookupClients
                    .filter(c => isClientActive(c))
                    .find(c =>
                        getClientDisplayName(c).toLowerCase() === term ||
                        (c.id || '').toString().toLowerCase() === term
                    );
                if (exactMatch) {
                    selectClient(exactMatch);
                } else {
                    // Clear invalid input
                    input.value = '';
                    if (hiddenInput) hiddenInput.value = '';
                    if (typeof showToast === 'function') {
                        showToast('Please select a valid client from the list.', 'warning');
                    }
                }
            }
        }, 200);
    });

    // Reposition on scroll/resize (since dropdown is fixed position on body)
    function onScrollOrResize() {
        if (dropdown.style.display !== 'none') {
            positionDropdown();
        }
    }
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    // Keyboard navigation (ArrowUp/Down, Enter, Escape)
    input.addEventListener('keydown', function (e) {
        const items = dropdown.querySelectorAll('.client-lookup-item');
        if (items.length === 0) return;

        let activeIndex = -1;
        items.forEach((item, idx) => {
            if (item.style.backgroundColor === 'rgb(239, 246, 255)') activeIndex = idx;
        });

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = activeIndex < items.length - 1 ? activeIndex + 1 : 0;
            items.forEach(item => item.style.backgroundColor = '#fff');
            items[nextIndex].style.backgroundColor = '#eff6ff';
            items[nextIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIndex = activeIndex > 0 ? activeIndex - 1 : items.length - 1;
            items.forEach(item => item.style.backgroundColor = '#fff');
            items[prevIndex].style.backgroundColor = '#eff6ff';
            items[prevIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex >= 0) {
                items[activeIndex].dispatchEvent(new Event('mousedown'));
            }
        } else if (e.key === 'Escape') {
            hideDropdown();
        }
    });

    _clDebug('initClientLookup() complete for #' + inputId);
}

/**
 * Pre-load clients for lookup/dropdown on page load.
 * Call this in DOMContentLoaded after auth is verified.
 */
async function preloadClientLookup() {
    await fetchLookupClients();
}
