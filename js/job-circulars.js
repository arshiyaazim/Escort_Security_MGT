// Job Circulars Module - PUBLIC FACING
// Lists open job posts for external candidates
// NO edit/delete functionality

// ============================================
// SINGLE STATE ARRAY
// ============================================
let jobPosts = [];

// ============================================
// SINGLE REFRESH FUNCTION
// ============================================

/**
 * Refresh job posts list - Only shows OPEN jobs
 */
async function refreshJobPosts() {
    try {
        const response = await request("getJobPosts", { status: "Open" });
        
        if (response.success) {
            jobPosts = response.data || [];
            renderJobPosts();
        } else {
            console.error("Failed to load job posts:", response.message);
            jobPosts = [];
            renderJobPosts();
        }
    } catch (error) {
        console.error("Error loading job posts:", error);
        jobPosts = [];
        renderJobPosts();
    }
}

// ============================================
// RENDER FUNCTIONS
// ============================================

/**
 * Render job posts as cards
 */
function renderJobPosts() {
    const container = document.getElementById("jobPostsContainer");
    if (!container) return;
    
    if (jobPosts.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
                <p class="text-gray-500 text-lg">No job openings available at this time</p>
                <p class="text-gray-400 text-sm mt-2">Please check back later for new opportunities</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = jobPosts.map(job => `
        <div class="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
            <div class="flex justify-between items-start mb-3">
                <h3 class="text-lg font-semibold text-gray-800">${escapeHtml(job.title)}</h3>
                <span class="px-2 py-1 text-xs rounded-full ${getEmploymentTypeClass(job.employmentType)}">
                    ${job.employmentType}
                </span>
            </div>
            
            <div class="space-y-2 text-sm text-gray-600 mb-4">
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                    </svg>
                    <span>${escapeHtml(job.department)}</span>
                </div>
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    <span>${escapeHtml(job.location)}</span>
                </div>
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                    <span>Deadline: <strong>${formatDeadline(job.deadline)}</strong></span>
                </div>
            </div>
            
            <p class="text-gray-600 text-sm mb-4 line-clamp-2">${escapeHtml(job.description)}</p>
            
            <div class="flex justify-between items-center pt-4 border-t">
                <button onclick="viewJobDetails('${job.id}')" 
                    class="text-blue-600 hover:text-blue-800 text-sm font-medium">
                    View Details
                </button>
                <a href="job-apply.html?jobId=${job.id}" 
                    class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium transition-colors">
                    Apply Now
                </a>
            </div>
        </div>
    `).join('');
}

/**
 * View job details in modal
 */
function viewJobDetails(jobId) {
    const job = jobPosts.find(j => String(j.id) === String(jobId));
    if (!job) return;
    
    const modal = document.getElementById("jobDetailModal");
    const content = document.getElementById("jobDetailContent");
    
    if (!modal || !content) return;
    
    content.innerHTML = `
        <div class="space-y-4">
            <div class="flex justify-between items-start">
                <h2 class="text-xl font-bold text-gray-800">${escapeHtml(job.title)}</h2>
                <span class="px-3 py-1 text-sm rounded-full ${getEmploymentTypeClass(job.employmentType)}">
                    ${job.employmentType}
                </span>
            </div>
            
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <span class="text-gray-500">Department:</span>
                    <span class="ml-2 font-medium">${escapeHtml(job.department)}</span>
                </div>
                <div>
                    <span class="text-gray-500">Location:</span>
                    <span class="ml-2 font-medium">${escapeHtml(job.location)}</span>
                </div>
                <div>
                    <span class="text-gray-500">Deadline:</span>
                    <span class="ml-2 font-medium">${formatDeadline(job.deadline)}</span>
                </div>
                <div>
                    <span class="text-gray-500">Posted:</span>
                    <span class="ml-2 font-medium">${job.createdAt}</span>
                </div>
            </div>
            
            <div>
                <h3 class="font-semibold text-gray-700 mb-2">Description</h3>
                <p class="text-gray-600 whitespace-pre-line">${escapeHtml(job.description)}</p>
            </div>
            
            <div>
                <h3 class="font-semibold text-gray-700 mb-2">Requirements</h3>
                <p class="text-gray-600 whitespace-pre-line">${escapeHtml(job.requirements)}</p>
            </div>
            
            <div class="pt-4 border-t flex justify-end gap-3">
                <button onclick="closeJobDetailModal()" 
                    class="px-4 py-2 text-gray-600 hover:text-gray-800">
                    Close
                </button>
                <a href="job-apply.html?jobId=${job.id}" 
                    class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-medium">
                    Apply Now
                </a>
            </div>
        </div>
    `;
    
    modal.classList.remove("hidden");
}

/**
 * Close job detail modal
 */
function closeJobDetailModal() {
    const modal = document.getElementById("jobDetailModal");
    if (modal) {
        modal.classList.add("hidden");
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get CSS class for employment type badge
 */
function getEmploymentTypeClass(type) {
    switch (type) {
        case 'Full-time':
            return 'bg-blue-100 text-blue-800';
        case 'Contract':
            return 'bg-purple-100 text-purple-800';
        case 'Temporary':
            return 'bg-orange-100 text-orange-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

/**
 * Format deadline date
 */
function formatDeadline(dateStr) {
    if (!dateStr) return 'N/A';
    
    const today = getTodayISO();
    const deadline = dateStr;
    
    if (deadline < today) {
        return `<span class="text-red-600">Expired</span>`;
    }
    
    // Calculate days remaining
    const todayParts = today.split('-');
    const deadlineParts = deadline.split('-');
    
    const todayDate = new Date(parseInt(todayParts[0]), parseInt(todayParts[1]) - 1, parseInt(todayParts[2]));
    const deadlineDate = new Date(parseInt(deadlineParts[0]), parseInt(deadlineParts[1]) - 1, parseInt(deadlineParts[2]));
    
    const diffTime = deadlineDate - todayDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 3) {
        return `<span class="text-orange-600">${dateStr} (${diffDays} days left)</span>`;
    }
    
    return dateStr;
}

/**
 * Get today's date in ISO format (locale-independent)
 */
function getTodayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    refreshJobPosts();
});
