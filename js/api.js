// Generic API layer — backend communication only
// INVARIANT: Frontend must NEVER enforce permissions.
// INVARIANT: Backend (Code.gs) is the sole authority for all access control.
// See AUTH_CONTRACT.md for the full authorization contract.
// See CONTRIBUTING_AI.md before modifying this file.

// ============================================
// BACKEND CONFIGURATION
// ============================================
const BASE_URL = 'https://script.google.com/macros/s/AKfycbyx3gRjNdhTDnO-uoxw4YG7ZnAIG5q2mnzd1yMY8bmKqRFLOY8rpSDaTo2eqf2dS-Bo7A/exec';// ============================================
// ERROR HANDLING UTILITIES
// ============================================

/**
 * Display error message to user
 * @param {string} message - Error message to display
 * @param {string} type - Error type (error, warning, info)
 */
function showError(message, type = 'error') {
    // Try to use a toast notification if available
    if (typeof showToast === 'function') {
        showToast(message, type);
        return;
    }
    
    // Fallback to alert for critical errors
    if (type === 'error') {
        alert('Error: ' + message);
    } else {
        console.warn(type + ':', message);
    }
}

/**
 * Handle API error response and return user-friendly message
 * @param {object} response - API response object
 * @returns {string} User-friendly error message
 */
function getErrorMessage(response) {
    if (!response) {
        return 'An unknown error occurred. Please try again.';
    }
    
    // Backend-provided error message
    if (response.message) {
        // Map backend errors to user-friendly messages
        switch (response.error) {
            case 'SESSION_EXPIRED':
            case 'UNAUTHORIZED':
                return 'Your session has expired. Please log in again.';
            case 'FORBIDDEN':
                return 'You do not have permission to perform this action.';
            case 'AUTH_REQUIRED':  // Legacy code — kept for backward compatibility
                return 'Your session has expired. Please log in again.';
            case 'POST_REQUEST_ERROR':
                return 'Request failed. Please check your connection and try again.';
            case 'SERVER_ERROR':
                return 'Server error. Please try again later.';
            case 'PARSE_ERROR':
                return 'Unable to connect to the server.';
            case 'NETWORK_ERROR':
            case 'FETCH_ERROR':
                return 'Network error. Please check your internet connection.';
            default:
                return response.message;
        }
    }
    
    return 'An error occurred. Please try again.';
}

/**
 * Generic API request function
 * Sends action + payload to the Google Apps Script backend.
 *
 * WARNING TO FUTURE DEVELOPERS / AI AGENTS:
 *   DO NOT add permission checks, role checks, or access control logic here.
 *   DO NOT re-introduce mock handlers or a USE_BACKEND toggle.
 *   The backend (Code.gs) is the sole authority. This function is a transport layer only.
 *   See CONTRIBUTING_AI.md and AUTH_CONTRACT.md.
 *
 * @param {string} action - The action name to execute
 * @param {object} payload - The data payload for the request
 * @returns {Promise<object>} Response from backend
 */
async function request(action, payload = {}) {
    try {
        const token = (typeof getSessionToken === 'function') ? getSessionToken() : null;

        const response = await fetch(BASE_URL, {
            method: 'POST',
            redirect: 'follow',
            mode: 'cors',
            credentials: 'omit',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify({
                action: action,
                payload: payload,
                token: token
            })
        });

        // Parse response
        let result;
        try {
            result = await response.json();
        } catch (parseError) {
            console.error('Failed to parse response:', parseError);
            return {
                success: false,
                action: action,
                data: null,
                error: 'PARSE_ERROR',
                message: 'Failed to parse server response. The server may be down or returning invalid data.'
            };
        }

        // Surface backend errors clearly
        if (!result.success) {
            console.error('Backend error:', {
                action: action,
                error: result.error,
                message: result.message
            });

            // Auto-redirect on session expiry for all non-auth actions
            if (result.error === 'SESSION_EXPIRED' || result.error === 'UNAUTHORIZED' || result.error === 'AUTH_REQUIRED') {
                if (action !== 'login' && action !== 'logout') {
                    if (typeof handleSessionExpired === 'function') {
                        handleSessionExpired();
                    }
                    return result;
                }
            }

            if (result.error === 'POST_REQUEST_ERROR') {
                console.error('POST body lost - possible redirect issue');
            }

            if (result.error === 'SERVER_ERROR') {
                console.error('Server error:', result.message);
            }
        }

        return result;

    } catch (error) {
        console.error('Network request failed:', error);

        let errorType = 'NETWORK_ERROR';
        let errorMessage = 'Network error: ' + error.message;

        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorType = 'FETCH_ERROR';
            errorMessage = 'Unable to connect to server. Please check your internet connection.';
        }

        return {
            success: false,
            action: action,
            data: null,
            error: errorType,
            message: errorMessage
        };
    }
}
