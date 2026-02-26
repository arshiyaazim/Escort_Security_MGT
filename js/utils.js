// Utility helpers only
// No business logic

/**
 * Returns today's date in ISO format (YYYY-MM-DD)
 * Uses locale-independent date components
 * @returns {string} Date in YYYY-MM-DD format
 */
function getTodayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Mark the dashboard as dirty so other tabs/pages know to refresh.
 * Writes a timestamp + source to localStorage under 'dashboardDirty'.
 * The dashboard page listens for 'storage' events on this key.
 * @param {string} source - module name that triggered the change
 */
function markDashboardDirty(source) {
    try {
        localStorage.setItem('dashboardDirty', JSON.stringify({
            source: source || 'unknown',
            ts: Date.now()
        }));
    } catch (e) {
        // localStorage unavailable (private browsing, etc.) — fail silently
    }
}
