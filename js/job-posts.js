// Job Posts Management Module - INTERNAL
// Create, edit, open/close job circulars
// NO deletion of posts with existing applications

// ============================================
// SINGLE STATE ARRAY
// ============================================
let jobPosts = [];

// ============================================
// SINGLE REFRESH FUNCTION
// ============================================

/**
 * Refresh job posts list
 * @param {string} statusFilter - Optional status filter (Open, Closed)
 */
async function refreshJobPosts(statusFilter = '') {
    // Show loading state
    if (typeof showTableLoading === 'function') {
        showTableLoading('jobPostsTableBody', 7);
    }
    
    try {
        const payload = statusFilter ? { status: statusFilter } : {};
        const response = await request("getJobPosts", payload);
        
        if (response.success) {
            jobPosts = response.data || [];
            renderJobPostsTable();
            updateSummaryCards();
        } else {
            console.error("Failed to load job posts:", response.message);
            jobPosts = [];
            renderJobPostsTable();
            updateSummaryCards();
            if (typeof showToast === 'function') {
                showToast('Failed to load job posts', 'error');
            }
        }
    } catch (error) {
        console.error("Error loading job posts:", error);
        jobPosts = [];
        renderJobPostsTable();
        updateSummaryCards();
        if (typeof showToast === 'function') {
            showToast('Error loading job posts', 'error');
        }
    }
}

// ============================================
// RENDER FUNCTIONS
// ============================================

/**
 * Render job posts table
 */
function renderJobPostsTable() {
    const tbody = document.getElementById("jobPostsTableBody");
    if (!tbody) return;
    
    if (jobPosts.length === 0) {
        if (typeof showEmptyState === 'function') {
            showEmptyState('jobPostsTableBody', 'No job posts found. Click "Add Job Post" to create one.', 7, 'fa-briefcase');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                        No job posts found. Click "Add Job Post" to create one.
                    </td>
                </tr>
            `;
        }
        return;
    }
    
    tbody.innerHTML = jobPosts.map(job => `
        <tr class="border-b hover:bg-gray-50">
            <td class="px-4 py-3 font-medium">${escapeHtmlJobPosts(job.title)}</td>
            <td class="px-4 py-3">${escapeHtmlJobPosts(job.department)}</td>
            <td class="px-4 py-3">${escapeHtmlJobPosts(job.location)}</td>
            <td class="px-4 py-3">${job.employmentType}</td>
            <td class="px-4 py-3">${job.deadline}</td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 text-xs rounded-full ${job.status === 'Open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                    ${job.status}
                </span>
            </td>
            <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                    <button onclick="editJobPost('${job.id}')" 
                        class="text-blue-600 hover:text-blue-800" title="Edit">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </button>
                    ${job.status === 'Open' ? `
                        <button onclick="closeJobPost('${job.id}')" 
                            class="text-orange-600 hover:text-orange-800" title="Close Job">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path>
                            </svg>
                        </button>
                    ` : `
                        <button onclick="reopenJobPost('${job.id}')" 
                            class="text-green-600 hover:text-green-800" title="Reopen Job">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                            </svg>
                        </button>
                    `}
                    <button onclick="deleteJobPost('${job.id}')" 
                        class="text-red-600 hover:text-red-800" title="Delete">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * Update summary cards
 */
function updateSummaryCards() {
    const total = jobPosts.length;
    const open = jobPosts.filter(j => j.status === 'Open').length;
    const closed = jobPosts.filter(j => j.status === 'Closed').length;
    
    // Count expired but still open
    const today = getTodayISOJobPosts();
    const expiredOpen = jobPosts.filter(j => j.status === 'Open' && j.deadline < today).length;
    
    document.getElementById("totalPostsCount").textContent = total;
    document.getElementById("openPostsCount").textContent = open;
    document.getElementById("closedPostsCount").textContent = closed;
    document.getElementById("expiredPostsCount").textContent = expiredOpen;
}

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * Show add job post modal
 */
function showAddJobPostModal() {
    document.getElementById("modalTitle").textContent = "Add Job Post";
    document.getElementById("jobPostForm").reset();
    document.getElementById("jobPostId").value = '';
    
    // Set default deadline to 30 days from now
    const deadline = getFutureDateISO(30);
    document.getElementById("jobDeadline").value = deadline;
    
    document.getElementById("jobPostModal").classList.remove("hidden");
}

/**
 * Edit job post
 */
function editJobPost(jobId) {
    const job = jobPosts.find(j => String(j.id) === String(jobId));
    if (!job) return;
    
    document.getElementById("modalTitle").textContent = "Edit Job Post";
    document.getElementById("jobPostId").value = job.id;
    document.getElementById("jobTitle").value = job.title;
    document.getElementById("jobDepartment").value = job.department;
    document.getElementById("jobLocation").value = job.location;
    document.getElementById("jobEmploymentType").value = job.employmentType;
    document.getElementById("jobDeadline").value = job.deadline;
    document.getElementById("jobDescription").value = job.description;
    document.getElementById("jobRequirements").value = job.requirements;
    
    document.getElementById("jobPostModal").classList.remove("hidden");
}

/**
 * Close job post modal
 */
function closeJobPostModal() {
    document.getElementById("jobPostModal").classList.add("hidden");
}

/**
 * Save job post (add or update)
 */
async function saveJobPost(event) {
    event.preventDefault();
    
    const form = document.getElementById('jobPostForm');
    
    // Validate form
    if (typeof validateForm === 'function' && !validateForm('jobPostForm')) {
        return;
    }
    
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    const restoreBtn = typeof setButtonLoading === 'function' && submitBtn
        ? setButtonLoading(submitBtn, 'Saving...') 
        : () => {};
    
    const jobId = document.getElementById("jobPostId").value;
    const isEdit = !!jobId;
    
    const jobData = {
        id: jobId || 'JOB-' + Date.now(),
        title: document.getElementById("jobTitle").value.trim(),
        department: document.getElementById("jobDepartment").value.trim(),
        location: document.getElementById("jobLocation").value.trim(),
        employmentType: document.getElementById("jobEmploymentType").value,
        deadline: document.getElementById("jobDeadline").value,
        description: document.getElementById("jobDescription").value.trim(),
        requirements: document.getElementById("jobRequirements").value.trim(),
        status: isEdit ? (jobPosts.find(j => String(j.id) === String(jobId))?.status || 'Open') : 'Open',
        createdAt: isEdit ? (jobPosts.find(j => String(j.id) === String(jobId))?.createdAt || getTodayISOJobPosts()) : getTodayISOJobPosts()
    };
    
    // Validation
    if (!jobData.title || !jobData.department || !jobData.deadline) {
        if (typeof showToast === 'function') {
            showToast('Please fill in all required fields', 'error');
        }
        restoreBtn();
        return;
    }
    
    try {
        const action = isEdit ? "updateJobPost" : "addJobPost";
        const response = await request(action, jobData);
        
        if (response.success) {
            closeJobPostModal();
            refreshJobPosts(getCurrentStatusFilter());
            if (typeof showToast === 'function') {
                showToast(`Job post ${isEdit ? 'updated' : 'created'} successfully`, 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to save job post', 'error');
            }
        }
    } catch (error) {
        console.error("Error saving job post:", error);
        if (typeof showToast === 'function') {
            showToast('Error saving job post', 'error');
        }
    } finally {
        restoreBtn();
    }
}

/**
 * Close job post (stop accepting applications)
 */
async function closeJobPost(jobId) {
    const job = jobPosts.find(j => String(j.id) === String(jobId));
    if (!job) return;
    
    const jobName = job.title || 'this job post';
    
    let confirmed = false;
    if (typeof confirmStatusChange === 'function') {
        confirmed = await confirmStatusChange(jobName, 'Closed');
    } else {
        confirmed = confirm('Close this job post? It will no longer accept applications.');
    }
    
    if (!confirmed) return;
    
    try {
        const response = await request("updateJobPost", {
            ...job,
            status: 'Closed'
        });
        
        if (response.success) {
            refreshJobPosts(getCurrentStatusFilter());
            if (typeof showToast === 'function') {
                showToast('Job post closed successfully', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to close job post', 'error');
            }
        }
    } catch (error) {
        console.error("Error closing job post:", error);
        if (typeof showToast === 'function') {
            showToast('Error closing job post', 'error');
        }
    }
}

/**
 * Reopen job post
 */
async function reopenJobPost(jobId) {
    const job = jobPosts.find(j => String(j.id) === String(jobId));
    if (!job) return;
    
    const jobName = job.title || 'this job post';
    
    let confirmed = false;
    if (typeof confirmStatusChange === 'function') {
        confirmed = await confirmStatusChange(jobName, 'Open');
    } else {
        confirmed = confirm('Reopen this job post? It will start accepting applications again.');
    }
    
    if (!confirmed) return;
    
    try {
        const response = await request("updateJobPost", {
            ...job,
            status: 'Open'
        });
        
        if (response.success) {
            refreshJobPosts(getCurrentStatusFilter());
            if (typeof showToast === 'function') {
                showToast('Job post reopened successfully', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to reopen job post', 'error');
            }
        }
    } catch (error) {
        console.error("Error reopening job post:", error);
        if (typeof showToast === 'function') {
            showToast('Error reopening job post', 'error');
        }
    }
}

/**
 * Delete job post (only if no applications exist)
 */
async function deleteJobPost(jobId) {
    const job = jobPosts.find(j => String(j.id) === String(jobId));
    const jobName = job ? job.title : 'this job post';
    
    let confirmed = false;
    if (typeof confirmDelete === 'function') {
        confirmed = await confirmDelete(jobName);
    } else {
        confirmed = confirm('Delete this job post? This cannot be undone.');
    }
    
    if (!confirmed) return;
    
    try {
        const response = await request("deleteJobPost", { id: jobId });
        
        if (response.success) {
            refreshJobPosts(getCurrentStatusFilter());
            if (typeof showToast === 'function') {
                showToast('Job post deleted successfully', 'success');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast(response.message || 'Failed to delete job post', 'error');
            }
        }
    } catch (error) {
        console.error("Error deleting job post:", error);
        if (typeof showToast === 'function') {
            showToast('Error deleting job post', 'error');
        }
    }
}

// ============================================
// FILTER FUNCTIONS
// ============================================

/**
 * Apply status filter
 */
function applyStatusFilter() {
    const status = document.getElementById("statusFilter").value;
    refreshJobPosts(status);
}

/**
 * Get current status filter value
 */
function getCurrentStatusFilter() {
    const filterEl = document.getElementById("statusFilter");
    return filterEl ? filterEl.value : '';
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get today's date in ISO format
 */
function getTodayISOJobPosts() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get future date in ISO format
 */
function getFutureDateISO(daysAhead) {
    const now = new Date();
    now.setDate(now.getDate() + daysAhead);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtmlJobPosts(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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
    if (typeof initFormValidation === 'function') initFormValidation('jobPostForm');
    if (typeof initModalAccessibility === 'function') initModalAccessibility('jobPostModal', closeJobPostModal);
    
    await refreshJobPosts();
});
