// Job Applications Management Module - INTERNAL
// Review applications, update status, view details
// NO deletion of submitted applications

// ============================================
// SINGLE STATE ARRAY
// ============================================
let applications = [];
let jobPosts = [];  // For job dropdown filter

// ============================================
// PAGINATION STATE
// ============================================
let applicationsPaginationState = createPaginationState(10);

// ============================================
// SINGLE REFRESH FUNCTION
// ============================================

/**
 * Refresh applications list
 * @param {string} jobId - Optional job filter
 * @param {string} status - Optional status filter
 */
async function refreshJobApplications(jobId = '', status = '') {
    // Show loading state
    if (typeof showTableLoading === 'function') {
        showTableLoading('applicationsTableBody', 6);
    }
    
    try {
        const payload = {};
        if (jobId) payload.jobId = jobId;
        if (status) payload.status = status;
        
        const response = await request("getJobApplications", payload);
        
        if (response.success) {
            applications = response.data || [];
            renderApplicationsTable();
            updateSummaryCards();
        } else {
            console.error("Failed to load applications:", response.message);
            applications = [];
            renderApplicationsTable();
            updateSummaryCards();
            if (typeof showToast === 'function') {
                showToast('Failed to load applications', 'error');
            }
        }
    } catch (error) {
        console.error("Error loading applications:", error);
        applications = [];
        renderApplicationsTable();
        updateSummaryCards();
        if (typeof showToast === 'function') {
            showToast('Error loading applications', 'error');
        }
    }
}

/**
 * Load job posts for filter dropdown
 */
async function loadJobPostsForFilter() {
    try {
        const response = await request("getJobPosts", {});
        if (response.success) {
            jobPosts = response.data || [];
            renderJobFilter();
        }
    } catch (error) {
        console.error("Error loading job posts:", error);
    }
}

// ============================================
// RENDER FUNCTIONS
// ============================================

/**
 * Render job filter dropdown
 */
function renderJobFilter() {
    const select = document.getElementById("jobFilter");
    if (!select) return;
    
    const currentValue = select.value;
    
    select.innerHTML = `
        <option value="">All Jobs</option>
        ${jobPosts.map(job => `
            <option value="${job.id}" ${currentValue === job.id ? 'selected' : ''}>
                ${escapeHtmlApps(job.title)}
            </option>
        `).join('')}
    `;
}

/**
 * Render applications table
 */
function renderApplicationsTable() {
    applicationsPaginationState.currentPage = 1;
    renderPaginatedApplicationsTable();
}

/**
 * Render paginated applications table
 */
function renderPaginatedApplicationsTable() {
    const tbody = document.getElementById("applicationsTableBody");
    if (!tbody) return;
    
    if (applications.length === 0) {
        if (typeof showEmptyState === 'function') {
            showEmptyState('applicationsTableBody', 'No applications found. Applications will appear here when candidates apply.', 6, 'fa-user-tie');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                        No applications found.
                    </td>
                </tr>
            `;
        }
        const paginationContainer = document.getElementById('applicationsPagination');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const result = paginate(applications, applicationsPaginationState.currentPage, applicationsPaginationState.pageSize);
    
    tbody.innerHTML = result.items.map(app => `
        <tr class="border-b hover:bg-gray-50">
            <td class="px-4 py-3">
                <div class="font-medium">${escapeHtmlApps(app.applicantName)}</div>
                <div class="text-xs text-gray-500">${escapeHtmlApps(app.email)}</div>
            </td>
            <td class="px-4 py-3">${escapeHtmlApps(app.jobTitle)}</td>
            <td class="px-4 py-3">${escapeHtmlApps(app.phone)}</td>
            <td class="px-4 py-3">${app.appliedDate}</td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 text-xs rounded-full ${getStatusClass(app.status)}">
                    ${app.status}
                </span>
            </td>
            <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                    <button onclick="viewApplicationDetails('${app.id}')" 
                        class="text-blue-600 hover:text-blue-800" title="View Details">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                    </button>
                    <button onclick="showUpdateStatusModal('${app.id}')" 
                        class="text-green-600 hover:text-green-800" title="Update Status">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    renderPaginationControls('applicationsPagination', {
        ...result,
        pageSize: applicationsPaginationState.pageSize
    }, {
        onPageChange: (page) => {
            applicationsPaginationState.currentPage = page;
            renderPaginatedApplicationsTable();
        },
        onPageSizeChange: (size) => {
            applicationsPaginationState.pageSize = size;
            applicationsPaginationState.currentPage = 1;
            renderPaginatedApplicationsTable();
        }
    });
}

/**
 * Update summary cards
 */
function updateSummaryCards() {
    const total = applications.length;
    const submitted = applications.filter(a => a.status === 'Submitted').length;
    const shortlisted = applications.filter(a => a.status === 'Shortlisted').length;
    const interviewed = applications.filter(a => a.status === 'Interviewed').length;
    const hired = applications.filter(a => a.status === 'Hired').length;
    
    document.getElementById("totalAppsCount").textContent = total;
    document.getElementById("submittedCount").textContent = submitted;
    document.getElementById("shortlistedCount").textContent = shortlisted;
    document.getElementById("interviewedCount").textContent = interviewed;
    document.getElementById("hiredCount").textContent = hired;
}

/**
 * Get CSS class for status badge
 */
function getStatusClass(status) {
    switch (status) {
        case 'Submitted':
            return 'bg-blue-100 text-blue-800';
        case 'Shortlisted':
            return 'bg-yellow-100 text-yellow-800';
        case 'Interviewed':
            return 'bg-purple-100 text-purple-800';
        case 'Rejected':
            return 'bg-red-100 text-red-800';
        case 'Hired':
            return 'bg-green-100 text-green-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

// ============================================
// VIEW APPLICATION DETAILS
// ============================================

/**
 * View application details
 */
async function viewApplicationDetails(appId) {
    const app = applications.find(a => String(a.id) === String(appId));
    if (!app) return;
    
    const modal = document.getElementById("detailModal");
    const content = document.getElementById("detailContent");
    
    if (!modal || !content) return;
    
    // Get uploaded files for this application
    let filesHtml = '<p class="text-gray-500 text-sm">No files uploaded</p>';
    
    if (typeof getFiles === 'function') {
        try {
            const filesResponse = await getFiles('JobApplication', appId);
            if (filesResponse.success && filesResponse.data && filesResponse.data.length > 0) {
                filesHtml = `
                    <ul class="space-y-2">
                        ${filesResponse.data.map(f => `
                            <li class="flex items-center gap-2">
                                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                                <a href="${f.driveUrl}" target="_blank" class="text-blue-600 hover:underline text-sm">
                                    ${escapeHtmlApps(f.fileName)}
                                </a>
                                <span class="text-xs text-gray-400">(${formatFileSizeApps(f.fileSize)})</span>
                            </li>
                        `).join('')}
                    </ul>
                `;
            }
        } catch (error) {
            console.error("Error loading files:", error);
        }
    }
    
    content.innerHTML = `
        <div class="space-y-6">
            <!-- Header -->
            <div class="flex justify-between items-start">
                <div>
                    <h2 class="text-xl font-bold text-gray-800">${escapeHtmlApps(app.applicantName)}</h2>
                    <p class="text-gray-500">Applied for: ${escapeHtmlApps(app.jobTitle)}</p>
                </div>
                <span class="px-3 py-1 text-sm rounded-full ${getStatusClass(app.status)}">
                    ${app.status}
                </span>
            </div>
            
            <!-- Contact Info -->
            <div class="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                <div>
                    <span class="text-xs text-gray-500">Phone</span>
                    <p class="font-medium">${escapeHtmlApps(app.phone)}</p>
                </div>
                <div>
                    <span class="text-xs text-gray-500">Email</span>
                    <p class="font-medium">${escapeHtmlApps(app.email)}</p>
                </div>
                <div>
                    <span class="text-xs text-gray-500">Address</span>
                    <p class="font-medium">${escapeHtmlApps(app.address) || 'N/A'}</p>
                </div>
                <div>
                    <span class="text-xs text-gray-500">Applied Date</span>
                    <p class="font-medium">${app.appliedDate}</p>
                </div>
            </div>
            
            <!-- Education -->
            <div>
                <h3 class="text-sm font-semibold text-gray-700 mb-2">Education</h3>
                <p class="text-gray-600 whitespace-pre-line">${escapeHtmlApps(app.education) || 'Not provided'}</p>
            </div>
            
            <!-- Experience -->
            <div>
                <h3 class="text-sm font-semibold text-gray-700 mb-2">Work Experience</h3>
                <p class="text-gray-600 whitespace-pre-line">${escapeHtmlApps(app.experience) || 'Not provided'}</p>
            </div>
            
            <!-- Uploaded Files -->
            <div>
                <h3 class="text-sm font-semibold text-gray-700 mb-2">Uploaded Documents</h3>
                ${filesHtml}
            </div>
            
            <!-- Notes -->
            <div>
                <h3 class="text-sm font-semibold text-gray-700 mb-2">Internal Notes</h3>
                <p class="text-gray-600">${escapeHtmlApps(app.notes) || 'No notes added'}</p>
            </div>
            
            <!-- Application ID -->
            <div class="text-xs text-gray-400">
                Application ID: ${app.id}
            </div>
            
            <!-- Actions -->
            <div class="pt-4 border-t flex justify-end gap-3">
                <button onclick="closeDetailModal()" 
                    class="px-4 py-2 text-gray-600 hover:text-gray-800">
                    Close
                </button>
                <button onclick="closeDetailModal(); showUpdateStatusModal('${app.id}')" 
                    class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                    Update Status
                </button>
            </div>
        </div>
    `;
    
    modal.classList.remove("hidden");
}

/**
 * Close detail modal
 */
function closeDetailModal() {
    document.getElementById("detailModal").classList.add("hidden");
}

// ============================================
// UPDATE STATUS
// ============================================

/**
 * Show update status modal
 */
function showUpdateStatusModal(appId) {
    const app = applications.find(a => String(a.id) === String(appId));
    if (!app) return;
    
    document.getElementById("updateAppId").value = app.id;
    document.getElementById("updateAppName").textContent = app.applicantName;
    document.getElementById("updateStatus").value = app.status;
    document.getElementById("updateNotes").value = app.notes || '';
    
    document.getElementById("statusModal").classList.remove("hidden");
}

/**
 * Close status modal
 */
function closeStatusModal() {
    document.getElementById("statusModal").classList.add("hidden");
}

/**
 * Save status update
 */
async function saveStatusUpdate(event) {
    event.preventDefault();
    
    const form = document.getElementById('statusForm');
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    const restoreBtn = typeof setButtonLoading === 'function' && submitBtn
        ? setButtonLoading(submitBtn, 'Saving...') 
        : () => {};
    
    const appId = document.getElementById("updateAppId").value;
    const newStatus = document.getElementById("updateStatus").value;
    const notes = document.getElementById("updateNotes").value.trim();
    
    try {
        const response = await request("updateApplicationStatus", {
            id: appId,
            status: newStatus,
            notes: notes
        });
        
        if (response.success) {
            closeStatusModal();
            refreshJobApplications(getCurrentJobFilter(), getCurrentStatusFilter());
            if (typeof showToast === 'function') {
                showToast('Application status updated successfully', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to update status', 'error');
            }
        }
    } catch (error) {
        console.error("Error updating status:", error);
        if (typeof showToast === 'function') {
            showToast('Error updating status', 'error');
        }
    } finally {
        restoreBtn();
    }
}

// ============================================
// FILTER FUNCTIONS
// ============================================

/**
 * Apply filters
 */
function applyFilters() {
    const jobId = document.getElementById("jobFilter").value;
    const status = document.getElementById("statusFilter").value;
    refreshJobApplications(jobId, status);
}

/**
 * Get current job filter value
 */
function getCurrentJobFilter() {
    const el = document.getElementById("jobFilter");
    return el ? el.value : '';
}

/**
 * Get current status filter value
 */
function getCurrentStatusFilter() {
    const el = document.getElementById("statusFilter");
    return el ? el.value : '';
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Escape HTML to prevent XSS
 */
function escapeHtmlApps(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Format file size
 */
function formatFileSizeApps(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0);
    return `${size} ${units[i]}`;
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
    if (typeof initFormValidation === 'function') initFormValidation('statusForm');
    if (typeof initModalAccessibility === 'function') {
        initModalAccessibility('detailModal', closeDetailModal);
        initModalAccessibility('statusModal', closeStatusModal);
    }
    
    await loadJobPostsForFilter();
    await refreshJobApplications();
});
