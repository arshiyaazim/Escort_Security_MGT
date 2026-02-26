# CONTRIBUTING_AI.md — Rules for AI Agents

> **This file is mandatory reading before any AI agent modifies the codebase.**

## 1. Absolute Rules

| Rule | Detail |
|------|--------|
| **NO client-side permission logic** | The frontend must NEVER check roles, permissions, or access rights. Backend (Code.gs) is the sole authority. |
| **NO mock handlers** | The `USE_BACKEND` toggle and mock data store were deleted in Phase 5. Do not re-introduce them. |
| **NO `permissions.js` resurrection** | The file is a tombstone. Do not add executable code to it or create a replacement. |
| **NO `data-permission` attributes** | Removed in Phase 5. Do not add `data-permission`, `data-hide-no-permission`, or similar DOM gating. |
| **NO duplicate session accessors** | `getSessionToken()` in `auth.js` is the single canonical accessor. Do not create alternatives in other files. |

## 2. Authoritative Files

| File | Purpose |
|------|---------|
| `google-apps-script/Code.gs` | Backend entry point — centralized auth gate, `BACKEND_PERMISSIONS` matrix |
| `AUTH_CONTRACT.md` | Full authorization contract between frontend and backend |
| `NEW_MODULE_CHECKLIST.md` | Step-by-step checklist for adding a new module safely |
| `js/auth.js` | Single session authority — all auth flows |
| `js/api.js` | Transport layer only — sends requests to backend, handles errors |

## 3. Where Permissions Live

```
ONLY HERE → google-apps-script/Code.gs → BACKEND_PERMISSIONS matrix
```

- The backend validates every non-public action against the user's role.
- The frontend renders all UI elements unconditionally.
- Unauthorized actions are rejected by the backend with `FORBIDDEN` or `UNAUTHORIZED`.

## 4. How to Add a New Module

Follow `NEW_MODULE_CHECKLIST.md` exactly. Key points:

1. **Backend first** — Add the GAS handler, permission mappings in `BACKEND_PERMISSIONS`, and tests.
2. **Frontend second** — Create the HTML page and JS module. Call `request(action, payload)` directly.
3. **No permission UI** — Do not add `canView`, `canEdit`, `checkPageAccess`, or any gating logic.
4. **Session flow** — Use `requireAuth()` from `auth.js` in your `DOMContentLoaded` handler.

## 5. Forbidden Patterns

Do **NOT** introduce any of the following:

```javascript
// ❌ FORBIDDEN — client-side permission check
if (getCurrentUser().role !== 'Admin') { return; }

// ❌ FORBIDDEN — permission attributes
element.setAttribute('data-permission', 'Module:canEdit');

// ❌ FORBIDDEN — frontend permission matrix
const PERMISSIONS = { Admin: { canView: true, canEdit: true } };

// ❌ FORBIDDEN — mock fallback
if (!USE_BACKEND) { return mockResponse; }

// ❌ FORBIDDEN — duplicate session accessor
function getSessionUser() { return JSON.parse(localStorage.getItem(...)); }
```

❌ Do NOT suggest adding CORS headers in Google Apps Script.
GAS does not support custom response headers.
Any "CORS error" must be diagnosed as a deployment or request-shape issue.

## 6. Allowed Patterns

```javascript
// ✅ ALLOWED — backend request (transport only)
const result = await request('getEmployees', { page: 1 });

// ✅ ALLOWED — session token for auth
const token = getSessionToken();

// ✅ ALLOWED — display-only user info (NOT for access control)
const user = getCurrentUser();
renderUserInfo(user);

// ✅ ALLOWED — backend rejects unauthorized access
// Frontend shows the error from result.message
if (!result.success) { showError(getErrorMessage(result)); }
```

## 7. Before You Edit

1. Read `AUTH_CONTRACT.md`
2. Read this file (`CONTRIBUTING_AI.md`)
3. If adding a module, follow `NEW_MODULE_CHECKLIST.md`
4. Verify no `.gs` backend files are modified unless explicitly requested
5. Run final verification: search for forbidden patterns listed above
