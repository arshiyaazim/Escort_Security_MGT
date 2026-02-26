/**
 * Al-Aqsa HRM - Pagination Utilities
 * Generic client-side pagination for all data tables
 */

// ============================================
// PAGINATION CORE FUNCTIONS
// ============================================

/**
 * Paginate an array of data
 * @param {Array} dataArray - Full dataset
 * @param {number} currentPage - Current page (1-indexed)
 * @param {number} pageSize - Items per page
 * @returns {Object} - { items, totalPages, totalItems, startIndex, endIndex }
 */
function paginate(dataArray, currentPage, pageSize) {
    const totalItems = dataArray.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    
    // Clamp current page to valid range
    const validPage = Math.min(Math.max(1, currentPage), totalPages);
    
    // Calculate slice indices
    const startIndex = (validPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    
    // Get current page items (never mutate original)
    const items = dataArray.slice(startIndex, endIndex);
    
    return {
        items,
        currentPage: validPage,
        totalPages,
        totalItems,
        startIndex: totalItems > 0 ? startIndex + 1 : 0, // 1-indexed for display
        endIndex,
        hasNext: validPage < totalPages,
        hasPrev: validPage > 1
    };
}

/**
 * Create pagination state for a module
 * @param {number} defaultPageSize - Default items per page
 * @returns {Object} - Pagination state object
 */
function createPaginationState(defaultPageSize = 10) {
    return {
        currentPage: 1,
        pageSize: defaultPageSize,
        totalPages: 1,
        totalItems: 0
    };
}

// ============================================
// PAGINATION UI RENDERING
// ============================================

/**
 * Render pagination controls
 * @param {string} containerId - ID of container element
 * @param {Object} paginationResult - Result from paginate()
 * @param {Object} callbacks - { onPageChange, onPageSizeChange }
 */
function renderPaginationControls(containerId, paginationResult, callbacks) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const { currentPage, totalPages, totalItems, startIndex, endIndex, hasNext, hasPrev } = paginationResult;
    
    // Generate page numbers to show
    const pageNumbers = generatePageNumbers(currentPage, totalPages);
    
    container.innerHTML = `
        <div class="pagination-wrapper">
            <div class="pagination-info">
                <span class="pagination-text">
                    ${totalItems > 0 
                        ? `Showing <strong>${startIndex}–${endIndex}</strong> of <strong>${totalItems}</strong> records`
                        : 'No records to display'}
                </span>
            </div>
            <div class="pagination-controls">
                <div class="page-size-selector">
                    <label for="${containerId}-pageSize">Show:</label>
                    <select id="${containerId}-pageSize" class="page-size-select">
                        <option value="10" ${paginationResult.pageSize === 10 ? 'selected' : ''}>10</option>
                        <option value="20" ${paginationResult.pageSize === 20 ? 'selected' : ''}>20</option>
                        <option value="50" ${paginationResult.pageSize === 50 ? 'selected' : ''}>50</option>
                    </select>
                </div>
                <div class="page-buttons">
                    <button class="btn btn-sm btn-outline-secondary page-btn" data-page="first" ${!hasPrev ? 'disabled' : ''} title="First Page">
                        <i class="bi bi-chevron-double-left"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary page-btn" data-page="prev" ${!hasPrev ? 'disabled' : ''} title="Previous Page">
                        <i class="bi bi-chevron-left"></i>
                    </button>
                    ${pageNumbers.map(p => {
                        if (p === '...') {
                            return `<span class="page-ellipsis">...</span>`;
                        }
                        return `<button class="btn btn-sm ${p === currentPage ? 'btn-primary' : 'btn-outline-secondary'} page-btn page-num" data-page="${p}">${p}</button>`;
                    }).join('')}
                    <button class="btn btn-sm btn-outline-secondary page-btn" data-page="next" ${!hasNext ? 'disabled' : ''} title="Next Page">
                        <i class="bi bi-chevron-right"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary page-btn" data-page="last" ${!hasNext ? 'disabled' : ''} title="Last Page">
                        <i class="bi bi-chevron-double-right"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Attach event listeners
    attachPaginationListeners(containerId, currentPage, totalPages, callbacks);
}

/**
 * Generate array of page numbers to display
 */
function generatePageNumbers(currentPage, totalPages) {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }
    } else {
        // Always show first page
        pages.push(1);
        
        // Calculate range around current page
        let start = Math.max(2, currentPage - 1);
        let end = Math.min(totalPages - 1, currentPage + 1);
        
        // Adjust if at edges
        if (currentPage <= 2) {
            end = 4;
        } else if (currentPage >= totalPages - 1) {
            start = totalPages - 3;
        }
        
        // Add ellipsis before middle section if needed
        if (start > 2) {
            pages.push('...');
        }
        
        // Add middle pages
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        
        // Add ellipsis after middle section if needed
        if (end < totalPages - 1) {
            pages.push('...');
        }
        
        // Always show last page
        pages.push(totalPages);
    }
    
    return pages;
}

/**
 * Attach event listeners to pagination controls
 */
function attachPaginationListeners(containerId, currentPage, totalPages, callbacks) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Page size change
    const pageSizeSelect = container.querySelector(`#${containerId}-pageSize`);
    if (pageSizeSelect && callbacks.onPageSizeChange) {
        pageSizeSelect.addEventListener('change', (e) => {
            callbacks.onPageSizeChange(parseInt(e.target.value, 10));
        });
    }
    
    // Page buttons
    const pageButtons = container.querySelectorAll('.page-btn');
    pageButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const pageValue = btn.dataset.page;
            let newPage = currentPage;
            
            switch (pageValue) {
                case 'first':
                    newPage = 1;
                    break;
                case 'prev':
                    newPage = Math.max(1, currentPage - 1);
                    break;
                case 'next':
                    newPage = Math.min(totalPages, currentPage + 1);
                    break;
                case 'last':
                    newPage = totalPages;
                    break;
                default:
                    newPage = parseInt(pageValue, 10);
            }
            
            if (newPage !== currentPage && callbacks.onPageChange) {
                callbacks.onPageChange(newPage);
            }
        });
    });
}

// ============================================
// PAGINATION CSS (Injected once)
// ============================================

(function injectPaginationStyles() {
    if (document.getElementById('pagination-utils-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'pagination-utils-styles';
    styles.textContent = `
        .pagination-wrapper {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            gap: 12px;
            border-top: 1px solid #dee2e6;
            margin-top: 8px;
        }
        
        .pagination-info {
            color: #6c757d;
            font-size: 0.875rem;
        }
        
        .pagination-info strong {
            color: #495057;
        }
        
        .pagination-controls {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        
        .page-size-selector {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .page-size-selector label {
            font-size: 0.875rem;
            color: #6c757d;
            margin: 0;
        }
        
        .page-size-select {
            padding: 4px 8px;
            font-size: 0.875rem;
            border: 1px solid #ced4da;
            border-radius: 4px;
            background: white;
        }
        
        .page-buttons {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .page-btn {
            min-width: 32px;
            padding: 4px 8px;
            font-size: 0.875rem;
        }
        
        .page-btn.page-num {
            min-width: 36px;
        }
        
        .page-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .page-ellipsis {
            padding: 0 8px;
            color: #6c757d;
        }
        
        @media (max-width: 768px) {
            .pagination-wrapper {
                flex-direction: column;
                align-items: flex-start;
            }
            
            .pagination-controls {
                width: 100%;
                justify-content: space-between;
            }
            
            .page-btn:not(.page-num) {
                display: inline-flex;
            }
            
            .page-num {
                display: none;
            }
            
            .page-num.btn-primary {
                display: inline-flex;
            }
        }
    `;
    document.head.appendChild(styles);
})();

// ============================================
// HELPER: Add pagination container to table
// ============================================

/**
 * Ensure pagination container exists after a table
 * @param {string} tableContainerId - ID of table container
 * @param {string} paginationId - ID for pagination container
 */
function ensurePaginationContainer(tableContainerId, paginationId) {
    const tableContainer = document.getElementById(tableContainerId);
    if (!tableContainer) return;
    
    let paginationContainer = document.getElementById(paginationId);
    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = paginationId;
        paginationContainer.className = 'pagination-container';
        tableContainer.parentNode.insertBefore(paginationContainer, tableContainer.nextSibling);
    }
    return paginationContainer;
}
