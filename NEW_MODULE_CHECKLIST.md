# NEW_MODULE_CHECKLIST.md — Adding a New Module Safely

> Complete every step in order. Do NOT skip or reorder.

## Prerequisites

- [ ] Read `AUTH_CONTRACT.md`
- [ ] Read `CONTRIBUTING_AI.md`
- [ ] Confirm the module name and required actions with the project owner

---

## Step 1: Backend (Google Apps Script)

- [ ] Create `google-apps-script/ModuleName.gs` with handler functions
- [ ] Register all actions in `Code.gs` → `doPost()` switch statement
- [ ] Add permission mappings in `Code.gs` → `BACKEND_PERMISSIONS` matrix
- [ ] Ensure every non-public action passes through the centralized auth gate
- [ ] Test each action via direct POST to the GAS web app

## Step 2: Google Sheet (if applicable)

- [ ] Create the data sheet in the Google Spreadsheet
- [ ] Create the corresponding `googleDatabase/moduleName.html` view (if needed)

## Step 3: Frontend HTML

- [ ] Create `module-name.html`
- [ ] Include scripts in this exact order:
  ```html
  <script src="js/config.js"></script>
  <script src="js/utils.js"></script>
  <script src="js/api.js"></script>
  <script src="js/auth.js"></script>
  <script src="js/ux-utils.js"></script>
  <script src="js/module-name.js"></script>
  ```
- [ ] **Do NOT include `js/permissions.js`** — it is a tombstone file
- [ ] **Do NOT add `data-permission` attributes** to any elements
- [ ] Add navigation links to the sidebar (consistent with other pages)

## Step 4: Frontend JavaScript

- [ ] Create `js/module-name.js`
- [ ] Start with this exact init pattern:
  ```javascript
  document.addEventListener('DOMContentLoaded', async () => {
      const authed = await requireAuth();
      if (!authed) return;
      renderUserInfo('userInfo');
      // ... module initialization
  });
  ```
- [ ] Use `request(action, payload)` for ALL backend calls
- [ ] Handle errors with `showError(getErrorMessage(result))`
- [ ] **Do NOT add any permission checks, role checks, or access control logic**
- [ ] **Do NOT import or reference `permissions.js`**

## Step 5: Verify

- [ ] All UI elements render unconditionally (no role-based hiding)
- [ ] Backend correctly rejects unauthorized actions with `FORBIDDEN`
- [ ] `SESSION_EXPIRED` triggers redirect to login (handled by `api.js` automatically)
- [ ] No references to: `checkPageAccess`, `initPermissionUI`, `canView`, `canAdd`, `canEdit`, `canDelete`, `canFinalize`, `USE_BACKEND`, `mockDataStore`
- [ ] grep the codebase for forbidden patterns listed in `CONTRIBUTING_AI.md` §5

## Anti-Patterns — Do NOT Copy These

```javascript
// ❌ Old permission check — DELETED in Phase 5
if (!canView('ModuleName')) { redirectToLogin(); }

// ❌ Old permission UI — DELETED in Phase 5
initPermissionUI();

// ❌ Old page access check — DELETED in Phase 5
checkPageAccess('ModuleName');

// ❌ Mock fallback — DELETED in Phase 5
if (!USE_BACKEND) { return getMockData(); }

// ❌ Frontend role gating — FORBIDDEN
if (user.role !== 'Admin') { hideEditButton(); }
```

## Correct Pattern

```javascript
// ✅ Backend handles everything
const result = await request('getModuleData', { page: 1 });
if (!result.success) {
    showError(getErrorMessage(result));
    return;
}
renderData(result.data);
```
