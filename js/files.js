// File Upload System - Production Module Controller
// All operations go through backend API via request()
// NO permission checks — backend is the sole authority

let currentUploadComponentId = null;

/**
 * Initialize the Files module on page load
 */
document.addEventListener('DOMContentLoaded', async () => {
    const authed = await requireAuth();
    if (!authed) return;
    renderUserInfo('userInfo');
    loadFiles();
});

/**
 * Prepare the upload component with selected configuration
 */
function prepareUpload() {
    const module = document.getElementById('uploadModule').value;
    const recordId = document.getElementById('uploadRecordId').value.trim();

    if (!module) {
        showError('Please select a module.');
        return;
    }
    if (!recordId) {
        showError('Please enter a record ID.');
        return;
    }

    const typeCategory = document.getElementById('uploadType').value;

    // Create upload component using file-upload.js infrastructure
    currentUploadComponentId = createUploadComponent({
        containerId: 'uploadContainer',
        module: module,
        recordId: recordId,
        typeCategory: typeCategory,
        multiple: false,
        onUploadComplete: (fileData) => {
            console.log('Upload complete:', fileData);
            loadFiles();
        }
    });

    // Enable drag & drop
    if (currentUploadComponentId) {
        enableDragDrop(currentUploadComponentId, {
            module: module,
            recordId: recordId,
            typeCategory: typeCategory
        });
    }
}

/**
 * Load files from backend with optional filters
 */
async function loadFiles() {
    const filterModule = document.getElementById('filterModule').value;
    const filterRecordId = document.getElementById('filterRecordId').value.trim();

    const tbody = document.getElementById('filesTableBody');
    tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-500">Loading files...</td></tr>';

    try {
        const payload = {};
        if (filterModule) payload.module = filterModule;
        if (filterRecordId) payload.recordId = filterRecordId;

        const result = await request('getFiles', payload);

        if (!result.success) {
            showError(getErrorMessage(result));
            tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-red-500">Failed to load files</td></tr>';
            return;
        }

        const files = result.data || [];
        renderFileTable(files);
    } catch (error) {
        console.error('Error loading files:', error);
        tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-red-500">Error loading files</td></tr>';
    }
}

/**
 * Render file table rows
 * @param {Array} files - Array of file metadata objects
 */
function renderFileTable(files) {
    const tbody = document.getElementById('filesTableBody');

    if (!files || files.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-500">No files found</td></tr>';
        return;
    }

    tbody.innerHTML = files.map((file, index) => `
        <tr class="border-b border-gray-100 hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-600">${index + 1}</td>
            <td class="px-4 py-3 text-sm">
                <a href="${escapeAttr(file.driveUrl)}" target="_blank" class="text-blue-600 hover:underline">
                    ${escapeHtml(file.fileName)}
                </a>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(file.module)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(file.recordId)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${formatFileSize(file.fileSize)}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(file.uploadedBy || '-')}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(file.uploadedAt || '-')}</td>
            <td class="px-4 py-3 text-sm">
                <button
                    onclick="confirmDeleteFile('${escapeAttr(file.id)}')"
                    class="text-red-500 hover:text-red-700 text-sm font-medium"
                    title="Delete file"
                >
                    Delete
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Confirm and delete a file
 * @param {string} fileId - File ID to delete
 */
async function confirmDeleteFile(fileId) {
    if (!confirm('Are you sure you want to delete this file?')) {
        return;
    }

    try {
        const result = await request('deleteFile', { id: fileId });

        if (result.success) {
            loadFiles();
        } else {
            showError(getErrorMessage(result));
        }
    } catch (error) {
        console.error('Error deleting file:', error);
        showError('Failed to delete file.');
    }
}

/**
 * Escape HTML entities for safe rendering
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Escape string for use in HTML attributes
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
