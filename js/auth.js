// Authentication & Session Management — single session authority.
// INVARIANT: Frontend must NEVER enforce permissions.
// INVARIANT: Backend (Code.gs) is the sole authority for all access control.
// Canonical accessor: getSessionToken() — returns sessionId only.
// See AUTH_CONTRACT.md for the full authorization flow.
// See CONTRIBUTING_AI.md before modifying this file.

// ============================================
// SESSION STORAGE KEY
// ============================================
const SESSION_KEY = 'alaqsa_hrm_session';

// ============================================
// SESSION ACCESSORS
// ============================================
// getSessionToken()  — CANONICAL: returns token string only (for auth)
// getCurrentUser()   — DISPLAY: returns cached user data (for UI rendering)
// Both read from the same localStorage entry.
// Only getSessionToken() is used for authentication decisions.
// ============================================

/**
 * Get session token — CANONICAL session accessor
 * Returns ONLY the session token string for backend authentication.
 * This is the single source of truth for session identity.
 *
 * @returns {string|null} Session token or null if not logged in
 */
function getSessionToken() {
    try {
        const session = localStorage.getItem(SESSION_KEY);
        if (!session) return null;
        const data = JSON.parse(session);
        return (data && data.token) ? data.token : null;
    } catch (e) {
        return null;
    }
}

/**
 * Get current logged-in user — CACHED DISPLAY DATA (non-authoritative)
 * Returns cached user info for UI rendering (username, role badge, etc.).
 *
 * NOTE: username and role are cached from the login response.
 * They are for DISPLAY ONLY — the backend is the sole authority for
 * permissions. Do NOT use this for access control decisions.
 * See AUTH_CONTRACT.md §1.
 *
 * @returns {object|null} User object or null if not logged in
 */
function getCurrentUser() {
    try {
        const session = localStorage.getItem(SESSION_KEY);
        if (!session) return null;

        const user = JSON.parse(session);

        // Require token at minimum — it is the canonical session field
        if (!user || !user.token || !user.username) {
            return null;
        }

        return user;
    } catch (error) {
        console.error('Error reading session:', error);
        return null;
    }
}

/**
 * Set current user session
 * @param {object} user - User object to store
 */
function setCurrentUser(user) {
    if (!user) {
        localStorage.removeItem(SESSION_KEY);
        return;
    }
    
    // Store all necessary fields including token
    const sessionData = {
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status,
        token: user.token || null
    };
    
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
}

/**
 * Clear current session (logout)
 */
function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

/**
 * Login user
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<object>} Login result
 */
async function login(username, password) {
    if (!username || !password) {
        return {
            success: false,
            message: 'Username and password are required'
        };
    }
    
    try {
        const response = await request('login', {
            username: username,
            password: password
        });
        
        if (response.success && response.data) {
            // Check if user is disabled
            if (response.data.status === 'Disabled') {
                return {
                    success: false,
                    message: 'Your account has been disabled. Please contact an administrator.'
                };
            }
            
            setCurrentUser(response.data);
            return {
                success: true,
                message: 'Login successful',
                data: response.data
            };
        }
        
        // Use improved error message handling
        return {
            success: false,
            message: getErrorMessage(response)
        };
    } catch (error) {
        console.error('Login error:', error);
        return {
            success: false,
            message: 'An error occurred during login. Please try again.'
        };
    }
}

/**
 * Logout current user
 * Uses getSessionToken() — single session authority.
 * Always clears local session and redirects deterministically.
 */
async function logout() {
    const token = getSessionToken();
    // Best-effort backend logout — don't block on failure
    if (token) {
        try {
            await request('logout', { token: token });
        } catch (error) {
            console.error('Backend logout error (continuing):', error);
        }
    }
    // Always clear local session and redirect
    clearSession();
    window.location.href = 'login.html';
}

/**
 * Handle session expiry — clear session, notify user, redirect to login.
 * Called when backend returns SESSION_EXPIRED or UNAUTHORIZED.
 * Uses alert() to ensure message is shown before redirect (no partial UI state).
 */
function handleSessionExpired() {
    clearSession();
    alert('Your session has expired. Please log in again.');
    window.location.href = 'login.html';
}

/**
 * Check if user has a session token
 * Only checks token existence — no role or status checks.
 * Backend validates actual session validity on API calls.
 * @returns {boolean}
 */
function isAuthenticated() {
    return getSessionToken() !== null;
}

/**
 * Require authentication — verify session with backend
 * On protected pages: check token exists locally, then validate
 * with a lightweight backend call (getDashboardStats).
 *
 * Async — callers should await this function.
 * If session is invalid, request() auto-redirects via handleSessionExpired().
 *
 * @returns {Promise<boolean>} True if authenticated
 */
async function requireAuth() {
    // Fast local check — no token means definitely not logged in
    if (!getSessionToken()) {
        window.location.href = 'login.html';
        return false;
    }

    // Validate session with backend using lightweight probe.
    // getDashboardStats requires auth (GuardDuty/canView — all roles have it).
    // If session is expired, request() will call handleSessionExpired().
    try {
        await request('getDashboardStats', {});
    } catch (e) {
        // Network error — allow proceeding (offline tolerance)
        console.warn('Session validation skipped (network error):', e.message);
    }

    return true;
}

// ============================================
// USER INFO DISPLAY
// ============================================

/**
 * Render user info in header
 * @param {string} containerId - Container element ID
 */
function renderUserInfo(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const user = getCurrentUser();
    
    if (!user) {
        container.innerHTML = `
            <a href="login.html" class="text-sm text-blue-600 hover:underline">Login</a>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="text-right">
                <div class="text-sm font-medium text-gray-700">${escapeHtmlAuth(user.username)}</div>
                <div class="text-xs text-gray-500">${user.role}</div>
            </div>
            <button onclick="logout()" 
                class="text-sm text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
                title="Logout">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                </svg>
            </button>
        </div>
    `;
}

/**
 * Escape HTML for auth display
 */
function escapeHtmlAuth(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================
// ROLE DISPLAY HELPERS
// ============================================

/**
 * Get role badge HTML
 * @param {string} role - Role name
 * @returns {string} HTML for role badge
 */
function getRoleBadge(role) {
    switch (role) {
        case 'Admin':
            return '<span class="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Admin</span>';
        case 'Supervisor':
            return '<span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">Supervisor</span>';
        case 'Viewer':
            return '<span class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">Viewer</span>';
        default:
            return '<span class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">Unknown</span>';
    }
}

/**
 * Get status badge HTML
 * @param {string} status - Status (Active, Disabled)
 * @returns {string} HTML for status badge
 */
function getStatusBadgeAuth(status) {
    switch (status) {
        case 'Active':
            return '<span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Active</span>';
        case 'Disabled':
            return '<span class="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Disabled</span>';
        default:
            return '<span class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">Unknown</span>';
    }
}
