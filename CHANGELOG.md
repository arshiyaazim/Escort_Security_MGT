# Changelog - Al-Aqsa HRM System

## Version 1.1.0 (2026-02-16)

### Backend Fixes (Google Apps Script)

#### 1. CONFIG SAFETY
- **Problem**: CONFIG was hardcoded in Code.gs, causing stale deployment issues when code was updated but not redeployed.
- **Fix**: Configuration now stored in PropertiesService as single source of truth. The `getConfig()` function loads from PropertiesService with fallback to hardcoded values only if empty.
- **Why it was broken**: Each deployment could have different CONFIG values in the editor vs. deployed version, causing spreadsheet ID mismatch errors.
- **How it's now safe**: Configuration is centralized in PropertiesService. Running `setupDatabase()` automatically stores config there. The `initConfig()` function updates the cache immediately.

#### 2. CONFIGURATION VALIDATION
- **Problem**: No validation that spreadsheet existed before operations, causing cryptic errors.
- **Fix**: Added `validateDatabase()` function that checks:
  - Spreadsheet exists and is accessible
  - Required sheets (users, employees, clients, guardDuty, salaryLedger) exist
  - Drive folder is accessible
- **How it's now safe**: Returns clear JSON errors listing what's missing.

#### 3. PREVENT ORPHAN RESOURCES
- **Problem**: Running `setupDatabase()` multiple times created orphan spreadsheets and Drive folders.
- **Fix**: `setupDatabase()` now checks if configuration already exists in PropertiesService and verifies the spreadsheet still exists before creating new ones.
- **How it's now safe**: Returns early with existing configuration if resources are valid.

#### 4. DEPLOYMENT VISIBILITY
- **Problem**: No way to verify which version is deployed.
- **Fix**: Added two new public endpoints:
  - `health` - Returns app version, deployment date, database validation status, and errors
  - `meta` - Returns masked spreadsheet ID and version info
- **How it's now safe**: Can verify live deployment version at runtime.

#### 5. REQUEST ROBUSTNESS
- **Problem**: GAS 302 redirect could cause POST body to be lost, resulting in undefined `postData`.
- **Fix**: 
  - `handleRequest()` now explicitly detects missing postData
  - Returns clear error: `POST_REQUEST_ERROR` when POST body is missing
  - Distinguishes between GET (use parameters) vs POST (require body)
  - Refuses to process empty actions silently - returns `MISSING_ACTION` error
- **How it's now safe**: Fail loudly instead of silently routing empty actions.

#### 6. AUTH TOKEN HYGIENE
- **Problem**: Tokens accumulated indefinitely in PropertiesService.
- **Fix**:
  - Added `MAX_TOKENS` constant (100) as safety cap
  - Added `pruneOldestTokens()` to remove oldest tokens when limit reached
  - `cleanupExpiredTokens()` already existed but wasn't triggered automatically
  - Added `installTokenCleanupTrigger()` to set up daily cleanup
- **How it's now safe**: Automatic cleanup prevents unbounded token accumulation.

#### 7. AUTHORIZATION SAFETY
- **Problem**: OAuth scopes not explicitly declared in appsscript.json.
- **Fix**: Added explicit OAuth scopes:
  - `https://www.googleapis.com/auth/spreadsheets`
  - `https://www.googleapis.com/auth/drive`
  - `https://www.googleapis.com/auth/script.external_request`
  - `https://www.googleapis.com/auth/script.properties`
- **How it's now safe**: Required scopes declared upfront to prevent re-authorization prompts.

#### 8. LOGOUT HANDLING
- **Problem**: `logout` action wasn't included in PUBLIC_ACTIONS but wasn't properly routed.
- **Fix**: Added explicit `logout` case in `routeAction()` function.
- **How it's now safe**: Logout requests are properly handled.

### Frontend Fixes (GitHub Pages)

#### 9. FETCH HARDENING
- **Problem**: `fetch()` used default redirect/mode behavior which could lose POST body.
- **Fix**: Updated `request()` function to explicitly specify:
  - `method: 'POST'`
  - `redirect: 'follow'` (explicitly follow GAS redirects)
  - `mode: 'cors'`
  - `credentials: 'omit'`
- **How it's now safe**: POST body is explicitly preserved across redirects.

#### 10. ERROR VISIBILITY
- **Problem**: Backend errors weren't surfaced clearly in UI.
- **Fix**:
  - Backend now returns structured error responses with `error` field (e.g., `AUTH_REQUIRED`, `POST_REQUEST_ERROR`, `SERVER_ERROR`)
  - Added `getErrorMessage()` function to map errors to user-friendly messages
  - Added `handleAuthError()` to detect auth errors and redirect to login
  - Added `showError()` utility for displaying errors
- **How it's now safe**: Users see clear error messages instead of generic failures.

#### 11. LOGOUT CORRECTNESS
- **Problem**: Frontend logout cleared localStorage but didn't notify backend, leaving orphan tokens.
- **Fix**: `logout()` function now:
  1. Gets token from session
  2. Calls `request('logout', { token })` to invalidate on backend
  3. Only then clears localStorage and redirects
- **How it's now safe**: Backend tokens are properly invalidated on logout.

#### 12. VERSION TRACKING
- **Problem**: No way to match frontend version with backend version.
- **Fix**: Updated `js/config.js` with `APP_VERSION` and `APP_BUILD_DATE` constants.
- **How it's now safe**: Can verify frontend version matches backend.

---

## Previous Version (1.0.0)

- Initial release with basic CRUD operations
- Token-based authentication (24-hour expiry)
- Google Sheets as database
- Google Drive for file uploads
