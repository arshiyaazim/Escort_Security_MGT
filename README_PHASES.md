# Al-Aqsa HRM v2 — Controlled Refactor Phase Plan

**Created:** 2026-02-20  
**Status:** PHASE 0 COMPLETE (Inventory & Analysis)  
**Baseline Version:** 1.1.0  
**ZERO code paths altered in this document.**

---

## Table of Contents

1. [Repository Map](#1-repository-map)
2. [Backend Action Inventory](#2-backend-action-inventory)
3. [Sheet (Database Table) Inventory](#3-sheet-database-table-inventory)
4. [Frontend → Backend Touchpoint Inventory](#4-frontend--backend-touchpoint-inventory)
5. [Security Surface Inventory](#5-security-surface-inventory)
6. [Permission Matrix Duplication Map](#6-permission-matrix-duplication-map)
7. [Phase Definitions](#7-phase-definitions)
8. [Phase-to-File Mapping](#8-phase-to-file-mapping)
9. [Stop Conditions](#9-stop-conditions)
10. [Rollback Policy](#10-rollback-policy)
11. [Confirmation of Zero Changes](#11-confirmation-of-zero-changes)

---

## 1. Repository Map

### Backend (Google Apps Script)

| File | Purpose | Has Handlers |
|------|---------|-------------|
| `google-apps-script/Code.gs` | Main entry point: `doGet`, `doPost`, `routeAction`, config, `SHEETS` constants, `BACKEND_PERMISSIONS`, `PUBLIC_ACTIONS` | Yes — router |
| `google-apps-script/Auth.gs` | Token management: `generateToken`, `validateToken`, `invalidateToken`, `handleLogin`, `handleLogout`, cleanup | Yes |
| `google-apps-script/UserManagement.gs` | User CRUD: `handleGetUsers`, `handleAddUser`, `handleUpdateUser`, `handleResetPassword`, `handleDeleteUser` | Yes |
| `google-apps-script/Employees.gs` | Employee CRUD: `handleGetEmployees`, `handleAddOrUpdateEmployee`, `handleDeleteEmployee` | Yes |
| `google-apps-script/Clients.gs` | Client CRUD: `handleGetClients`, `handleAddOrUpdateClient`, `handleDeleteClient` | Yes |
| `google-apps-script/GuardDuty.gs` | Guard duty + dashboard: `handleGetGuardDuty`, `handleAddGuardDuty`, `handleDeleteGuardDuty`, `handleGetDashboardStats` | Yes |
| `google-apps-script/EscortDuty.gs` | Escort duty CRUD | Yes |
| `google-apps-script/DayLabor.gs` | Day labor CRUD | Yes |
| `google-apps-script/LoanAdvance.gs` | Loan/advance CRUD | Yes |
| `google-apps-script/Salary.gs` | Salary ledger: `handleGetSalaryLedger`, `handleGenerateSalary` | Yes |
| `google-apps-script/Invoices.gs` | Invoice lifecycle: get, generate, finalize, markPaid, delete | Yes |
| `google-apps-script/Files.gs` | File upload/download/delete via Google Drive | Yes |
| `google-apps-script/JobPosts.gs` | Job post CRUD (partially public) | Yes |
| `google-apps-script/JobApplications.gs` | Job application CRUD (partially public) | Yes |
| `google-apps-script/Utilities.gs` | DB helpers: `setupDatabase`, `getSheetData`, `getIndexedSheet`, `findRowById`, `addRecord`, `updateRecord`, `deleteRecord`, `upsertRecord`, `checkPermission`, `validateRequired` | No (utility) |

### Frontend (JavaScript)

| File | Purpose | Auth-Gated | Module Name |
|------|---------|-----------|-------------|
| `js/config.js` | App constants only | N/A | N/A |
| `js/api.js` | Central `request()`, `BASE_URL`, mock data, `BACKEND_PERMISSIONS` (client copy), `getSessionUser()` | N/A (infra) | N/A |
| `js/auth.js` | `getCurrentUser`, `setCurrentUser`, `clearSession`, `login`, `logout`, `requireAuth`, role badges | N/A (infra) | N/A |
| `js/permissions.js` | `PERMISSIONS` matrix (3rd copy), `canView/canAdd/canEdit/canDelete/canFinalize`, `checkPageAccess`, `initPermissionUI` | N/A (infra) | N/A |
| `js/user-management.js` | User CRUD UI | `requireAuth` + `checkPageAccess('UserManagement')` | UserManagement |
| `js/employees.js` | Employee CRUD UI | `requireAuth` + `checkPageAccess('Employees')` | Employees |
| `js/clients.js` | Client CRUD UI | `requireAuth` + `checkPageAccess('Clients')` | Clients |
| `js/guard-duty.js` | Guard duty UI | `requireAuth` + `checkPageAccess('GuardDuty')` | GuardDuty |
| `js/escort-duty.js` | Escort duty UI | `requireAuth` + `checkPageAccess('EscortDuty')` | EscortDuty |
| `js/day-labor.js` | Day labor UI | `requireAuth` + `checkPageAccess('DayLabor')` | DayLabor |
| `js/loan-advance.js` | Loan/advance UI | `requireAuth` + `checkPageAccess('LoanAdvance')` | LoanAdvance |
| `js/salary.js` | Salary ledger UI | `requireAuth` + `checkPageAccess('Salary')` | Salary |
| `js/invoices.js` | Invoice UI | `requireAuth` + `checkPageAccess('Invoice')` | Invoice |
| `js/dashboard.js` | Dashboard widget (no own auth gate — gated by dashboard.html inline) | Inline in HTML | N/A |
| `js/job-posts.js` | Job post admin UI | `requireAuth` + `checkPageAccess('JobPosts')` | JobPosts |
| `js/job-applications.js` | Application review UI | `requireAuth` + `checkPageAccess('JobApplications')` | JobApplications |
| `js/job-apply.js` | Public application form | **None** (public) | N/A |
| `js/job-circulars.js` | Public job listing | **None** (public) | N/A |
| `js/file-upload.js` | File upload infrastructure | **None** (used inside gated pages) | N/A |
| `js/utils.js` | `getTodayISO()` utility | N/A | N/A |
| `js/ux-utils.js` | UI loading states, toasts, confirms | N/A | N/A |
| `js/pagination-utils.js` | Pagination helpers | N/A | N/A |

### HTML Pages

| Page | Scripts Loaded | Auth |
|------|---------------|------|
| `login.html` | config, api, auth | Public (login form) |
| `index.html` | config, api, auth | Public (redirect to login/dashboard) |
| `dashboard.html` | config, utils, api, auth, permissions, ux-utils, dashboard | `requireAuth()` inline |
| `user-management.html` | config, utils, api, auth, permissions, ux-utils, user-management | Via user-management.js |
| `employees.html` | config, utils, api, auth, permissions, ux-utils, pagination-utils, employees | Via employees.js |
| `clients.html` | config, utils, api, auth, permissions, ux-utils, pagination-utils, clients | Via clients.js |
| `guard-duty.html` | config, utils, api, auth, permissions, ux-utils, guard-duty | Via guard-duty.js |
| `escort-duty.html` | config, utils, api, auth, permissions, ux-utils, escort-duty | Via escort-duty.js |
| `day-labor.html` | config, utils, api, auth, permissions, ux-utils, day-labor | Via day-labor.js |
| `loan-advance.html` | config, utils, api, auth, permissions, ux-utils, pagination-utils, loan-advance | Via loan-advance.js |
| `salary.html` | config, utils, api, auth, permissions, ux-utils, pagination-utils, salary | Via salary.js |
| `invoices.html` | config, utils, api, auth, permissions, ux-utils, pagination-utils, invoices | Via invoices.js |
| `job-posts.html` | config, api, auth, permissions, ux-utils, job-posts | Via job-posts.js |
| `job-applications.html` | config, api, auth, permissions, ux-utils, file-upload, pagination-utils, job-applications | Via job-applications.js |
| `job-circulars.html` | api, job-circulars | **Public** |
| `job-apply.html` | api, file-upload, job-apply | **Public** |

---

## 2. Backend Action Inventory

### Entry Points

| Function | Method | Location |
|----------|--------|----------|
| `doGet(e)` | GET | Code.gs |
| `doPost(e)` | POST | Code.gs |

Both delegate to `handleRequest(e, method)` → `routeAction(action, payload, sessionUser)`.

### Complete Action Router

| Action | Handler | File | Auth Required | Permission Check |
|--------|---------|------|--------------|-----------------|
| `login` | `handleLogin` | Auth.gs | No | None |
| `logout` | `handleLogout` | Auth.gs | No | None |
| `health` | inline | Code.gs | No | None |
| `meta` | inline | Code.gs | No | None |
| `getEmployees` | `handleGetEmployees` | Employees.gs | Yes | `Employees:canView` |
| `addOrUpdateEmployee` | `handleAddOrUpdateEmployee` | Employees.gs | Yes | `Employees:canAdd` or `canEdit` |
| `deleteEmployee` | `handleDeleteEmployee` | Employees.gs | Yes | `Employees:canDelete` |
| `getClients` | `handleGetClients` | Clients.gs | Yes | `Clients:canView` |
| `addOrUpdateClient` | `handleAddOrUpdateClient` | Clients.gs | Yes | `Clients:canAdd` or `canEdit` |
| `deleteClient` | `handleDeleteClient` | Clients.gs | Yes | `Clients:canDelete` |
| `getGuardDuty` | `handleGetGuardDuty` | GuardDuty.gs | Yes | `GuardDuty:canView` |
| `addGuardDuty` | `handleAddGuardDuty` | GuardDuty.gs | Yes | `GuardDuty:canAdd` |
| `deleteGuardDuty` | `handleDeleteGuardDuty` | GuardDuty.gs | Yes | `GuardDuty:canDelete` |
| `getEscortDuty` | `handleGetEscortDuty` | EscortDuty.gs | Yes | `EscortDuty:canView` |
| `addEscortDuty` | `handleAddEscortDuty` | EscortDuty.gs | Yes | `EscortDuty:canAdd` |
| `deleteEscortDuty` | `handleDeleteEscortDuty` | EscortDuty.gs | Yes | `EscortDuty:canDelete` |
| `getDayLabor` | `handleGetDayLabor` | DayLabor.gs | Yes | `DayLabor:canView` |
| `addDayLabor` | `handleAddDayLabor` | DayLabor.gs | Yes | `DayLabor:canAdd` |
| `deleteDayLabor` | `handleDeleteDayLabor` | DayLabor.gs | Yes | `DayLabor:canDelete` |
| `getLoanAdvance` | `handleGetLoanAdvance` | LoanAdvance.gs | Yes | `LoanAdvance:canView` |
| `addLoanAdvance` | `handleAddLoanAdvance` | LoanAdvance.gs | Yes | `LoanAdvance:canAdd` |
| `deleteLoanAdvance` | `handleDeleteLoanAdvance` | LoanAdvance.gs | Yes | `LoanAdvance:canDelete` |
| `getSalaryLedger` | `handleGetSalaryLedger` | Salary.gs | Yes | `Salary:canView` |
| `generateSalary` | `handleGenerateSalary` | Salary.gs | Yes | `Salary:canAdd` |
| `getInvoices` | `handleGetInvoices` | Invoices.gs | Yes | `Invoices:canView` |
| `generateInvoice` | `handleGenerateInvoice` | Invoices.gs | Yes | `Invoices:canAdd` |
| `finalizeInvoice` | `handleFinalizeInvoice` | Invoices.gs | Yes | `Invoices:canEdit` |
| `markInvoicePaid` | `handleMarkInvoicePaid` | Invoices.gs | Yes | `Invoices:canEdit` |
| `deleteInvoice` | `handleDeleteInvoice` | Invoices.gs | Yes | `Invoices:canDelete` |
| `uploadFile` | `handleUploadFile` | Files.gs | Yes | **Auth only (no role check)** |
| `getFiles` | `handleGetFiles` | Files.gs | Yes | **Auth only (no role check)** |
| `deleteFile` | `handleDeleteFile` | Files.gs | Yes | **Auth only (no role check)** |
| `getJobPosts` | `handleGetJobPosts` | JobPosts.gs | **No** (public) | Conditional: unauth → Open only |
| `addJobPost` | `handleAddJobPost` | JobPosts.gs | Yes | `JobPosts:canAdd` |
| `updateJobPost` | `handleUpdateJobPost` | JobPosts.gs | Yes | `JobPosts:canEdit` |
| `deleteJobPost` | `handleDeleteJobPost` | JobPosts.gs | Yes | `JobPosts:canDelete` |
| `getJobApplications` | `handleGetJobApplications` | JobApplications.gs | Yes | `JobApplications:canView` |
| `addJobApplication` | `handleAddJobApplication` | JobApplications.gs | **No** (public) | None |
| `updateApplicationStatus` | `handleUpdateApplicationStatus` | JobApplications.gs | Yes | `JobApplications:canEdit` |
| `getJobApplication` | `handleGetJobApplication` | JobApplications.gs | **No** (public) | None |
| `getDashboardStats` | `handleGetDashboardStats` | GuardDuty.gs | Yes (token) | **None (missing)** |

### Public Actions (declared in `PUBLIC_ACTIONS` array)

```
['getJobPosts', 'addJobApplication', 'getJobApplication', 'health', 'meta']
```

---

## 3. Sheet (Database Table) Inventory

| Constant | Sheet Name | Headers | Used By (Backend) |
|----------|-----------|---------|-------------------|
| `SHEETS.USERS` | `users` | id, username, passwordHash, role, status, createdAt | Auth.gs, UserManagement.gs |
| `SHEETS.EMPLOYEES` | `employees` | id, name, nid, phone, address, bank, joiningDate, contractType, dailyRate, status | Employees.gs, GuardDuty.gs (dashboard) |
| `SHEETS.CLIENTS` | `clients` | id, companyName, contactPerson, phone, email, address, status | Clients.gs |
| `SHEETS.GUARD_DUTY` | `guardDuty` | id, date, employeeId, employeeName, clientId, clientName, shift, status, remarks | GuardDuty.gs, Salary.gs, Invoices.gs |
| `SHEETS.ESCORT_DUTY` | `escortDuty` | id, startDate, endDate, employeeId, employeeName, clientId, clientName, totalDays, conveyance, status, notes | EscortDuty.gs, Salary.gs, Invoices.gs |
| `SHEETS.DAY_LABOR` | `dayLabor` | id, date, employeeId, employeeName, clientId, clientName, hoursWorked, notes | DayLabor.gs, Salary.gs, Invoices.gs |
| `SHEETS.LOAN_ADVANCE` | `loanAdvance` | id, employeeId, employeeName, type, amount, issueDate, status, notes | LoanAdvance.gs, Salary.gs |
| `SHEETS.SALARY_LEDGER` | `salaryLedger` | id, employeeId, employeeName, sourceModule, sourceId, date, shiftOrHours, earnedAmount, deductedAmount, netChange, runningBalance, month, createdAt | Salary.gs |
| `SHEETS.PROCESSED_EVENTS` | `processedEvents` | eventKey, processedAt | Salary.gs |
| `SHEETS.INVOICES` | `invoices` | id, invoiceNumber, clientId, clientName, periodStart, periodEnd, totalEscortDays, escortAmount, totalGuardDays, guardAmount, totalLaborHours, laborAmount, subtotal, vatPercent, vatAmount, totalAmount, status, createdAt | Invoices.gs |
| `SHEETS.FILE_UPLOADS` | `fileUploads` | id, module, recordId, fileName, fileType, fileSize, driveFileId, driveUrl, uploadedAt, uploadedBy | Files.gs |
| `SHEETS.JOB_POSTS` | `jobPosts` | id, title, description, requirements, location, salary, status, openDate, closeDate, createdAt | JobPosts.gs, JobApplications.gs |
| `SHEETS.JOB_APPLICATIONS` | `jobApplications` | id, jobId, applicantName, phone, email, experience, education, skills, resumeUrl, status, appliedAt, notes | JobApplications.gs, JobPosts.gs |
| `SHEETS.PERMISSIONS` | `permissions` | role, module, canView, canAdd, canEdit, canDelete | Utilities.gs (setup only — **never read at runtime**) |

---

## 4. Frontend → Backend Touchpoint Inventory

All frontend API calls go through `request(action, payload)` in `js/api.js`, which calls `fetch(BASE_URL, ...)` with the token from `localStorage`.

### Single fetch() Origin

```
BASE_URL = 'https://script.google.com/macros/s/AKfycby.../exec'
```

Located at: `js/api.js`, line 7. **Single hardcoded location** (good).

### Complete Frontend `request()` Call Map

| Frontend File | Action Sent | Payload Shape |
|--------------|-------------|---------------|
| employees.js | `getEmployees` | `{}` |
| employees.js | `addOrUpdateEmployee` | `{id, name, phone, role, salary, ...}` |
| employees.js | `deleteEmployee` | `{id}` |
| clients.js | `getClients` | `{}` |
| clients.js | `addOrUpdateClient` | `{id, name, contactRate, ...}` |
| clients.js | `deleteClient` | `{id}` |
| guard-duty.js | `getGuardDuty` | `{date}` |
| guard-duty.js | `addGuardDuty` | `{id, employeeId, date, shift, status, ...}` |
| guard-duty.js | `deleteGuardDuty` | `{id}` |
| escort-duty.js | `getEscortDuty` | `{startDate, endDate}` |
| escort-duty.js | `addEscortDuty` | `{id, employeeId, startDate, ...}` |
| escort-duty.js | `deleteEscortDuty` | `{id}` |
| day-labor.js | `getDayLabor` | `{date}` |
| day-labor.js | `addDayLabor` | `{id, employeeId, date, ...}` |
| day-labor.js | `deleteDayLabor` | `{id}` |
| loan-advance.js | `getLoanAdvance` | `{}` |
| loan-advance.js | `addLoanAdvance` | `{id, employeeId, type, amount, ...}` |
| loan-advance.js | `deleteLoanAdvance` | `{id}` |
| salary.js | `getSalaryLedger` | `{employeeId?, month?}` |
| salary.js | `generateSalary` | `{runTime}` |
| invoices.js | `getInvoices` | `{clientId?, startDate?, endDate?}` |
| invoices.js | `generateInvoice` | `{clientId, periodStart, periodEnd, vatPercent, contactRate}` |
| invoices.js | `finalizeInvoice` | `{id}` |
| invoices.js | `markInvoicePaid` | `{id}` |
| invoices.js | `deleteInvoice` | `{id}` |
| dashboard.js | `getDashboardStats` | `{}` |
| job-posts.js | `getJobPosts` | `{status?}` |
| job-posts.js | `addJobPost` | `{id, title, ...}` |
| job-posts.js | `updateJobPost` | `{id, title, status, ...}` |
| job-posts.js | `deleteJobPost` | `{id}` |
| job-applications.js | `getJobApplications` | `{jobId?, status?}` |
| job-applications.js | `getJobPosts` | `{}` (for filter dropdown) |
| job-applications.js | `updateApplicationStatus` | `{id, status, notes}` |
| job-apply.js | `getJobPosts` | `{}` (to find job by URL param) |
| job-apply.js | `addJobApplication` | `{id, jobId, applicantName, ...}` |
| job-circulars.js | `getJobPosts` | `{status: "Open"}` |
| file-upload.js | `uploadFile` | `{module, recordId, fileName, fileType, fileSize}` |
| file-upload.js | `getFiles` | `{module, recordId}` |
| file-upload.js | `deleteFile` | `{id}` |
| user-management.js | `getUsers` | `{}` |
| user-management.js | `addUser` | `{id, username, password, role, createdAt}` |
| user-management.js | `updateUser` | `{id, role?, status?}` |
| user-management.js | `resetPassword` | `{id, newPassword}` |
| user-management.js | `deleteUser` | `{id}` |
| auth.js | `login` | `{username, password}` |
| auth.js | `logout` | `{token}` |

---

## 5. Security Surface Inventory

### 5.1 localStorage Usage for Auth

| Location | Key | Operation | Purpose |
|----------|-----|-----------|---------|
| `js/auth.js:20` | `alaqsa_hrm_session` | `getItem` | Read session (getCurrentUser) |
| `js/auth.js:56` | `alaqsa_hrm_session` | `setItem` | Store session after login |
| `js/auth.js:43,63` | `alaqsa_hrm_session` | `removeItem` | Clear session (logout/invalid) |
| `js/api.js:177` | `alaqsa_hrm_session` | `getItem` | Read session (getSessionUser — duplicate function) |

**Session Data Shape stored in localStorage:**

```json
{
  "id": "user-admin-001",
  "username": "admin",
  "role": "Admin",
  "status": "Active",
  "token": "base64-encoded-token"
}
```

### 5.2 Client-Side Role Trust Points

Role is read from `localStorage` (never re-validated against backend) at these points:

| Location | Function | What It Controls |
|----------|----------|-----------------|
| `js/auth.js:147` | `isAuthenticated()` | Page access gating |
| `js/permissions.js:84` | `getCurrentPermissions()` | All permission decisions |
| `js/permissions.js:256` | `checkPageAccess(module)` | Page-level redirect |
| `js/permissions.js:100-140` | `canView/canAdd/canEdit/canDelete/canFinalize` | Button/UI element visibility |
| `dashboard.html:116` | `getCurrentUser()` | Module link rendering |

**Critical observation:** The backend DOES validate tokens AND checks permissions server-side. However, the frontend independently gates UI based on the role stored in `localStorage` — if a user tampers with `localStorage`, they see admin UI but backend calls will fail due to token-based role check.

### 5.3 Direct fetch() Call Locations

| Location | Destination |
|----------|-------------|
| `js/api.js:213` | `BASE_URL` (Google Apps Script) — **ONLY fetch() call in the entire frontend** |

All other modules call `request()` which wraps this single `fetch()`.

### 5.4 Token Lifecycle

| Event | Frontend | Backend |
|-------|----------|---------|
| Login | `login()` → token stored in localStorage session | `handleLogin()` → `generateToken()` → stored in `PropertiesService` |
| API Call | `request()` reads token from session → sends in POST body | `handleRequest()` → `validateToken()` → checks PropertiesService |
| Logout | `logout()` → calls `request('logout')` → clears localStorage | `handleLogout()` → `invalidateToken()` → deletes from PropertiesService |
| Expiry | No client-side expiry check | `validateToken()` checks `expiresAt` (24h from creation) |

---

## 6. Permission Matrix Duplication Map

The permission matrix exists in **three (3) separate locations**:

| Location | Variable Name | Modules Listed |
|----------|--------------|---------------|
| `google-apps-script/Code.gs` | `BACKEND_PERMISSIONS` | 11 modules (uses `Invoices` key) |
| `js/api.js` | `BACKEND_PERMISSIONS` | 11 modules (uses `Invoice` key) |
| `js/permissions.js` | `PERMISSIONS` | 11 modules (uses `Invoice` key) |

**Key mismatch found:** Backend uses `Invoices` (plural) as the module key. Frontend uses `Invoice` (singular). The backend permission check for `invoice.js` actions uses `checkPermission(role, 'Invoices', ...)` but the frontend `checkPageAccess('Invoice')` uses singular. This works independently because frontend and backend permission matrices are separate copies, but it represents a semantic inconsistency.

---

## 7. Phase Definitions

### PHASE 0 — Inventory & Analysis ✅ COMPLETE

**Goal:** Full codebase inventory with zero changes.  
**Status:** This document.  
**Files touched:** 0 (only this new file created)  
**Risk:** None.

---

### PHASE 1 — Documentation & TODO Markers

**Goal:** Add inline documentation and TODO markers to existing files identifying issues for future phases. No behavior changes.

**Allowed actions:**
- Add `// TODO: PHASE-X — description` comments
- Add JSDoc comments to undocumented functions
- Add `// SECURITY: ...` markers at identified risk points
- Add `// DUPLICATION: ...` markers at permission matrix copies

**Risks addressed:**
- Visibility: Marks all known issues inline for any developer
- Traceability: Links each TODO to a specific future phase

**Files to touch:**

| File | Marker Type |
|------|-------------|
| `js/api.js` | `// DUPLICATION: Permission matrix copy #2 of 3` |
| `js/api.js` | `// TODO: PHASE-3 — Remove mock data store when backend is stable` |
| `js/api.js` | `// SECURITY: getSessionUser() reads role from localStorage without validation` |
| `js/permissions.js` | `// DUPLICATION: Permission matrix copy #3 of 3` |
| `js/auth.js` | `// SECURITY: Role from localStorage is trusted without backend re-validation` |
| `js/auth.js` | `// TODO: PHASE-2 — Add token expiry check on client side` |
| `js/user-management.js` | `// TODO: PHASE-2 — Password is sent in plaintext, backend stores unhashed` |
| `google-apps-script/Code.gs` | `// DUPLICATION: Permission matrix — authoritative copy (1 of 3)` |
| `google-apps-script/Auth.gs` | `// SECURITY: Password compared as plaintext (no hashing)` |
| `google-apps-script/UserManagement.gs` | `// SECURITY: Password stored as plaintext in passwordHash field` |
| `google-apps-script/Files.gs` | `// TODO: PHASE-2 — Add role-based permission check (currently auth-only)` |
| `google-apps-script/GuardDuty.gs` | `// TODO: PHASE-2 — handleGetDashboardStats missing permission check` |

**Stop condition:** No executable code added. Only comments.  

---

### PHASE 2 — Backend Hardening (Non-Breaking)

**Goal:** Add missing backend permission checks and input validation without changing any existing behavior for currently-passing requests.

**Risks addressed:**
- `handleGetDashboardStats` has no permission check
- `handleUploadFile`, `handleGetFiles`, `handleDeleteFile` have auth-only (no role) checks
- Passwords stored/compared as plaintext
- No input length validation on user-submitted fields
- `updateUser` accepts `Inactive` as valid status but frontend sends `Disabled`

**Files to touch:**

| File | Change Type |
|------|-------------|
| `google-apps-script/GuardDuty.gs` | Add permission check to `handleGetDashboardStats` |
| `google-apps-script/Files.gs` | Add role-based permission checks |
| `google-apps-script/Auth.gs` | Add password hashing (with backward-compatible fallback) |
| `google-apps-script/UserManagement.gs` | Add input validation (length, format) |
| `google-apps-script/Utilities.gs` | Add validation helper functions (unused until wired) |

**Stop condition:** All existing tests/manual flows still work. No frontend changes.

---

### PHASE 3 — Permission Matrix Consolidation

**Goal:** Eliminate triple-duplication of permission matrix. Establish single source of truth.

**Risks addressed:**
- Three copies can drift independently
- `Invoices` vs `Invoice` key mismatch between backend and frontend
- Frontend mock data store duplicates backend logic

**Files to touch:**

| File | Change Type |
|------|-------------|
| `google-apps-script/Code.gs` | Authoritative `BACKEND_PERMISSIONS` — no change |
| `js/api.js` | Remove `BACKEND_PERMISSIONS` copy, load from backend or shared config |
| `js/permissions.js` | Align to backend source, or fetch at login |
| `js/api.js` | Evaluate mock data store removal (if `USE_BACKEND = true` is permanent) |

**Stop condition:** Permission checks produce identical results. All pages accessible/restricted as before.

---

### PHASE 4 — Auth Lifecycle Hardening

**Goal:** Ensure token + session lifecycle is consistent and tamper-resistant.

**Risks addressed:**
- No client-side token expiry enforcement
- `getSessionUser()` in `api.js` duplicates `getCurrentUser()` in `auth.js`
- `localStorage` role can be manually edited (mitigated by backend checks, but UI lies)
- Origin change (github.io → magnusmarine.online) invalidates all sessions

**Files to touch:**

| File | Change Type |
|------|-------------|
| `js/auth.js` | Add client-side token expiry check |
| `js/api.js` | Remove `getSessionUser()` duplication, use `getCurrentUser()` |
| `js/api.js` | Add response interceptor for `AUTH_REQUIRED` → auto-redirect |
| `js/auth.js` | Add origin-aware session key (optional) |

**Stop condition:** Login/logout cycle works. Pages redirect properly on expired token.

---

### PHASE 5 — Mock Data Removal & Cleanup

**Goal:** Remove `USE_BACKEND` toggle and mock data store from `api.js`.

**Risks addressed:**
- ~800 lines of mock data handlers that shadow real backend behavior
- `USE_BACKEND = true` is already set — mock code is dead code
- Mock permission checks use `getSessionUser()` from `localStorage` instead of backend token

**Files to touch:**

| File | Change Type |
|------|-------------|
| `js/api.js` | Remove `mockDataStore`, `USE_BACKEND` flag, all `case` handlers in mock switch |

**Stop condition:** `request()` function sends all calls to backend. No mock fallback.

---

## 8. Phase-to-File Mapping (Summary)

| File | Ph0 | Ph1 | Ph2 | Ph3 | Ph4 | Ph5 |
|------|-----|-----|-----|-----|-----|-----|
| `README_PHASES.md` | ✅ | | | | | |
| `google-apps-script/Code.gs` | 📖 | ✏️ | | | | |
| `google-apps-script/Auth.gs` | 📖 | ✏️ | ✏️ | | | |
| `google-apps-script/UserManagement.gs` | 📖 | ✏️ | ✏️ | | | |
| `google-apps-script/Utilities.gs` | 📖 | | ✏️ | | | |
| `google-apps-script/GuardDuty.gs` | 📖 | ✏️ | ✏️ | | | |
| `google-apps-script/Files.gs` | 📖 | ✏️ | ✏️ | | | |
| `google-apps-script/Employees.gs` | 📖 | | | | | |
| `google-apps-script/Clients.gs` | 📖 | | | | | |
| `google-apps-script/EscortDuty.gs` | 📖 | | | | | |
| `google-apps-script/DayLabor.gs` | 📖 | | | | | |
| `google-apps-script/LoanAdvance.gs` | 📖 | | | | | |
| `google-apps-script/Salary.gs` | 📖 | | | | | |
| `google-apps-script/Invoices.gs` | 📖 | | | | | |
| `google-apps-script/JobPosts.gs` | 📖 | | | | | |
| `google-apps-script/JobApplications.gs` | 📖 | | | | | |
| `js/api.js` | 📖 | ✏️ | | ✏️ | ✏️ | ✏️ |
| `js/auth.js` | 📖 | ✏️ | | | ✏️ | |
| `js/permissions.js` | 📖 | ✏️ | | ✏️ | | |
| `js/user-management.js` | 📖 | ✏️ | | | | |
| `js/config.js` | 📖 | | | | | |
| All other `js/*.js` | 📖 | | | | | |

Legend: 📖 = Read/Analyzed | ✏️ = Will be modified | ✅ = Created

---

## 9. Stop Conditions

Each phase MUST satisfy ALL conditions before proceeding:

### Global Stop Conditions (apply to every phase)

1. **No behavior changes** — identical user-visible behavior before and after
2. **No deployment required** — changes to backend `.gs` files are staged only
3. **Manual smoke test passes** — login, navigate dashboard, CRUD on one module
4. **Git commit is clean** — all changes committed with phase-tagged message
5. **This document is updated** with completion status

### Phase-Specific Stop Conditions

| Phase | Stop If... |
|-------|-----------|
| Phase 1 | Any non-comment change is detected in diff |
| Phase 2 | Any existing working request starts failing |
| Phase 3 | Any page shows different permission behavior |
| Phase 4 | Login/logout flow breaks on any browser |
| Phase 5 | Any `request()` call returns mock data instead of backend data |

---

## 10. Rollback Policy

### Per-Phase Rollback

Each phase is committed as a **single, atomic Git commit** tagged with `phase-N-complete`.

**Rollback command:**
```bash
git revert <phase-N-commit-hash>
```

### Ordering Constraints

- Phases 1 → 2 → 3 → 4 → 5 are sequential
- Phase 1 has no dependencies and is always safe
- Phase 2 must complete before Phase 3 (permission consolidation depends on backend being correct)
- Phase 4 depends on Phase 3 (auth changes assume single permission source)
- Phase 5 depends on Phase 4 (mock removal assumes auth is stable)

### Rollback does NOT require:

- Redeployment of Google Apps Script (unless Phase 2+ was deployed)
- User notification (all changes are internal)
- Data migration (no schema changes in any phase)

---

## 11. Confirmation of Zero Changes

**PHASE 0 produced:**
- 1 new file: `README_PHASES.md` (this document)
- 0 modified files
- 0 deleted files
- 0 lines of executable code added, modified, or removed
- 0 behavior changes
- 0 deployments

All information in this document was derived from **read-only inspection** of the existing codebase. No code paths were altered.

---

*End of Phase 0 — Controlled Refactor Plan*
