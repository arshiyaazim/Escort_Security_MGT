# Al_Aqsa_HRM_V3

> **Golden Baseline** — Hardened, backend-authoritative Human Resource Management system.

---

## Overview

Al_Aqsa_HRM_V3 is a secure, backend-authoritative HRM (Human Resource Management) system built for Al-Aqsa Security Services. The application manages employees, guard duties, payroll, invoicing, job recruitment, and user access — all enforced exclusively by the backend.

This codebase is the result of a **phased security hardening program (Phase 0–5)**:

| Phase | Scope |
|-------|-------|
| 0 | Forensic audit of all frontend/backend code |
| 1 | Comment-only annotations of risks |
| 2 | Server-side sessions, SHA-256 hashing, centralized auth gate, error sanitization |
| 3 | Permission consolidation, AUTH_CONTRACT.md creation |
| 4 | Frontend auth lifecycle alignment, single session accessor |
| 5 | Final cleanup — all deprecated permission logic, mock handlers, and transitional code removed |

**Client-side permission logic does NOT exist.** The frontend renders all UI unconditionally; the backend (Google Apps Script) is the sole authority for authentication and authorization. See [AUTH_CONTRACT.md](AUTH_CONTRACT.md) and [SECURITY_NOTES.md](SECURITY_NOTES.md) for the full security model.

---

## Key Features

- **Backend-enforced authentication & authorization** — every non-public action is validated server-side
- **Role-based access control** — Admin, HR, Viewer roles defined in `BACKEND_PERMISSIONS` (Code.gs)
- **Secure session management** — server-side sessions with opaque tokens
- **Employee management** — full CRUD with backend permission checks
- **User management** — account creation, role assignment, password reset (Admin only)
- **Salary & payroll modules** — ledger generation from duty/labor/escort/loan sources
- **Guard duty, day labor & escort duty modules** — attendance and assignment tracking
- **Client & invoice management** — client records, invoice generation, finalization, payment tracking
- **File upload with ownership checks** — module-scoped uploads, ownership-based deletion
- **Job posts & job applications** — recruitment pipeline with public application form
- **AI-safe, maintainable architecture** — guardrail documents prevent reintroduction of deprecated patterns

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, Tailwind CSS (CDN), Vanilla JavaScript |
| Backend | Google Apps Script (Web App, CLASP-managed) |
| Database | Google Sheets |
| Authentication | Server-side sessions (SHA-256 hashed passwords) |
| Frontend Hosting | GitHub Pages |
| Backend Hosting | Google Apps Script (deployed as Web App) |

---

## Folder Structure

```
Al_Aqsa_HRM_V3/
│
├── *.html                        # Frontend pages (login, dashboard, modules)
├── css/
│   └── tailwind.css              # Custom Tailwind overrides
├── js/
│   ├── config.js                 # API endpoint, app constants
│   ├── utils.js                  # Shared utility helpers
│   ├── api.js                    # Backend transport layer (request function)
│   ├── auth.js                   # Session management (single authority)
│   ├── ux-utils.js               # UI/UX helpers (toasts, modals)
│   ├── pagination-utils.js       # Table pagination utilities
│   └── <module>.js               # Per-module frontend logic
│
├── google-apps-script/
│   ├── appsscript.json           # GAS project manifest
│   ├── Code.gs                   # Main entry point, auth gate, BACKEND_PERMISSIONS
│   ├── Auth.gs                   # Login, logout, session handlers
│   ├── Utilities.gs              # DB helpers, checkPermission, validation
│   └── <Module>.gs               # Per-module backend handlers
│
├── googleDatabase/               # Google Sheet HTML views (reference)
│
├── SECURITY_NOTES.md             # Security audit findings and resolutions
├── AUTH_CONTRACT.md              # Authorization contract (frontend ↔ backend)
├── CONTRIBUTING_AI.md            # Mandatory rules for AI agents
├── NEW_MODULE_CHECKLIST.md       # Safe module creation checklist
├── README_PHASES.md              # Phase 0–5 historical audit record
├── DEPLOYMENT-CLASP.md           # CLASP deployment guide
└── DEPLOYMENT-CHECKLIST.md       # Pre-deployment verification checklist
```

---

## Prerequisites

Before working with this project, ensure you have:

- **Node.js** (v16+ recommended) — [nodejs.org](https://nodejs.org/)
- **npm** (bundled with Node.js)
- **Git** — [git-scm.com](https://git-scm.com/)
- **Google Account** with access to the project's Google Apps Script and Google Sheets

---

## Install CLASP (Command Line)

CLASP (Command Line Apps Script Projects) is required to manage the Google Apps Script backend.

```bash
# 1. Install CLASP globally
npm install -g @google/clasp

# 2. Login to your Google account
clasp login

# 3. Verify installation
clasp --version
```

> After `clasp login`, a browser window will open for Google OAuth. Authorize the requested permissions to allow CLASP to manage your Apps Script projects.

---

## Create / Link Google Apps Script Project

### Option A: Clone an existing project

```bash
# Clone using the Script ID from the Apps Script editor URL
clasp clone <scriptId>
```

The Script ID is found in the Apps Script editor under **Project Settings → Script ID**.

### Option B: Create a new project (fresh setup)

```bash
clasp create --title "Al_Aqsa_HRM_V3" --type webapp
```

### Project manifest

The `appsscript.json` file defines the project configuration (runtime version, webapp settings, OAuth scopes). It is managed by CLASP and should be committed to version control.

---

## Backend Development Workflow

```bash
# 1. Pull the latest backend code from Google Apps Script
clasp pull

# 2. Edit .gs files locally in your editor

# 3. Push changes to Google Apps Script (MANUAL ONLY — never auto-push)
clasp push

# 4. Deploy a new version (MANUAL ONLY)
clasp deploy -d "Description of changes"
```

> **Important:** Always use `clasp push` and `clasp deploy` manually. Never configure auto-deployment hooks. See [DEPLOYMENT-CLASP.md](DEPLOYMENT-CLASP.md) for the full workflow.

---

## Frontend Development Workflow

The frontend is a collection of static HTML and JavaScript files — no build step required.

1. **Edit** HTML/JS/CSS files directly in your editor
2. **Test locally** by opening HTML files in a browser (API calls will target the live backend)
3. **Deploy** by pushing to the `main` branch — GitHub Pages serves the frontend automatically

```bash
# Local testing
# Open any .html file directly in your browser

# Deploy to GitHub Pages
git add .
git commit -m "description of changes"
git push origin main
```

---

## Deployment Process

### Backend (Google Apps Script)

```bash
# 1. Push .gs files to Apps Script
clasp push

# 2. Create a new deployment
clasp deploy -d "v3.x.x — description"

# 3. Copy the new Web App URL from the output

# 4. Update the API endpoint in js/config.js (if the URL changed)
```

### Frontend (GitHub Pages)

```bash
# Push to main — GitHub Pages auto-deploys
git push origin main
```

> **Never deploy backend and frontend simultaneously without verifying the API endpoint matches.**

---

## Running the App

1. **Access the frontend** at the GitHub Pages URL (e.g., `https://<username>.github.io/Al_Aqsa_HRM_V3/`)
2. **Login** with your credentials on the login page — the backend validates credentials and creates a server-side session
3. **Session behavior** — a session token is stored in `localStorage` and sent with every API request; the backend validates it on each call
4. **Navigation** — all protected pages call `requireAuth()` on load, which verifies the session with the backend
5. **Unauthorized access** — if the session is invalid or expired, the user is automatically redirected to the login page
6. **Logout** — clears the local session and invalidates the server-side session

---

## Security Model (Important)

- **Backend is the sole authority** — all authentication and authorization decisions are made by `Code.gs`
- **Frontend never enforces permissions** — all UI elements render unconditionally; unauthorized actions are rejected server-side with `FORBIDDEN`
- **Session token is opaque** — the frontend stores a token string only; it contains no role, permission, or identity data
- **All access is validated server-side** — every non-public API action passes through a centralized auth gate before reaching the handler
- **Role-based permissions** — the `BACKEND_PERMISSIONS` matrix in `Code.gs` maps roles (Admin, HR, Viewer) to module-level capabilities (canView, canAdd, canEdit, canDelete)
- **Defense-in-depth** — individual handlers retain their own `checkPermission()` calls in addition to the centralized gate
- **No client-side permission logic exists** — `permissions.js` is a tombstone file; no `canView`, `canEdit`, `checkPageAccess`, or `initPermissionUI` functions exist in the codebase

For the complete security model, see:
- [SECURITY_NOTES.md](SECURITY_NOTES.md) — audit findings, risk tracking, resolution status
- [AUTH_CONTRACT.md](AUTH_CONTRACT.md) — formal authorization contract between frontend and backend

---

## Contribution Rules (AI & Human)

Before modifying this codebase, **all contributors** (human and AI) must read:

- [CONTRIBUTING_AI.md](CONTRIBUTING_AI.md) — mandatory rules, forbidden patterns, allowed patterns
- [NEW_MODULE_CHECKLIST.md](NEW_MODULE_CHECKLIST.md) — step-by-step checklist for adding new modules safely

Key rules:
1. **No client-side permission checks** — the backend is the sole authority
2. **No mock handlers or `USE_BACKEND` toggles** — deleted in Phase 5, must not be reintroduced
3. **No `permissions.js` resurrection** — the file is a tombstone
4. **No duplicate session accessors** — `getSessionToken()` in `auth.js` is canonical
5. **Backend first** — always implement backend permission mappings before creating frontend UI

---

## ⚠️ WARNING

> **This repository is a hardened baseline.**
>
> Do **NOT** reintroduce client-side authentication or permission logic.
> Do **NOT** add mock data stores, `USE_BACKEND` toggles, or frontend permission matrices.
> Do **NOT** copy patterns from the pre-Phase 5 codebase.
>
> All access control is enforced by the backend (`Code.gs`).
> See [CONTRIBUTING_AI.md](CONTRIBUTING_AI.md) for the full list of forbidden patterns.

---

## License

Internal use — Al-Aqsa Security Services.
