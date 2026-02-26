// ============================================
// TOMBSTONE — permissions.js DELETED (Phase 5)
// ============================================
// This file previously contained a client-side permission matrix,
// role-based UI gating helpers, and page access checks.
// ALL code was removed in Phase 5 (Final Cleanup) because:
//
//   1. Backend (Code.gs BACKEND_PERMISSIONS + ACTION_PERMISSIONS) is the
//      SOLE authority for permissions. See AUTH_CONTRACT.md.
//   2. No frontend file referenced any function from this file.
//   3. Client-side permission checks are security theater —
//      DevTools can bypass them trivially.
//
// DELETED FUNCTIONS:
//   PERMISSIONS, MODULE_PAGES, loadPermissions(), getCurrentPermissions(),
//   canView(), canAdd(), canEdit(), canDelete(), canFinalize(),
//   getVisibleMenuItems(), applyPermissionToButton(), hideIfNoPermission(),
//   showPermissionDenied(), checkPageAccess(), initPermissionUI()
//
// DO NOT re-add permission logic to the frontend.
// DO NOT create a new permissions file.
// If you need to add a module, see NEW_MODULE_CHECKLIST.md.
// If you are an AI agent, see CONTRIBUTING_AI.md.
//
// This file is safe to delete from the filesystem.
// It is kept as a zero-code tombstone to prevent accidental re-creation.
// ============================================
