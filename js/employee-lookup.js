// ============================================
// EMPLOYEE LOOKUP — Reusable Type-Ahead
// ============================================
// Shared lookup component for Escort Duty, Day Labor, Guard Duty forms.
// Fetches employees from the backend and provides type-ahead search.
// NO permission logic — data comes from existing getEmployees endpoint.
// See CONTRIBUTING_AI.md before modifying this file.

/**
 * Cached employee list for lookup (fetched once per page load)
 * @type {Array}
 */
let _lookupEmployees = [];
let _lookupEmployeesLoaded = false;

/**
 * Fetch employees for lookup (cached per page load)
 * Reuses the existing 'getEmployees' backend action.
 * @returns {Promise<Array>} Array of employee objects
 */
async function fetchLookupEmployees() {
    if (_lookupEmployeesLoaded && _lookupEmployees.length > 0) {
        return _lookupEmployees;
    }

    try {
        const response = await request('getEmployees', {});
        if (response.success && Array.isArray(response.data)) {
            _lookupEmployees = response.data;
        } else {
            _lookupEmployees = [];
        }
    } catch (error) {
        console.error('Failed to fetch employees for lookup:', error);
        _lookupEmployees = [];
    }
    _lookupEmployeesLoaded = true;
    return _lookupEmployees;
}

/**
 * Initialize an employee lookup (type-ahead) on an input field.
 *
 * When the user types, a dropdown shows matching employees.
 * Selecting an employee sets both the name and ID fields.
 *
 * @param {Object} options
 * @param {string} options.inputId       - ID of the text input for employee name
 * @param {string} options.hiddenIdField - ID of the hidden input for employee ID
 * @param {string} [options.displayFormat] - 'name' | 'id-name' (default: 'name')
 */
function initEmployeeLookup(options) {
    const { inputId, hiddenIdField, displayFormat = 'name' } = options;

    const input = document.getElementById(inputId);
    const hiddenInput = document.getElementById(hiddenIdField);
    if (!input) return;

    // Create dropdown container
    const wrapper = input.parentElement;
    wrapper.style.position = 'relative';

    const dropdown = document.createElement('div');
    dropdown.id = inputId + '_lookup_dropdown';
    dropdown.className = 'employee-lookup-dropdown';
    dropdown.style.cssText = 'display:none; position:absolute; top:100%; left:0; right:0; max-height:200px; overflow-y:auto; background:#fff; border:1px solid #d1d5db; border-top:none; border-radius:0 0 0.5rem 0.5rem; z-index:100; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);';
    wrapper.appendChild(dropdown);

    // Track selection state — prevent manual free-text
    let selectedEmployee = null;

    // Input event — type-ahead search
    input.addEventListener('input', async function () {
        selectedEmployee = null;
        if (hiddenInput) hiddenInput.value = '';

        const term = input.value.trim().toLowerCase();
        if (term.length < 1) {
            dropdown.style.display = 'none';
            return;
        }

        const employees = await fetchLookupEmployees();
        const matches = employees.filter(emp => {
            const name = (emp.name || '').toLowerCase();
            const id = (emp.id || '').toString().toLowerCase();
            const phone = (emp.phone || '').toString().toLowerCase();
            return name.includes(term) || id.includes(term) || phone.includes(term);
        }).slice(0, 10); // Limit to 10 results

        if (matches.length === 0) {
            dropdown.innerHTML = '<div style="padding:8px 12px; color:#9ca3af; font-size:0.875rem;">No employees found</div>';
            dropdown.style.display = 'block';
            return;
        }

        dropdown.innerHTML = matches.map((emp, idx) => {
            const displayName = emp.name || '';
            const displayId = emp.phone || emp.id || '';
            return `<div class="employee-lookup-item" data-index="${idx}"
                style="padding:8px 12px; cursor:pointer; font-size:0.875rem; border-bottom:1px solid #f3f4f6;"
                onmouseenter="this.style.backgroundColor='#eff6ff'"
                onmouseleave="this.style.backgroundColor='#fff'">
                <div style="font-weight:500; color:#1f2937;">${escapeHtmlLookup(displayName)}</div>
                <div style="font-size:0.75rem; color:#6b7280;">ID: ${escapeHtmlLookup(displayId)} ${emp.role ? '· ' + escapeHtmlLookup(emp.role) : ''}</div>
            </div>`;
        }).join('');

        // Attach click handlers
        dropdown.querySelectorAll('.employee-lookup-item').forEach((item, idx) => {
            item.addEventListener('mousedown', function (e) {
                e.preventDefault(); // Prevent blur before click fires
                const emp = matches[idx];
                selectEmployee(emp);
            });
        });

        dropdown.style.display = 'block';
    });

    // Select employee helper
    function selectEmployee(emp) {
        selectedEmployee = emp;
        if (displayFormat === 'id-name') {
            input.value = (emp.phone || emp.id || '') + ' — ' + (emp.name || '');
        } else {
            input.value = emp.name || '';
        }
        if (hiddenInput) {
            hiddenInput.value = emp.id || emp.phone || '';
        }
        dropdown.style.display = 'none';
    }

    // Close dropdown on blur
    input.addEventListener('blur', function () {
        setTimeout(function () {
            dropdown.style.display = 'none';
            // If user typed but didn't select, clear to prevent free-text
            if (!selectedEmployee && input.value.trim()) {
                // Try exact match as fallback
                const term = input.value.trim().toLowerCase();
                const exactMatch = _lookupEmployees.find(emp =>
                    (emp.name || '').toLowerCase() === term ||
                    (emp.phone || '').toString().toLowerCase() === term ||
                    (emp.id || '').toString().toLowerCase() === term
                );
                if (exactMatch) {
                    selectEmployee(exactMatch);
                } else {
                    // Clear invalid input
                    input.value = '';
                    if (hiddenInput) hiddenInput.value = '';
                    if (typeof showToast === 'function') {
                        showToast('Please select an employee from the list', 'warning');
                    }
                }
            }
        }, 200);
    });

    // Keyboard navigation
    input.addEventListener('keydown', function (e) {
        const items = dropdown.querySelectorAll('.employee-lookup-item');
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
            dropdown.style.display = 'none';
        }
    });
}

/**
 * Escape HTML for lookup display (local helper to avoid conflicts)
 * @param {string} str
 * @returns {string}
 */
function escapeHtmlLookup(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Pre-load employees for lookup on page load.
 * Call this in DOMContentLoaded after auth is verified.
 */
async function preloadEmployeeLookup() {
    await fetchLookupEmployees();
}
