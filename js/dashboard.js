// Dashboard refresh contract
// Manual refresh only - NO automatic updates
// READ-ONLY - Dashboard must NEVER modify module data

/**
 * Refresh the dashboard - MUST be called explicitly
 * Dashboard NEVER auto-updates
 * This is the ONLY entry point for dashboard data updates
 * @param {string} reason - The reason for the refresh request
 */
async function refreshDashboard(reason) {
    // Log refresh request to console
    console.log("Dashboard refresh requested. Reason: " + reason);
    
    // Update UI with last refresh reason
    const refreshReasonElement = document.getElementById('lastRefreshReason');
    if (refreshReasonElement) {
        refreshReasonElement.textContent = "Last refresh reason: " + reason;
    }

    // Fetch dashboard stats (READ-ONLY)
    try {
        const response = await request("getDashboardStats", {});
        if (response.success && response.data) {
            renderDashboardStats(response.data);
        } else {
            console.error("Failed to fetch dashboard stats:", response.message);
        }
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
    }
}

/**
 * Render dashboard statistics
 * @param {object} stats - Stats object from API
 */
function renderDashboardStats(stats) {
    // Employee stats
    setStatValue('statTotalEmployees', stats.employees?.total || 0);
    setStatValue('statActiveEmployees', stats.employees?.active || 0);
    
    // Guard duty stats
    setStatValue('statGuardDutyToday', stats.guardDuty?.todayTotal || 0);
    setStatValue('statDayShift', stats.guardDuty?.todayDayShift || 0);
    setStatValue('statNightShift', stats.guardDuty?.todayNightShift || 0);
    setStatValue('statPresent', stats.guardDuty?.present || 0);
    setStatValue('statAbsent', stats.guardDuty?.absent || 0);
    setStatValue('statLate', stats.guardDuty?.late || 0);
    
    // File upload stats
    setStatValue('statTotalFiles', stats.files?.total || 0);
    setStatValue('statTodayFiles', stats.files?.todayUploads || 0);
}

/**
 * Set stat card value
 * @param {string} elementId - Element ID
 * @param {number} value - Stat value
 */
function setStatValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

// ============================================
// CROSS-TAB DIRTY FLAG LISTENER
// ============================================
// When another tab calls markDashboardDirty(), the 'storage' event fires here.
// We auto-refresh the dashboard so the user sees up-to-date stats.
window.addEventListener('storage', function (e) {
    if (e.key !== 'dashboardDirty' || !e.newValue) return;
    try {
        const info = JSON.parse(e.newValue);
        console.log('[dashboard] cross-tab dirty flag from:', info.source);
        refreshDashboard('cross-tab:' + (info.source || 'unknown'));
    } catch (err) {
        // Malformed value — ignore
    }
});

// Also check on page load in case the flag was set while no dashboard tab existed
document.addEventListener('DOMContentLoaded', function () {
    try {
        const raw = localStorage.getItem('dashboardDirty');
        if (raw) {
            const info = JSON.parse(raw);
            // Only act if the flag is less than 1 minute old
            if (Date.now() - (info.ts || 0) < 60000) {
                console.log('[dashboard] stale dirty flag on load from:', info.source);
                refreshDashboard('stale-flag:' + (info.source || 'unknown'));
            }
            localStorage.removeItem('dashboardDirty');
        }
    } catch (e) {
        // ignore
    }
});
