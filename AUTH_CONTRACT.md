# AUTH_CONTRACT.md — Al-Aqsa HRM v2

> **Phase 3 document — Authorization contract formalization.**
> This document is the single reference for who can do what in the system.
> All backend code comments reference sections herein (e.g., `§3`, `§5`).
> Changes to authorization rules MUST be reflected here first.

---

## §1 — Canonical Permission Authority

The **only** permission matrix enforced at runtime is `BACKEND_PERMISSIONS` in
`google-apps-script/Code.gs`. It is the **single source of truth**.

### Frontend copies (non-authoritative)

| Location | Variable | Differences from canonical |
|---|---|---|
| `js/api.js` | `BACKEND_PERMISSIONS` | Adds `canFinalize` per module; uses `"Invoice"` (singular) |
| `js/permissions.js` | `PERMISSIONS` | Same differences as api.js copy |

Frontend copies exist for **UI gating only** (showing/hiding buttons, menu items).
They have **no backend enforcement authority** and can be bypassed via DevTools.

### Name normalization

Backend uses `"Invoices"` (plural). Frontend uses `"Invoice"` (singular).
`checkPermission()` in `Utilities.gs` normalizes `"Invoice"` → `"Invoices"` so
requests carrying the frontend name still resolve correctly.

### canFinalize

Frontend copies include `canFinalize` per module. The backend does **not** have
this property. The `finalizeInvoice` action maps to `Invoices/canEdit` in
`ACTION_PERMISSIONS` — no separate finalize permission exists at the enforcement
layer.

---

## §2 — Roles

Three roles exist. They are stored in the `users` sheet column `role`.

| Role | Scope |
|---|---|
| **Admin** | Full CRUD on all 11 modules. Can delete other users' files. |
| **Supervisor** | View + Add + Edit on most modules. No Delete. No UserManagement. Limited Salary/Invoices (no Edit/Delete). |
| **Viewer** | View-only on all modules except UserManagement (no access). |

---

## §3 — Permission Matrix (BACKEND_PERMISSIONS)

Each cell is `true` or `false`. Read as: Role × Module × Permission.

### Admin

| Module | canView | canAdd | canEdit | canDelete |
|---|---|---|---|---|
| Employees | ✓ | ✓ | ✓ | ✓ |
| Clients | ✓ | ✓ | ✓ | ✓ |
| GuardDuty | ✓ | ✓ | ✓ | ✓ |
| EscortDuty | ✓ | ✓ | ✓ | ✓ |
| DayLabor | ✓ | ✓ | ✓ | ✓ |
| LoanAdvance | ✓ | ✓ | ✓ | ✓ |
| Salary | ✓ | ✓ | ✓ | ✓ |
| Invoices | ✓ | ✓ | ✓ | ✓ |
| JobPosts | ✓ | ✓ | ✓ | ✓ |
| JobApplications | ✓ | ✓ | ✓ | ✓ |
| UserManagement | ✓ | ✓ | ✓ | ✓ |

### Supervisor

| Module | canView | canAdd | canEdit | canDelete |
|---|---|---|---|---|
| Employees | ✓ | ✓ | ✓ | ✗ |
| Clients | ✓ | ✓ | ✓ | ✗ |
| GuardDuty | ✓ | ✓ | ✓ | ✗ |
| EscortDuty | ✓ | ✓ | ✓ | ✗ |
| DayLabor | ✓ | ✓ | ✓ | ✗ |
| LoanAdvance | ✓ | ✓ | ✓ | ✗ |
| Salary | ✓ | ✓ | ✗ | ✗ |
| Invoices | ✓ | ✓ | ✗ | ✗ |
| JobPosts | ✓ | ✓ | ✓ | ✗ |
| JobApplications | ✓ | ✗ | ✓ | ✗ |
| UserManagement | ✗ | ✗ | ✗ | ✗ |

### Viewer

| Module | canView | canAdd | canEdit | canDelete |
|---|---|---|---|---|
| Employees | ✓ | ✗ | ✗ | ✗ |
| Clients | ✓ | ✗ | ✗ | ✗ |
| GuardDuty | ✓ | ✗ | ✗ | ✗ |
| EscortDuty | ✓ | ✗ | ✗ | ✗ |
| DayLabor | ✓ | ✗ | ✗ | ✗ |
| LoanAdvance | ✓ | ✗ | ✗ | ✗ |
| Salary | ✓ | ✗ | ✗ | ✗ |
| Invoices | ✓ | ✗ | ✗ | ✗ |
| JobPosts | ✓ | ✗ | ✗ | ✗ |
| JobApplications | ✓ | ✗ | ✗ | ✗ |
| UserManagement | ✗ | ✗ | ✗ | ✗ |

---

## §4 — Action → Permission Mapping (ACTION_PERMISSIONS)

Every authenticated, non-public action must appear in this map.
Actions not in the map are **denied** (fail-closed via `assertAuthorized()`).

### Standard module actions

| Action | Module | Permission | Handler File | Notes |
|---|---|---|---|---|
| `getEmployees` | Employees | canView | Employees.gs | |
| `addOrUpdateEmployee` | Employees | canAdd OR canEdit | Employees.gs | Dynamic: checks canEdit if updating, canAdd if creating |
| `deleteEmployee` | Employees | canDelete | Employees.gs | |
| `getClients` | Clients | canView | Clients.gs | |
| `addOrUpdateClient` | Clients | canAdd OR canEdit | Clients.gs | Dynamic: checks canEdit if updating, canAdd if creating |
| `deleteClient` | Clients | canDelete | Clients.gs | |
| `getGuardDuty` | GuardDuty | canView | GuardDuty.gs | |
| `addGuardDuty` | GuardDuty | canAdd | GuardDuty.gs | |
| `deleteGuardDuty` | GuardDuty | canDelete | GuardDuty.gs | |
| `getDayLabor` | DayLabor | canView | DayLabor.gs | |
| `addDayLabor` | DayLabor | canAdd | DayLabor.gs | |
| `deleteDayLabor` | DayLabor | canDelete | DayLabor.gs | |
| `getEscortDuty` | EscortDuty | canView | EscortDuty.gs | |
| `addEscortDuty` | EscortDuty | canAdd | EscortDuty.gs | |
| `deleteEscortDuty` | EscortDuty | canDelete | EscortDuty.gs | |
| `getLoanAdvance` | LoanAdvance | canView | LoanAdvance.gs | |
| `addLoanAdvance` | LoanAdvance | canAdd | LoanAdvance.gs | |
| `deleteLoanAdvance` | LoanAdvance | canDelete | LoanAdvance.gs | |
| `getSalaryLedger` | Salary | canView | Salary.gs | |
| `generateSalary` | Salary | canAdd | Salary.gs | |
| `getInvoices` | Invoices | canView | Invoices.gs | |
| `generateInvoice` | Invoices | canAdd | Invoices.gs | |
| `finalizeInvoice` | Invoices | canEdit | Invoices.gs | Frontend `canFinalize` maps to backend `canEdit` |
| `markInvoicePaid` | Invoices | canEdit | Invoices.gs | |
| `deleteInvoice` | Invoices | canDelete | Invoices.gs | |
| `addJobPost` | JobPosts | canAdd | JobPosts.gs | |
| `updateJobPost` | JobPosts | canEdit | JobPosts.gs | |
| `deleteJobPost` | JobPosts | canDelete | JobPosts.gs | |
| `getJobApplications` | JobApplications | canView | JobApplications.gs | |
| `updateApplicationStatus` | JobApplications | canEdit | JobApplications.gs | |
| `getDashboardStats` | GuardDuty | canView | GuardDuty.gs | Proxied through GuardDuty module |
| `getUsers` | UserManagement | canView | UserManagement.gs | |
| `addUser` | UserManagement | canAdd | UserManagement.gs | |
| `updateUser` | UserManagement | canEdit | UserManagement.gs | |
| `resetPassword` | UserManagement | canEdit | UserManagement.gs | |
| `deleteUser` | UserManagement | canDelete | UserManagement.gs | |

### Auth-only actions (null permission — gate checks authentication only)

| Action | Handler File | Notes |
|---|---|---|
| `uploadFile` | Files.gs | Handler does module-level `checkPermission(role, payload.module, 'canView')` |
| `getFiles` | Files.gs | Handler does module-level `checkPermission(role, payload.module, 'canView')` |
| `deleteFile` | Files.gs | Handler checks ownership (`uploadedBy === username`) OR Admin role |
| `logout` | Auth.gs | Any authenticated user can log out |

### Ownership rules

| Action | Rule |
|---|---|
| `deleteFile` | User can delete own uploads (`uploadedBy === username`). Admin can delete any file. |

---

## §5 — Public Actions (no authentication required)

These actions are listed in `PUBLIC_ACTIONS` in `Code.gs` and skip the entire
auth gate (no `validateSession`, no `assertAuthenticated`, no `assertAuthorized`).

| Action | Handler File | Notes |
|---|---|---|
| `getJobPosts` | JobPosts.gs | Returns Open-status posts only. Authenticated calls return all posts. |
| `addJobApplication` | JobApplications.gs | External applicant submission. No rate-limiting yet. |
| `getJobApplication` | JobApplications.gs | Applicant status check by application ID. |
| `health` | Code.gs (inline) | System health endpoint. |
| `meta` | Code.gs (inline) | App metadata endpoint. |

**Login bypass:** The `login` action is handled separately before the auth gate
in `handleRequest()` — it is not in `PUBLIC_ACTIONS` but behaves as public since
it cannot require prior authentication.

---

## §6 — Authorization Flow

```
Client request (POST)
        │
        ▼
  handleRequest()
        │
        ├── action === 'login'? ──→ handleLogin() ──→ return
        │
        ├── action in PUBLIC_ACTIONS? ──→ routeAction(action, payload, null) ──→ return
        │
        ▼
  validateSession(token)
        │
        ├── fail → assertAuthenticated() → deny('SESSION_EXPIRED')
        │
        ▼
  assertAuthenticated(sessionResult) ── pass ──→ sessionUser extracted
        │
        ▼
  assertAuthorized(action, sessionUser.role)
        │
        ├── action NOT in ACTION_PERMISSIONS? ──→ deny('FORBIDDEN')  [FAIL-CLOSED]
        │
        ├── ACTION_PERMISSIONS[action] === null? ──→ pass (auth-only)
        │
        ├── permission is string? ──→ checkPermission(role, module, perm)
        │       └── false → deny('FORBIDDEN')
        │
        ├── permission is array? ──→ any(perms, p → checkPermission(role, module, p))
        │       └── all false → deny('FORBIDDEN')
        │
        ▼
  routeAction(action, payload, sessionUser)
        │
        ▼
  Individual handler (defense-in-depth checkPermission calls)
```

### Fail-closed guarantee

Any action string that does NOT appear in `ACTION_PERMISSIONS` AND is not in
`PUBLIC_ACTIONS` AND is not `'login'` will be denied by `assertAuthorized()`.
This is verified at startup by `validatePermissionsConfig()`.

---

## §7 — Defense-in-Depth Patterns

Handlers retain their own `checkPermission()` calls even though the centralized
gate already enforces the same permissions. Seven distinct patterns exist:

| Pattern | Description | Used By |
|---|---|---|
| 1. `if (!checkPermission(role, 'Module', 'perm'))` | Standard single-permission check | Most CRUD handlers |
| 2. `if (!sessionUser \|\| !checkPermission(...))` | Auth + permission combined | Dashboard, JobApplications, UserManagement |
| 3. Dynamic permission variable | `canEdit` if ID present, `canAdd` if new | addOrUpdateEmployee, addOrUpdateClient |
| 4. `payload.module`-based check | Module name from request payload | Files upload/get |
| 5. Ownership + Admin check | Owner OR Admin role | Files delete |
| 6. Conditional public/authenticated | Returns subset if unauthenticated | getJobPosts |
| 7. No check (public) | Intentionally open | addJobApplication, getJobApplication |

---

## §8 — Validation

`validatePermissionsConfig()` in `Code.gs` performs read-only consistency checks:

1. Every action in `routeAction` switch cases exists in `ACTION_PERMISSIONS` or `PUBLIC_ACTIONS` or is `'login'`
2. Every module referenced in `ACTION_PERMISSIONS` exists as a key in `BACKEND_PERMISSIONS.Admin`
3. Every permission referenced in `ACTION_PERMISSIONS` is one of: `canView`, `canAdd`, `canEdit`, `canDelete`
4. All roles in `BACKEND_PERMISSIONS` have the same set of modules

This function logs warnings only — it does not alter runtime behavior.

---

## §9 — Change Protocol

To add a new action:

1. Add the handler function in the appropriate `.gs` file
2. Add the `case` in `routeAction()` with a `// CONTRACT:` comment referencing this document
3. Add the action to `ACTION_PERMISSIONS` (or `PUBLIC_ACTIONS` if unauthenticated)
4. Update this document (§3 matrix if new module, §4 action table, §5 if public)
5. Run `validatePermissionsConfig()` to confirm consistency
6. Update frontend copies if UI gating is needed (non-authoritative)

To change a role's permissions:

1. Update `BACKEND_PERMISSIONS` in `Code.gs` — this is the **only** authoritative change
2. Update this document (§3 matrix)
3. Update handler defense-in-depth checks if the handler pattern uses hardcoded permission names
4. Frontend copies may be updated for UI consistency (non-authoritative)

---

*Document created: Phase 3 — Permission Consolidation & Authorization Contract*
*Cross-referenced by inline `// CONTRACT:` comments in `Code.gs` routeAction()*
