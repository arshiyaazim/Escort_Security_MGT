// Job Application Module - PUBLIC FACING
// Allows candidates to submit applications
// NO authentication required

// ============================================
// SINGLE STATE OBJECT
// ============================================
let currentJob = null;
let applicationId = null;  // Set after successful submission

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the application form
 * Loads job details from URL parameter
 */
async function initApplicationForm() {
    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get('jobId');
    
    if (!jobId) {
        showError("No job specified. Please select a job from the careers page.");
        return;
    }
    
    try {
        const response = await request("getJobPosts", {});
        
        if (response.success) {
            currentJob = response.data.find(j => String(j.id) === String(jobId));
            
            if (!currentJob) {
                showError("Job not found. The position may have been removed.");
                return;
            }
            
            if (currentJob.status !== 'Open') {
                showError("This job is no longer accepting applications.");
                return;
            }
            
            renderJobInfo();
            showApplicationForm();
        } else {
            showError("Failed to load job details. Please try again later.");
        }
    } catch (error) {
        console.error("Error loading job:", error);
        showError("An error occurred. Please try again later.");
    }
}

// ============================================
// RENDER FUNCTIONS
// ============================================

/**
 * Render job information header
 */
function renderJobInfo() {
    const container = document.getElementById("jobInfoContainer");
    if (!container || !currentJob) return;
    
    container.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between items-start">
            <div>
                <h2 class="text-xl font-bold text-gray-800">${escapeHtmlApply(currentJob.title)}</h2>
                <div class="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                    <span class="flex items-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                        </svg>
                        ${escapeHtmlApply(currentJob.department)}
                    </span>
                    <span class="flex items-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                        ${escapeHtmlApply(currentJob.location)}
                    </span>
                    <span class="px-2 py-0.5 rounded-full text-xs ${getEmploymentTypeClassApply(currentJob.employmentType)}">
                        ${currentJob.employmentType}
                    </span>
                </div>
            </div>
            <div class="mt-3 md:mt-0 text-sm text-gray-500">
                Application Deadline: <strong>${currentJob.deadline}</strong>
            </div>
        </div>
    `;
}

/**
 * Show application form
 */
function showApplicationForm() {
    document.getElementById("loadingState").classList.add("hidden");
    document.getElementById("errorState").classList.add("hidden");
    document.getElementById("applicationForm").classList.remove("hidden");
    document.getElementById("successState").classList.add("hidden");
}

/**
 * Show error state
 */
function showError(message) {
    document.getElementById("loadingState").classList.add("hidden");
    document.getElementById("applicationForm").classList.add("hidden");
    document.getElementById("successState").classList.add("hidden");
    
    const errorState = document.getElementById("errorState");
    const errorMessage = document.getElementById("errorMessage");
    
    errorMessage.textContent = message;
    errorState.classList.remove("hidden");
}

/**
 * Show success state
 */
function showSuccess() {
    document.getElementById("loadingState").classList.add("hidden");
    document.getElementById("errorState").classList.add("hidden");
    document.getElementById("applicationForm").classList.add("hidden");
    
    const successState = document.getElementById("successState");
    const appIdDisplay = document.getElementById("applicationIdDisplay");
    
    if (appIdDisplay && applicationId) {
        appIdDisplay.textContent = applicationId;
    }
    
    successState.classList.remove("hidden");
}

// ============================================
// FORM SUBMISSION
// ============================================

/**
 * Submit application
 */
async function submitApplication(event) {
    event.preventDefault();
    
    if (!currentJob) {
        alert("Job information not loaded. Please refresh the page.");
        return;
    }
    
    // Get form values
    const formData = {
        applicantName: document.getElementById("applicantName").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        email: document.getElementById("email").value.trim(),
        address: document.getElementById("address").value.trim(),
        education: document.getElementById("education").value.trim(),
        experience: document.getElementById("experience").value.trim()
    };
    
    // Validate required fields
    if (!formData.applicantName || !formData.phone || !formData.email) {
        alert("Please fill in all required fields (Name, Phone, Email).");
        return;
    }
    
    // Validate email format
    if (!isValidEmail(formData.email)) {
        alert("Please enter a valid email address.");
        return;
    }
    
    // Generate application ID
    applicationId = 'APP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
    
    // Prepare application payload
    const applicationPayload = {
        id: applicationId,
        jobId: currentJob.id,
        jobTitle: currentJob.title,
        applicantName: formData.applicantName,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        education: formData.education,
        experience: formData.experience,
        appliedDate: getTodayISOApply(),
        status: 'Submitted',
        notes: ''
    };
    
    // Disable submit button
    const submitBtn = document.getElementById("submitBtn");
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";
    
    try {
        const response = await request("addJobApplication", applicationPayload);
        
        if (response.success) {
            // Show success state
            showSuccess();
        } else {
            alert(response.message || "Failed to submit application. Please try again.");
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    } catch (error) {
        console.error("Error submitting application:", error);
        alert("An error occurred. Please try again.");
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// ============================================
// FILE UPLOAD HANDLING
// ============================================

/**
 * Initialize file upload components after application is created
 * Files are linked to the application via applicationId
 */
function initFileUploads() {
    if (!applicationId) {
        console.error("Cannot initialize file uploads without application ID");
        return;
    }
    
    // Photo upload
    if (typeof createUploadComponent === 'function') {
        createUploadComponent({
            containerId: 'photoUploadContainer',
            module: 'JobApplication',
            recordId: applicationId,
            typeCategory: 'image',
            multiple: false,
            onUploadComplete: (fileData) => {
                console.log('Photo uploaded:', fileData);
                refreshUploadedFiles();
            }
        });
        
        // CV upload
        createUploadComponent({
            containerId: 'cvUploadContainer',
            module: 'JobApplication',
            recordId: applicationId,
            typeCategory: 'document',
            multiple: false,
            onUploadComplete: (fileData) => {
                console.log('CV uploaded:', fileData);
                refreshUploadedFiles();
            }
        });
        
        // Certificates upload
        createUploadComponent({
            containerId: 'certificatesUploadContainer',
            module: 'JobApplication',
            recordId: applicationId,
            typeCategory: 'all',
            multiple: true,
            onUploadComplete: (fileData) => {
                console.log('Certificate uploaded:', fileData);
                refreshUploadedFiles();
            }
        });
    }
}

/**
 * Refresh uploaded files list
 */
async function refreshUploadedFiles() {
    if (!applicationId) return;
    
    const filesResponse = await getFiles('JobApplication', applicationId);
    const container = document.getElementById("uploadedFilesList");
    
    if (!container) return;
    
    if (!filesResponse.data || filesResponse.data.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500">No files uploaded yet</p>';
        return;
    }
    
    container.innerHTML = `
        <ul class="space-y-1 text-sm">
            ${filesResponse.data.map(f => `
                <li class="flex items-center gap-2 text-gray-600">
                    <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    ${escapeHtmlApply(f.fileName)}
                </li>
            `).join('')}
        </ul>
    `;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Get today's date in ISO format
 */
function getTodayISOApply() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get CSS class for employment type badge
 */
function getEmploymentTypeClassApply(type) {
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
 * Escape HTML to prevent XSS
 */
function escapeHtmlApply(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initApplicationForm();
});
