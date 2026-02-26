// ============================================
// UX UTILITIES
// Common UI/UX helpers - NO business logic
// ============================================

// ============================================
// LOADING STATES
// ============================================

/**
 * Show loading state on a button
 * @param {HTMLElement|string} btn - Button element or ID
 * @param {string} loadingText - Text to show while loading
 * @returns {Function} - Call to restore button
 */
function setButtonLoading(btn, loadingText = 'Loading...') {
    const button = typeof btn === 'string' ? document.getElementById(btn) : btn;
    if (!button) return () => {};
    
    const originalText = button.innerHTML;
    const originalDisabled = button.disabled;
    
    button.disabled = true;
    button.innerHTML = `<span class="inline-flex items-center">
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        ${loadingText}
    </span>`;
    
    return function restore() {
        button.disabled = originalDisabled;
        button.innerHTML = originalText;
    };
}

/**
 * Show loading overlay on a container
 * @param {HTMLElement|string} container - Container element or ID
 * @returns {Function} - Call to remove overlay
 */
function showLoadingOverlay(container) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return () => {};
    
    el.style.position = 'relative';
    
    const overlay = document.createElement('div');
    overlay.className = 'ux-loading-overlay absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10';
    overlay.innerHTML = `
        <div class="flex flex-col items-center">
            <svg class="animate-spin h-8 w-8 text-blue-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-sm text-gray-600">Loading...</span>
        </div>
    `;
    
    el.appendChild(overlay);
    
    return function remove() {
        overlay.remove();
    };
}

/**
 * Show table loading state
 * @param {string} tbodyId - Table body element ID
 * @param {number} colSpan - Number of columns
 */
function showTableLoading(tbodyId, colSpan = 5) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="${colSpan}" class="px-6 py-10 text-center">
                <div class="flex flex-col items-center">
                    <svg class="animate-spin h-8 w-8 text-blue-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="text-sm text-gray-500">Loading data...</span>
                </div>
            </td>
        </tr>
    `;
}

// ============================================
// EMPTY STATES
// ============================================

/**
 * Show empty state in table
 * @param {string} tbodyId - Table body element ID
 * @param {string} message - Message to display
 * @param {number} colSpan - Number of columns
 * @param {string} icon - Font Awesome icon class (optional)
 */
function showEmptyState(tbodyId, message = 'No records found', colSpan = 5, icon = 'fa-inbox') {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="${colSpan}" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center">
                    <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <i class="fas ${icon} text-2xl text-gray-400"></i>
                    </div>
                    <p class="text-gray-500 text-sm">${message}</p>
                </div>
            </td>
        </tr>
    `;
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

/**
 * Ensure toast container exists
 */
function ensureToastContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'fixed top-4 right-4 z-50 space-y-2';
        document.body.appendChild(container);
    }
    return container;
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type: success, error, warning, info
 * @param {number} duration - Duration in ms (default 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
    const container = ensureToastContainer();
    
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const toast = document.createElement('div');
    toast.className = `${colors[type] || colors.info} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transform transition-all duration-300 translate-x-0`;
    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info}"></i>
        <span class="text-sm">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto dismiss
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-full');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================
// CONFIRMATION MODALS
// ============================================

/**
 * Show confirmation modal
 * @param {Object} options - Modal options
 * @param {string} options.title - Modal title
 * @param {string} options.message - Modal message
 * @param {string} options.confirmText - Confirm button text
 * @param {string} options.cancelText - Cancel button text
 * @param {string} options.type - Type: danger, warning, info
 * @returns {Promise<boolean>} - Resolves true if confirmed
 */
function showConfirm(options = {}) {
    const {
        title = 'Confirm Action',
        message = 'Are you sure you want to proceed?',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        type = 'danger'
    } = options;
    
    return new Promise((resolve) => {
        // Remove existing confirm modals
        const existing = document.getElementById('uxConfirmModal');
        if (existing) existing.remove();
        
        const colors = {
            danger: { bg: 'bg-red-600 hover:bg-red-700', icon: 'fa-exclamation-triangle text-red-600', iconBg: 'bg-red-100' },
            warning: { bg: 'bg-yellow-600 hover:bg-yellow-700', icon: 'fa-exclamation-circle text-yellow-600', iconBg: 'bg-yellow-100' },
            info: { bg: 'bg-blue-600 hover:bg-blue-700', icon: 'fa-info-circle text-blue-600', iconBg: 'bg-blue-100' }
        };
        
        const color = colors[type] || colors.info;
        
        const modal = document.createElement('div');
        modal.id = 'uxConfirmModal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'confirmModalTitle');
        
        modal.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 transform transition-all">
                <div class="p-6">
                    <div class="flex items-start gap-4">
                        <div class="w-12 h-12 ${color.iconBg} rounded-full flex items-center justify-center flex-shrink-0">
                            <i class="fas ${color.icon} text-xl"></i>
                        </div>
                        <div class="flex-1">
                            <h3 id="confirmModalTitle" class="text-lg font-semibold text-gray-900">${title}</h3>
                            <p class="mt-2 text-sm text-gray-600">${message}</p>
                        </div>
                    </div>
                </div>
                <div class="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
                    <button id="uxConfirmCancel" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
                        ${cancelText}
                    </button>
                    <button id="uxConfirmOk" class="px-4 py-2 text-sm font-medium text-white ${color.bg} rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                        ${confirmText}
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Focus the cancel button by default
        const cancelBtn = document.getElementById('uxConfirmCancel');
        const confirmBtn = document.getElementById('uxConfirmOk');
        cancelBtn.focus();
        
        function cleanup(result) {
            modal.remove();
            document.removeEventListener('keydown', handleKeydown);
            resolve(result);
        }
        
        function handleKeydown(e) {
            if (e.key === 'Escape') {
                cleanup(false);
            }
        }
        
        document.addEventListener('keydown', handleKeydown);
        
        cancelBtn.addEventListener('click', () => cleanup(false));
        confirmBtn.addEventListener('click', () => cleanup(true));
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) cleanup(false);
        });
    });
}

/**
 * Convenience: Confirm delete action
 * @param {string} itemName - Name of item being deleted
 * @returns {Promise<boolean>}
 */
function confirmDelete(itemName = 'this item') {
    return showConfirm({
        title: 'Delete Confirmation',
        message: `Are you sure you want to delete ${itemName}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        type: 'danger'
    });
}

/**
 * Convenience: Confirm finalize action
 * @param {string} itemName - Name of item being finalized
 * @returns {Promise<boolean>}
 */
function confirmFinalize(itemName = 'this record') {
    return showConfirm({
        title: 'Finalize Confirmation',
        message: `Are you sure you want to finalize ${itemName}? This action cannot be reversed.`,
        confirmText: 'Finalize',
        cancelText: 'Cancel',
        type: 'warning'
    });
}

/**
 * Convenience: Confirm status change
 * @param {string} newStatus - The new status
 * @param {string} itemName - Name of item
 * @returns {Promise<boolean>}
 */
function confirmStatusChange(newStatus, itemName = 'this item') {
    return showConfirm({
        title: 'Change Status',
        message: `Are you sure you want to change the status of ${itemName} to "${newStatus}"?`,
        confirmText: 'Change Status',
        cancelText: 'Cancel',
        type: 'info'
    });
}

// ============================================
// FORM UTILITIES
// ============================================

/**
 * Initialize form validation UX
 * @param {string} formId - Form element ID
 */
function initFormValidation(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    // Add validation styles on blur
    form.querySelectorAll('input[required], select[required], textarea[required]').forEach(input => {
        // Add required indicator to label
        const label = form.querySelector(`label[for="${input.id}"]`);
        if (label && !label.querySelector('.required-star')) {
            const star = document.createElement('span');
            star.className = 'required-star text-red-500 ml-1';
            star.textContent = '*';
            label.appendChild(star);
        }
        
        // Validation on blur
        input.addEventListener('blur', function() {
            validateInput(this);
        });
        
        // Clear error on input
        input.addEventListener('input', function() {
            if (this.classList.contains('border-red-500')) {
                this.classList.remove('border-red-500');
                const errorEl = this.parentElement.querySelector('.field-error');
                if (errorEl) errorEl.remove();
            }
        });
    });
}

/**
 * Validate a single input
 * @param {HTMLElement} input - Input element
 * @returns {boolean} - Is valid
 */
function validateInput(input) {
    const isValid = input.checkValidity();
    
    // Remove existing error
    const existingError = input.parentElement.querySelector('.field-error');
    if (existingError) existingError.remove();
    
    if (!isValid) {
        input.classList.add('border-red-500');
        
        const error = document.createElement('p');
        error.className = 'field-error text-red-500 text-xs mt-1';
        error.textContent = input.validationMessage || 'This field is required';
        input.parentElement.appendChild(error);
    } else {
        input.classList.remove('border-red-500');
    }
    
    return isValid;
}

/**
 * Validate entire form
 * @param {string} formId - Form element ID
 * @returns {boolean} - Is valid
 */
function validateForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return false;
    
    let isValid = true;
    
    form.querySelectorAll('input[required], select[required], textarea[required]').forEach(input => {
        if (!validateInput(input)) {
            isValid = false;
        }
    });
    
    return isValid;
}

/**
 * Prevent double submit on form
 * @param {string} formId - Form element ID
 * @param {Function} submitHandler - Async submit handler
 */
function preventDoubleSubmit(formId, submitHandler) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    let isSubmitting = false;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (isSubmitting) return;
        
        const submitBtn = form.querySelector('button[type="submit"]');
        const restoreBtn = submitBtn ? setButtonLoading(submitBtn, 'Saving...') : () => {};
        
        isSubmitting = true;
        
        try {
            await submitHandler(e);
        } finally {
            isSubmitting = false;
            restoreBtn();
        }
    });
}

// ============================================
// ACCESSIBILITY HELPERS
// ============================================

/**
 * Initialize modal accessibility
 * @param {string} modalId - Modal element ID
 * @param {Function} closeHandler - Function to close modal
 */
function initModalAccessibility(modalId, closeHandler) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    // Close on ESC
    function handleKeydown(e) {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeHandler();
        }
    }
    
    document.addEventListener('keydown', handleKeydown);
    
    // Close on backdrop click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeHandler();
        }
    });
    
    // Trap focus inside modal
    modal.addEventListener('keydown', function(e) {
        if (e.key !== 'Tab') return;
        
        const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    });
}

/**
 * Focus first input in modal when opened
 * @param {string} modalId - Modal element ID
 */
function focusFirstInput(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
    if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
    }
}

// ============================================
// STATUS BADGE HELPERS
// ============================================

/**
 * Get consistent status badge HTML
 * @param {string} status - Status value
 * @param {string} type - Badge type context
 * @returns {string} - Badge HTML
 */
function getStatusBadge(status, type = 'default') {
    const badges = {
        // General statuses
        'Active': 'bg-green-100 text-green-800',
        'Inactive': 'bg-gray-100 text-gray-800',
        'Disabled': 'bg-red-100 text-red-800',
        'Pending': 'bg-yellow-100 text-yellow-800',
        
        // Payment statuses
        'Paid': 'bg-green-100 text-green-800',
        'Due': 'bg-red-100 text-red-800',
        'Partial': 'bg-yellow-100 text-yellow-800',
        
        // Attendance statuses
        'Present': 'bg-green-100 text-green-800',
        'Absent': 'bg-red-100 text-red-800',
        'Late': 'bg-yellow-100 text-yellow-800',
        'On Leave': 'bg-blue-100 text-blue-800',
        
        // Job application statuses
        'New': 'bg-blue-100 text-blue-800',
        'Shortlisted': 'bg-indigo-100 text-indigo-800',
        'Interview': 'bg-purple-100 text-purple-800',
        'Hired': 'bg-green-100 text-green-800',
        'Rejected': 'bg-red-100 text-red-800',
        
        // Invoice statuses
        'Draft': 'bg-gray-100 text-gray-800',
        'Sent': 'bg-blue-100 text-blue-800',
        'Overdue': 'bg-red-100 text-red-800',
        
        // Loan types
        'Loan': 'bg-orange-100 text-orange-800',
        'Advance': 'bg-purple-100 text-purple-800',
        
        // Job post statuses
        'Open': 'bg-green-100 text-green-800',
        'Closed': 'bg-gray-100 text-gray-800',
        'Expired': 'bg-red-100 text-red-800'
    };
    
    const colorClass = badges[status] || 'bg-gray-100 text-gray-800';
    
    return `<span class="px-2 py-1 text-xs font-medium rounded-full ${colorClass}">${status}</span>`;
}

// ============================================
// UTILITY EXPORTS (for module use)
// ============================================

// All functions are globally available
