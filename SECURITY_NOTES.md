# SECURITY_NOTES.md — Al-Aqsa HRM v2

> **Phase 4 document — frontend authentication lifecycle alignment.**
> Originally created in Phase 1 (annotation only). Phase 2 added runtime
> security hardening. Phase 3 formalized authorization contract, designated
> canonical permission authority, and added `validatePermissionsConfig()`.
> Phase 4 aligned frontend auth lifecycle with backend authority: single
> session accessor, backend-validated page loads, SESSION_EXPIRED handling.
> Cross-referenced by `CONTRACT:` and `RISK:` tags in backend source files.
> See also: `AUTH_CONTRACT.md` for the full authorization contract.

---

## 1. Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER  (untrusted)                                           │
│  ┌───────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │ localStorage   │  │ permissions.js│  │ auth.js            │   │
│  │ (session copy) │  │ (PERMISSIONS │  │ (getSessionToken() │   │
│  │                │  │  copy 3/3)   │  │  — sole accessor,  │   │
│  │                │  │              │  │  Phase 4)           │   │
│  └───────────────┘  └──────────────┘  └────────────────────┘   │
│              │                │                │                │
│              ▼                ▼                ▼                │
│        UI gate only     UI gate only     fetch() to backend    │
│    (DevTools bypass)  (DevTools bypass)  (single call site)    │
└──────────────────────────────┬──────────────────────────────────┘
                               │  POST over HTTPS
                               │  SessionId in request body (body.token)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  GOOGLE APPS SCRIPT  (trusted perimeter)                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Code.gs  handleRequest()  [PHASE 2 — ACTIVE]             │   │
│  │   • Parses body                                           │   │
│  │   • AUTH GATE:                                            │   │
│  │     1. validateSession(token) → {user, error}             │   │
│  │     2. assertAuthenticated(sessionResult) → deny or null  │   │
│  │     3. assertAuthorized(action, role) → deny or null      │   │
│  │   • PUBLIC_ACTIONS bypass: 5 actions skip auth            │   │
│  │   • ACTION_PERMISSIONS map: fail-closed authorization     │   │
│  │   • routeAction(action, payload, sessionUser)             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                               │                                 │
│            Per-handler checkPermission() retained as             │
│            defense-in-depth (centralized gate is primary)        │
│                               │                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Google Sheets  (data store)                               │   │
│  │   15 named tabs (incl. new 'sessions' sheet)              │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Google Drive  (file store)                                │   │
│  │   Shared folder: CONFIG.DRIVE_FOLDER_ID                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Trust Limitations

The frontend permission system (`permissions.js`, `api.js`) controls **UI visibility only**.
It provides no security guarantee because:

| Limitation | Detail |
|---|---|
| **Client-side only** | All checks run in the browser; DevTools can bypass them trivially. |
| **localStorage forgery** | `alaqsa_hrm_session` can be hand-edited to set `role: "Admin"`. |
| **No token scope** | The token carries no role claim — the backend re-fetches the user record, but individual handlers check inconsistently. |
| **Duplicate matrices** | Three copies of the permission matrix exist with no sync mechanism. |

**Rule:** The frontend is a UX convenience layer.
**Only backend enforcement is trustworthy.**

---

## 3. Risk Registry

Each risk ID is referenced in source file `TODO:` / `RISK:` annotations.

### RISK-DASHBOARD-NO-PERM

| Field | Value |
|---|---|
| **File** | `google-apps-script/GuardDuty.gs` → `handleGetDashboardStats()` |
| **Severity** | HIGH |
| **Status** | **RESOLVED (Phase 2)** |
| **Description** | No `checkPermission()` call. Any authenticated user (including Viewer) can read all employee records and guard-duty attendance for all dates. |
| **Impact** | Data leakage — headcount, shift assignments, absence patterns. |
| **Resolution** | Centralized gate enforces `GuardDuty/canView` via `ACTION_PERMISSIONS`. Defense-in-depth `checkPermission()` added inside handler. |

### RISK-FILES-NO-ROLE

| Field | Value |
|---|---|
| **File** | `google-apps-script/Files.gs` → `handleUploadFile()`, `handleGetFiles()`, `handleDeleteFile()` |
| **Severity** | HIGH |
| **Status** | **RESOLVED (Phase 2)** |
| **Description** | All three file handlers only check `if (!sessionUser)` — auth-only, no role-based permission check via `checkPermission()`. |
| **Impact** | Any authenticated user can upload, enumerate, and delete files across all modules and records, including other users' uploads. A compromised Viewer account can wipe all attachments. |
| **Resolution** | Upload/Get: module-level `checkPermission(role, payload.module, 'canView')`. Delete: ownership check (`uploadedBy === username`) OR Admin role. No new permissions added — uses existing module grants. |

### RISK-PERM-NAME

| Field | Value |
|---|---|
| **File** | `google-apps-script/Code.gs` (BACKEND_PERMISSIONS), `js/api.js`, `js/permissions.js` |
| **Severity** | MEDIUM |
| **Status** | **RESOLVED (Phase 3)** |
| **Description** | Backend uses module name `"Invoices"` (plural) but frontend uses `"Invoice"` (singular). If a frontend call sends `"Invoice"` to the backend `checkPermission()`, the lookup fails silently and returns `false`, blocking legitimate users. |
| **Impact** | Invoice module operations may be incorrectly denied OR the mismatch is masked because front + back use separate matrices. |
| **Resolution** | `checkPermission()` normalizes `"Invoice"` → `"Invoices"` (Phase 2). Phase 3 formally documents the naming difference in `AUTH_CONTRACT.md §1` and declares backend `"Invoices"` as canonical. Full rename deferred to avoid frontend changes. |

### RISK-PLAINTEXT-PWD

| Field | Value |
|---|---|
| **File** | `google-apps-script/Auth.gs` → `handleLogin()`, also `UserManagement.gs` → `handleAddUser()`, `handleResetPassword()` |
| **Severity** | CRITICAL |
| **Status** | **RESOLVED (Phase 2)** |
| **Description** | Passwords were stored in the `passwordHash` column as **plaintext**. Comparison was `user.passwordHash !== password` — a direct string equality check. |
| **Impact** | Anyone with read access to the Google Sheet could read all user passwords. |
| **Resolution** | SHA-256 + per-user salt via `Utilities.computeDigest()`. Format: `"salt:hexdigest"`. `handleAddUser()` and `handleResetPassword()` now call `hashPassword()`. Login uses `verifyPassword()` with hash-on-first-login migration: existing plaintext passwords auto-hash on next successful login. |

### RISK-SESSION-DUP

| Field | Value |
|---|---|
| **File** | `js/api.js` → ~~`getSessionUser()`~~, `js/auth.js` → `getSessionToken()` + `getCurrentUser()` |
| **Severity** | LOW |
| **Status** | **RESOLVED (Phase 4)** |
| **Description** | Two separate functions read the same `localStorage` key (`alaqsa_hrm_session`). Different callers used different functions, creating confusion about which was authoritative. |
| **Impact** | If one function's validation logic diverged from the other, callers could get inconsistent views of the session. No current bug, but a maintenance hazard. |
| **Resolution** | `getSessionUser()` removed from `api.js`. New canonical accessor `getSessionToken()` in `auth.js` returns token string only. `getCurrentUser()` retained for display data (documented as non-authoritative). All callers updated. `handleAuthError()` (dead code) also removed from `api.js`. |

### RISK-PERM-DUP

| Field | Value |
|---|---|
| **File** | `Code.gs` (copy 1), `js/api.js` (copy 2), `js/permissions.js` (copy 3) |
| **Severity** | MEDIUM |
| **Status** | **RESOLVED (Phase 3)** |
| **Description** | The permission matrix is maintained in 3 separate files with no automatic sync. Backend copy lacks `canFinalize`; frontend copies include it. Structural differences mean edits to one copy are not reflected in the others. |
| **Impact** | Permission drift — a role change in one copy silently does not apply elsewhere, leading to inconsistent access control. |
| **Resolution** | Phase 3 designates `BACKEND_PERMISSIONS` in `Code.gs` as the sole canonical authority. Frontend copies documented as UI-only, non-authoritative. `AUTH_CONTRACT.md` formalizes the authorization contract. `validatePermissionsConfig()` added for consistency checking. |

---

## 4. Annotated Handlers Summary

### Handlers with proper `checkPermission()` enforcement

| Module | Actions | File |
|---|---|---|
| Employees | getEmployees, addOrUpdateEmployee, deleteEmployee | Employees.gs |
| Clients | getClients, addOrUpdateClient, deleteClient | Clients.gs |
| GuardDuty | getGuardDuty, addGuardDuty, deleteGuardDuty | GuardDuty.gs |
| DayLabor | getDayLabor, addDayLabor, deleteDayLabor | DayLabor.gs |
| EscortDuty | getEscortDuty, addEscortDuty, deleteEscortDuty | EscortDuty.gs |
| LoanAdvance | getLoanAdvance, addLoanAdvance, deleteLoanAdvance | LoanAdvance.gs |
| Salary | getSalaryLedger, generateSalary | Salary.gs |
| Invoices | getInvoices, generateInvoice, finalizeInvoice, markInvoicePaid, deleteInvoice | Invoices.gs |
| JobPosts | addJobPost, updateJobPost, deleteJobPost | JobPosts.gs |
| JobApplications | getJobApplications, updateApplicationStatus | JobApplications.gs |
| UserManagement | getUsers, addUser, updateUser, resetPassword, deleteUser | UserManagement.gs |

### Handlers with NO permission check (UNSAFE)

| Action | File | Risk ID | Status |
|---|---|---|---|
| getDashboardStats | GuardDuty.gs | RISK-DASHBOARD-NO-PERM | **RESOLVED** |
| uploadFile | Files.gs | RISK-FILES-NO-ROLE | **RESOLVED** |
| getFiles | Files.gs | RISK-FILES-NO-ROLE | **RESOLVED** |
| deleteFile | Files.gs | RISK-FILES-NO-ROLE | **RESOLVED** |

### Public actions (intentionally unauthenticated)

| Action | File | Notes |
|---|---|---|
| health | Code.gs (inline) | System health endpoint |
| meta | Code.gs (inline) | App metadata endpoint |
| getJobPosts | JobPosts.gs | Public job listings (Open status only) |
| addJobApplication | JobApplications.gs | External applicant submission |
| getJobApplication | JobApplications.gs | Applicant status check |

---

## 5. Phase 2 Completion Record

### What was implemented

| Change | Files Modified |
|---|---|
| Server-side sessions in `sessions` sheet (replacing PropertiesService tokens) | Auth.gs, Code.gs, Utilities.gs |
| SHA-256 + salt password hashing with hash-on-first-login migration | Auth.gs, UserManagement.gs |
| Centralized auth gate: `validateSession` → `assertAuthenticated` → `assertAuthorized` | Code.gs, Utilities.gs |
| `ACTION_PERMISSIONS` map (31 actions, fail-closed for unknowns) | Code.gs |
| `checkPermission()` Invoice/Invoices normalization | Utilities.gs |
| `handleGetDashboardStats` permission enforcement | GuardDuty.gs |
| Files.gs module-level + ownership permission checks | Files.gs |
| `unauthorizedResponse()` now includes `error: 'FORBIDDEN'` | Utilities.gs |
| Error sanitization: 42 handler catch blocks + handleRequest catch | All 12 handler files, Code.gs |
| `sanitizedError()` utility for generic error responses | Utilities.gs |
| `deny()` standardized denial builder | Utilities.gs |

### Risks resolved

| Risk ID | Status |
|---|---|
| RISK-DASHBOARD-NO-PERM | **RESOLVED** — centralized gate + handler defense-in-depth |
| RISK-FILES-NO-ROLE | **RESOLVED** — module-level + ownership checks |
| RISK-PLAINTEXT-PWD | **RESOLVED** — SHA-256 + salt, auto-migration |
| RISK-PERM-NAME | **RESOLVED** — checkPermission normalizes Invoice → Invoices; formally documented in AUTH_CONTRACT.md |
| RISK-PERM-DUP | **RESOLVED** — canonical authority designated; AUTH_CONTRACT.md created; validatePermissionsConfig() added |

### Risks remaining

| Risk ID | Status | Notes |
|---|---|---|
| _(none)_ | — | All identified risks resolved as of Phase 4. |

### Frontend compatibility

- **No frontend files modified** — zero changes to HTML, CSS, or JS.
- Login response shape preserved: `{ success, data: { ...user, token }, message }`.
- Session token field (`data.token`) now carries a UUID sessionId instead of old PropertiesService key. Frontend stores it the same way.
- Error codes changed from `AUTH_REQUIRED` to `UNAUTHORIZED`/`FORBIDDEN`/`SESSION_EXPIRED`. Frontend `handleAuthError()` checks for `AUTH_REQUIRED` which no longer matches, but `requireAuth()` (localStorage-based page-load check) still handles redirection independently.
- Logout: frontend `finally` block always calls `clearSession()` + redirect regardless of server response.

---

## 6. Zero Frontend Change Confirmation

**Phase 2 modified backend `.gs` files only.**

- No HTML files changed
- No JavaScript files in `js/` changed
- No CSS files changed
- Frontend behavior unchanged: login, logout, page-load auth, UI permission gates all work as before
- Response shape compatibility maintained for all 40 routed actions

Phase 3 may proceed when this document has been reviewed and approved.

---

## 7. Phase 3 Completion Record

### What was implemented

| Change | Files Modified |
|---|---|
| `BACKEND_PERMISSIONS` designated as sole canonical permission authority | Code.gs (comments) |
| Phase 1 routeAction annotations replaced with `// CONTRACT:` references to AUTH_CONTRACT.md | Code.gs |
| `AUTH_CONTRACT.md` created — full authorization contract (roles, modules, actions, permissions, ownership, flow, validation) | AUTH_CONTRACT.md (new) |
| `validatePermissionsConfig()` read-only consistency checker added | Code.gs |
| RISK-PERM-DUP resolved — documented frontend copies as non-authoritative | SECURITY_NOTES.md |
| RISK-PERM-NAME fully resolved — normalization + formal documentation | SECURITY_NOTES.md |

### Risks resolved in Phase 3

| Risk ID | Status |
|---|---|
| RISK-PERM-DUP | **RESOLVED** — canonical authority designated, contract formalized |
| RISK-PERM-NAME | **RESOLVED** — normalization active (Phase 2) + formally documented (Phase 3) |

### No-change confirmation

- **No permission outcomes changed** — same roles, same modules, same grants/denials
- **No frontend files modified** — zero changes to HTML, CSS, or JS
- **No actions renamed** — all 40 action strings unchanged
- **No access loosened or tightened** — BACKEND_PERMISSIONS matrix byte-identical
- **Not deployed** — changes are local; manual review required before deployment

---

## 8. Phase 4 Completion Record

### What was implemented

| Change | Files Modified |
|---|---|
| `getSessionToken()` — canonical session accessor returning token string only | auth.js |
| `handleSessionExpired()` — clear session + blocking alert + redirect | auth.js |
| `requireAuth()` rewritten as async with backend validation via `getDashboardStats` | auth.js |
| `isAuthenticated()` simplified to token-existence check | auth.js |
| `logout()` rewritten — sequential flow, uses `getSessionToken()` | auth.js |
| `getCurrentUser()` documented as non-authoritative display-only | auth.js |
| `getSessionUser()` removed (was duplicate of `getCurrentUser()`) | api.js |
| `handleAuthError()` removed (dead code — never called) | api.js |
| `request()` uses `getSessionToken()`, auto-redirects on `SESSION_EXPIRED`/`UNAUTHORIZED`/`AUTH_REQUIRED` | api.js |
| `getErrorMessage()` handles `SESSION_EXPIRED`, `UNAUTHORIZED`, `FORBIDDEN` codes | api.js |
| Mock UserManagement handlers updated from `getSessionUser()` → `getCurrentUser()` | api.js |
| `checkPageAccess()` removed from all module init blocks | 11 module JS files |
| `initPermissionUI()` removed from all module init blocks | 11 module JS files |
| `requireAuth()` awaited with early return on failure in all init blocks | 11 module JS files |
| Dashboard module list no longer filtered by `canView()` | dashboard.html |
| `checkPageAccess()` and `initPermissionUI()` marked `@deprecated` | permissions.js |

### Risks resolved in Phase 4

| Risk ID | Status |
|---|---|
| RISK-SESSION-DUP | **RESOLVED** — single canonical accessor (`getSessionToken()`), duplicate removed |

### Frontend auth lifecycle (post-Phase 4)

```
Page Load
  │
  ▼
DOMContentLoaded (async)
  │
  ├─ await requireAuth()
  │    │
  │    ├─ getSessionToken() → null? → redirect to login.html, return false
  │    │
  │    ├─ request('getDashboardStats', {}) → backend validates session
  │    │    │
  │    │    ├─ Success → return true (page renders normally)
  │    │    │
  │    │    ├─ SESSION_EXPIRED / UNAUTHORIZED / AUTH_REQUIRED
  │    │    │    → request() calls handleSessionExpired()
  │    │    │    → clearSession() + alert() + redirect to login.html
  │    │    │
  │    │    └─ Network error → return true (offline tolerance)
  │    │
  │    └─ Auth failure → return false → early return (page stays blank)
  │
  ├─ renderUserInfo() (display only, from cached localStorage data)
  │
  └─ Module-specific init (loads data via request() — backend enforces all access)
```

### No-change confirmation

- **No backend `.gs` files modified** — zero changes to Google Apps Script
- **No permission logic changed** — same roles, same modules, same grants/denials
- **No actions renamed** — all 40 action strings unchanged
- **No localStorage schema changed** — session object shape preserved
- **Backend enforces all access** — frontend UI gating removed from init blocks; backend gate is sole authority
- **Not deployed** — changes are local; manual review required before deployment
