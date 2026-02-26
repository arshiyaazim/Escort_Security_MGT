// File Upload System - Generic Infrastructure
// Reusable across all modules
// NO business logic - pure file handling

// ============================================
// CONFIGURATION
// ============================================
const FILE_UPLOAD_CONFIG = {
    maxFileSize: 10 * 1024 * 1024, // 10 MB
    allowedTypes: {
        image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        all: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    }
};

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate file size
 * @param {File} file - File object
 * @param {number} maxSize - Maximum size in bytes
 * @returns {Object} { valid: boolean, message: string }
 */
function validateFileSize(file, maxSize = FILE_UPLOAD_CONFIG.maxFileSize) {
    if (file.size > maxSize) {
        const maxMB = (maxSize / (1024 * 1024)).toFixed(1);
        const fileMB = (file.size / (1024 * 1024)).toFixed(2);
        return {
            valid: false,
            message: `File size (${fileMB} MB) exceeds maximum allowed (${maxMB} MB)`
        };
    }
    return { valid: true, message: '' };
}

/**
 * Validate file type
 * @param {File} file - File object
 * @param {string} category - Type category: 'image', 'document', or 'all'
 * @returns {Object} { valid: boolean, message: string }
 */
function validateFileType(file, category = 'all') {
    const allowedTypes = FILE_UPLOAD_CONFIG.allowedTypes[category] || FILE_UPLOAD_CONFIG.allowedTypes.all;
    
    if (!allowedTypes.includes(file.type)) {
        return {
            valid: false,
            message: `File type (${file.type || 'unknown'}) is not allowed. Allowed types: ${allowedTypes.join(', ')}`
        };
    }
    return { valid: true, message: '' };
}

/**
 * Validate file (size and type)
 * @param {File} file - File object
 * @param {Object} options - Validation options
 * @returns {Object} { valid: boolean, message: string }
 */
function validateFile(file, options = {}) {
    const { maxSize = FILE_UPLOAD_CONFIG.maxFileSize, typeCategory = 'all' } = options;
    
    // Check size
    const sizeCheck = validateFileSize(file, maxSize);
    if (!sizeCheck.valid) return sizeCheck;
    
    // Check type
    const typeCheck = validateFileType(file, typeCategory);
    if (!typeCheck.valid) return typeCheck;
    
    return { valid: true, message: '' };
}

// ============================================
// UPLOAD FUNCTIONS
// ============================================

/**
 * Upload a file to the backend
 * @param {Object} params - Upload parameters
 * @param {string} params.module - Module name (Employee, EscortDuty, etc.)
 * @param {string} params.recordId - Record ID to associate file with
 * @param {File} params.file - File object to upload
 * @param {Function} params.onProgress - Progress callback (optional)
 * @returns {Promise<Object>} Upload result with file metadata
 */
async function uploadFile({ module, recordId, file, onProgress }) {
    // Validate inputs
    if (!module || !recordId || !file) {
        return {
            success: false,
            message: 'Missing required parameters: module, recordId, or file'
        };
    }
    
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
        return {
            success: false,
            message: validation.message
        };
    }
    
    // Simulate progress (for demo - real implementation would track actual upload)
    if (onProgress) {
        onProgress(10);
        await delay(100);
        onProgress(30);
        await delay(100);
        onProgress(60);
        await delay(100);
        onProgress(90);
    }
    
    try {
        const response = await request("uploadFile", {
            module: module,
            recordId: recordId,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size
        });
        
        if (onProgress) {
            onProgress(100);
        }
        
        return response;
    } catch (error) {
        console.error("Upload error:", error);
        return {
            success: false,
            message: 'Upload failed: ' + (error.message || 'Unknown error')
        };
    }
}

/**
 * Get files for a specific module/record
 * @param {string} module - Module name
 * @param {string} recordId - Record ID (optional - if omitted, gets all for module)
 * @returns {Promise<Object>} Result with files array
 */
async function getFiles(module, recordId = '') {
    try {
        const response = await request("getFiles", {
            module: module,
            recordId: recordId
        });
        return response;
    } catch (error) {
        console.error("Get files error:", error);
        return {
            success: false,
            data: [],
            message: 'Failed to get files: ' + (error.message || 'Unknown error')
        };
    }
}

/**
 * Delete a file
 * @param {string} fileId - File ID
 * @returns {Promise<Object>} Result
 */
async function deleteFile(fileId) {
    if (!fileId) {
        return {
            success: false,
            message: 'File ID is required'
        };
    }
    
    try {
        const response = await request("deleteFile", { id: fileId });
        return response;
    } catch (error) {
        console.error("Delete file error:", error);
        return {
            success: false,
            message: 'Failed to delete file: ' + (error.message || 'Unknown error')
        };
    }
}

// ============================================
// UI COMPONENT GENERATORS
// ============================================

/**
 * Create a file upload component
 * @param {Object} config - Component configuration
 * @param {string} config.containerId - Container element ID
 * @param {string} config.module - Module name
 * @param {string} config.recordId - Record ID
 * @param {string} config.typeCategory - File type category ('image', 'document', 'all')
 * @param {boolean} config.multiple - Allow multiple files
 * @param {Function} config.onUploadComplete - Callback when upload completes
 */
function createUploadComponent(config) {
    const {
        containerId,
        module,
        recordId,
        typeCategory = 'all',
        multiple = false,
        onUploadComplete
    } = config;
    
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Upload container not found:', containerId);
        return;
    }
    
    const componentId = 'upload-' + Date.now();
    const acceptTypes = FILE_UPLOAD_CONFIG.allowedTypes[typeCategory] || FILE_UPLOAD_CONFIG.allowedTypes.all;
    
    container.innerHTML = `
        <div class="file-upload-component" id="${componentId}">
            <div class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-500 transition-colors">
                <input type="file" id="${componentId}-input" 
                    class="hidden" 
                    accept="${acceptTypes.join(',')}"
                    ${multiple ? 'multiple' : ''}>
                <label for="${componentId}-input" class="cursor-pointer block">
                    <svg class="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                    </svg>
                    <span class="text-sm text-gray-600">Click to select file or drag & drop</span>
                    <span class="text-xs text-gray-400 block mt-1">Max size: 10 MB</span>
                </label>
            </div>
            <div id="${componentId}-progress" class="hidden mt-2">
                <div class="flex items-center gap-2">
                    <div class="flex-1 bg-gray-200 rounded-full h-2">
                        <div id="${componentId}-progress-bar" class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                    <span id="${componentId}-progress-text" class="text-xs text-gray-600">0%</span>
                </div>
            </div>
            <div id="${componentId}-error" class="hidden mt-2 text-sm text-red-600"></div>
            <div id="${componentId}-success" class="hidden mt-2 text-sm text-green-600"></div>
        </div>
    `;
    
    // Attach event listener
    const fileInput = document.getElementById(`${componentId}-input`);
    fileInput.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        const progressDiv = document.getElementById(`${componentId}-progress`);
        const progressBar = document.getElementById(`${componentId}-progress-bar`);
        const progressText = document.getElementById(`${componentId}-progress-text`);
        const errorDiv = document.getElementById(`${componentId}-error`);
        const successDiv = document.getElementById(`${componentId}-success`);
        
        // Reset UI
        progressDiv.classList.remove('hidden');
        errorDiv.classList.add('hidden');
        successDiv.classList.add('hidden');
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        
        for (const file of files) {
            const result = await uploadFile({
                module: module,
                recordId: recordId,
                file: file,
                onProgress: (percent) => {
                    progressBar.style.width = `${percent}%`;
                    progressText.textContent = `${percent}%`;
                }
            });
            
            if (result.success) {
                successDiv.textContent = `File "${file.name}" uploaded successfully`;
                successDiv.classList.remove('hidden');
                
                if (onUploadComplete) {
                    onUploadComplete(result.data);
                }
            } else {
                errorDiv.textContent = result.message;
                errorDiv.classList.remove('hidden');
            }
        }
        
        // Reset file input
        fileInput.value = '';
        
        // Hide progress after delay
        setTimeout(() => {
            progressDiv.classList.add('hidden');
        }, 1500);
    });
    
    return componentId;
}

/**
 * Create a file list component
 * @param {Object} config - Component configuration
 * @param {string} config.containerId - Container element ID
 * @param {Array} config.files - Array of file metadata objects
 * @param {boolean} config.showDelete - Show delete button
 * @param {Function} config.onDelete - Delete callback
 */
function createFileListComponent(config) {
    const {
        containerId,
        files = [],
        showDelete = true,
        onDelete
    } = config;
    
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('File list container not found:', containerId);
        return;
    }
    
    if (!files || files.length === 0) {
        container.innerHTML = `
            <div class="text-sm text-gray-500 text-center py-4">
                No files uploaded
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="file-list-component space-y-2">
            ${files.map(file => `
                <div class="flex items-center justify-between p-2 bg-gray-50 rounded-lg" data-file-id="${file.id}">
                    <div class="flex items-center gap-3">
                        ${getFileIcon(file.fileType)}
                        <div>
                            <a href="${file.driveUrl}" target="_blank" class="text-sm text-blue-600 hover:underline">
                                ${escapeHtmlForUpload(file.fileName)}
                            </a>
                            <div class="text-xs text-gray-500">
                                ${formatFileSize(file.fileSize)} • ${file.uploadedAt}
                            </div>
                        </div>
                    </div>
                    ${showDelete ? `
                        <button onclick="handleFileDelete('${file.id}', '${containerId}')" 
                            class="text-red-500 hover:text-red-700 p-1" title="Delete file">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;
    
    // Store onDelete callback for use by handleFileDelete
    if (onDelete) {
        container.dataset.onDelete = 'true';
        window[`fileListOnDelete_${containerId}`] = onDelete;
    }
}

/**
 * Handle file deletion from list
 * @param {string} fileId - File ID
 * @param {string} containerId - Container ID for callback lookup
 */
async function handleFileDelete(fileId, containerId) {
    if (!confirm('Are you sure you want to delete this file?')) {
        return;
    }
    
    const result = await deleteFile(fileId);
    
    if (result.success) {
        // Remove from DOM
        const fileElement = document.querySelector(`[data-file-id="${fileId}"]`);
        if (fileElement) {
            fileElement.remove();
        }
        
        // Call onDelete callback if exists
        const callback = window[`fileListOnDelete_${containerId}`];
        if (callback) {
            callback(fileId);
        }
    } else {
        alert('Failed to delete file: ' + (result.message || 'Unknown error'));
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get file icon SVG based on file type
 * @param {string} fileType - MIME type
 * @returns {string} SVG HTML
 */
function getFileIcon(fileType) {
    if (fileType && fileType.startsWith('image/')) {
        return `<svg class="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
        </svg>`;
    }
    
    return `<svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
    </svg>`;
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0);
    
    return `${size} ${units[i]}`;
}

/**
 * Escape HTML for file upload component
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtmlForUpload(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Delay helper for progress simulation
 * @param {number} ms - Milliseconds
 * @returns {Promise}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// DRAG & DROP SUPPORT
// ============================================

/**
 * Enable drag & drop on an upload component
 * @param {string} componentId - Upload component ID
 * @param {Object} uploadConfig - Upload configuration
 */
function enableDragDrop(componentId, uploadConfig) {
    const component = document.getElementById(componentId);
    if (!component) return;
    
    const dropZone = component.querySelector('.border-dashed');
    if (!dropZone) return;
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-blue-500', 'bg-blue-50');
    });
    
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-blue-500', 'bg-blue-50');
    });
    
    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-blue-500', 'bg-blue-50');
        
        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;
        
        // Trigger file input change event programmatically
        const fileInput = component.querySelector('input[type="file"]');
        if (fileInput) {
            // Create a new DataTransfer to set files
            const dt = new DataTransfer();
            for (const file of files) {
                dt.items.add(file);
            }
            fileInput.files = dt.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
}
