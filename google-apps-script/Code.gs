/**
 * NOTE:
 * Any Spreadsheet ID or Drive Folder ID defined in this file
 * is legacy and NOT used at runtime.
 *
 * v3 configuration is automatically managed via PropertiesService
 * and initialized by setupDatabase() (one-time).
 *
 * Do NOT update IDs here.
 */

// ============================================
// CONFIGURATION - SINGLE SOURCE OF TRUTH
// Configuration is now stored in PropertiesService to prevent
// stale deployment issues. Run setupDatabase() once to initialize.
// ============================================

// Fallback config (only used if PropertiesService is empty)
const CONFIG_FALLBACK = {
  SPREADSHEET_ID: '1vI2YMvuXHbF4tKbw6Bi-Z7X_nYCnUaZaj5bWglTdAlU',
  DRIVE_FOLDER_ID: '1pqa5gEMF2bppYpxDMLHSbeALNAvQkNNo'
};

// App version for deployment tracking
const APP_VERSION = '1.1.0';
const APP_DEPLOYMENT_DATE = '2026-02-16';

// Cached config to reduce PropertiesService calls
let _configCache = null;

/**
 * Get configuration from PropertiesService (single source of truth)
 * Falls back to hardcoded values only if PropertiesService is empty
 */
function getConfig() {
  if (_configCache) {
    return _configCache;
  }
  
  try {
    const scriptProps = PropertiesService.getScriptProperties();
    const storedConfig = scriptProps.getProperty('APP_CONFIG');
    
    if (storedConfig) {
      _configCache = JSON.parse(storedConfig);
    } else {
      // Use fallback and store it for future use
      _configCache = CONFIG_FALLBACK;
      scriptProps.setProperty('APP_CONFIG', JSON.stringify(CONFIG_FALLBACK));
    }
    
    return _configCache;
  } catch (error) {
    Logger.log('Error loading config: ' + error.toString());
    return CONFIG_FALLBACK;
  }
}

/**
 * Get a specific config value
 */
function getConfigValue(key) {
  const config = getConfig();
  return config[key];
}

// Shorthand accessors
const CONFIG = {
  get SPREADSHEET_ID() { return getConfigValue('SPREADSHEET_ID'); },
  get DRIVE_FOLDER_ID() { return getConfigValue('DRIVE_FOLDER_ID'); }
};

/**
 * Initialize configuration (called by setupDatabase)
 */
function initConfig(spreadsheetId, driveFolderId) {
  const scriptProps = PropertiesService.getScriptProperties();
  const newConfig = {
    SPREADSHEET_ID: spreadsheetId,
    DRIVE_FOLDER_ID: driveFolderId
  };
  
  scriptProps.setProperty('APP_CONFIG', JSON.stringify(newConfig));
  _configCache = newConfig; // Update cache immediately
  
  return newConfig;
}

// Sheet names mapping
const SHEETS = {
  USERS: 'users',
  EMPLOYEES: 'employees',
  CLIENTS: 'clients',
  GUARD_DUTY: 'guardDuty',
  ESCORT_DUTY: 'escortDuty',
  DAY_LABOR: 'dayLabor',
  LOAN_ADVANCE: 'loanAdvance',
  SALARY_LEDGER: 'salaryLedger',
  PROCESSED_EVENTS: 'processedEvents',
  INVOICES: 'invoices',
  INVOICE_DETAILS: 'invoiceDetails',
  FILE_UPLOADS: 'fileUploads',
  JOB_POSTS: 'jobPosts',
  JOB_APPLICATIONS: 'jobApplications',
  PERMISSIONS: 'permissions',
  SESSIONS: 'sessions',
  ACTIVITY_LOGS: 'activityLogs'
};

// ============================================
// PERMISSION MATRIX — CANONICAL SOURCE OF TRUTH
// ============================================
// This is the ONLY permission matrix enforced at runtime.
// Frontend copies (js/api.js, js/permissions.js) are UI-only
// convenience layers — they have NO backend enforcement authority.
//
// Phase 3: Duplication formally documented. Frontend copies remain
// for UI gating but are explicitly non-authoritative.
// See AUTH_CONTRACT.md §1 for the full authorization contract.
//
// Differences from frontend copies:
//   - Backend uses "Invoices"; frontend uses "Invoice"
//     → checkPermission() normalizes "Invoice" → "Invoices"
//   - Frontend copies include "canFinalize"; backend does not
//     → canFinalize is not enforced; finalizeInvoice maps to canEdit
// ============================================
const BACKEND_PERMISSIONS = {
  Admin: {
    Employees: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    Clients: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    GuardDuty: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    EscortDuty: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    DayLabor: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    LoanAdvance: { canView: true, canAdd: true, canEdit: false, canDelete: true },
    Salary: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    Invoices: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    Files: { canView: true, canAdd: true, canEdit: false, canDelete: true },
    JobPosts: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    JobApplications: { canView: true, canAdd: false, canEdit: true, canDelete: false },
    UserManagement: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    Analytics: { canView: true }
  },
  Operations: {
    Employees: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    Clients: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    GuardDuty: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    EscortDuty: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    DayLabor: { canView: true, canAdd: true, canEdit: false, canDelete: false },
    LoanAdvance: { canView: true, canAdd: true, canEdit: false, canDelete: false },
    Salary: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    Invoices: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    Files: { canView: true, canAdd: true, canEdit: false, canDelete: false },
    JobPosts: { canView: true, canAdd: true, canEdit: true, canDelete: false },
    JobApplications: { canView: true, canAdd: false, canEdit: true, canDelete: false },
    UserManagement: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    Analytics: { canView: true }
  },
  Finance: {
    Employees: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    Clients: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    GuardDuty: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    EscortDuty: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    DayLabor: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    LoanAdvance: { canView: true, canAdd: false, canEdit: false, canDelete: true },
    Salary: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    Invoices: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    Files: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    JobPosts: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    JobApplications: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    UserManagement: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    Analytics: { canView: true }
  },
  Auditor: {
    Employees: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    Clients: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    GuardDuty: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    EscortDuty: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    DayLabor: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    LoanAdvance: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    Salary: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    Invoices: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    Files: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    JobPosts: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    JobApplications: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    UserManagement: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    Analytics: { canView: true }
  },
  Viewer: {
    Employees: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    Clients: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    GuardDuty: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    EscortDuty: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    DayLabor: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    LoanAdvance: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    Salary: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    Invoices: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    Files: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    JobPosts: { canView: true, canAdd: false, canEdit: false, canDelete: false },
    JobApplications: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    UserManagement: { canView: false, canAdd: false, canEdit: false, canDelete: false },
    Analytics: { canView: false }
  }
};

// Public actions (no authentication required)
const PUBLIC_ACTIONS = ['getJobPosts', 'addJobApplication', 'getJobApplication', 'health', 'meta'];

// ============================================
// ACTION → PERMISSION MAP (PHASE 2)
// Maps each routed action to the module + permission required.
//   null  = auth-only (no role check at the gate; handler may do its own)
//   array = allow if ANY listed permission is true (for add-or-update actions)
// Public actions and 'login' bypass this map entirely.
// ============================================
const ACTION_PERMISSIONS = {
  // Employees
  getEmployees:            { module: 'Employees', permission: 'canView' },
  addOrUpdateEmployee:     { module: 'Employees', permission: ['canAdd', 'canEdit'] },
  deleteEmployee:          { module: 'Employees', permission: 'canDelete' },
  // Clients
  getClients:              { module: 'Clients', permission: 'canView' },
  addOrUpdateClient:       { module: 'Clients', permission: ['canAdd', 'canEdit'] },
  deleteClient:            { module: 'Clients', permission: 'canDelete' },
  // Guard Duty
  getGuardDuty:            { module: 'GuardDuty', permission: 'canView' },
  addGuardDuty:            { module: 'GuardDuty', permission: 'canAdd' },
  deleteGuardDuty:         { module: 'GuardDuty', permission: 'canDelete' },
  // Day Labor
  getDayLabor:             { module: 'DayLabor', permission: 'canView' },
  addDayLabor:             { module: 'DayLabor', permission: 'canAdd' },
  deleteDayLabor:          { module: 'DayLabor', permission: 'canDelete' },
  // Escort Duty
  getEscortDuty:           { module: 'EscortDuty', permission: 'canView' },
  addEscortDuty:           { module: 'EscortDuty', permission: 'canAdd' },
  updateEscortDuty:        { module: 'EscortDuty', permission: 'canEdit' },
  deleteEscortDuty:        { module: 'EscortDuty', permission: 'canDelete' },
  // Loan / Advance
  getLoanAdvance:          { module: 'LoanAdvance', permission: 'canView' },
  addLoanAdvance:          { module: 'LoanAdvance', permission: 'canAdd' },
  deleteLoanAdvance:       { module: 'LoanAdvance', permission: 'canDelete' },
  // Salary
  getSalaryLedger:         { module: 'Salary', permission: 'canView' },
  // Invoices
  getInvoices:             { module: 'Invoices', permission: 'canView' },
  getInvoiceDetails:       { module: 'Invoices', permission: 'canView' },
  generateInvoice:         { module: 'Invoices', permission: 'canAdd' },
  finalizeInvoice:         { module: 'Invoices', permission: 'canEdit' },
  markInvoicePaid:         { module: 'Invoices', permission: 'canEdit' },
  deleteInvoice:           { module: 'Invoices', permission: 'canDelete' },
  // Files
  uploadFile:              { module: 'Files', permission: 'canAdd' },
  getFiles:                { module: 'Files', permission: 'canView' },
  deleteFile:              { module: 'Files', permission: 'canDelete' },
  // Job Posts (authenticated actions only; getJobPosts is PUBLIC)
  addJobPost:              { module: 'JobPosts', permission: 'canAdd' },
  updateJobPost:           { module: 'JobPosts', permission: 'canEdit' },
  deleteJobPost:           { module: 'JobPosts', permission: 'canDelete' },
  // Job Applications (authenticated actions only)
  getJobApplications:      { module: 'JobApplications', permission: 'canView' },
  updateApplicationStatus: { module: 'JobApplications', permission: 'canEdit' },
  // Dashboard — proxied through GuardDuty/canView
  getDashboardStats:       { module: 'GuardDuty', permission: 'canView' },
  // User Management
  getUsers:                { module: 'UserManagement', permission: 'canView' },
  addUser:                 { module: 'UserManagement', permission: 'canAdd' },
  updateUser:              { module: 'UserManagement', permission: 'canEdit' },
  resetPassword:           { module: 'UserManagement', permission: 'canEdit' },
  deleteUser:              { module: 'UserManagement', permission: 'canDelete' },
  // Auth
  logout:                  null,
  // Activity Logs
  getActivityLogs:         { module: 'UserManagement', permission: 'canView' },
  // Analytics
  getMarginAnalytics:      { module: 'Analytics', permission: 'canView' }
};

// ============================================
// STARTUP VALIDATION
// ============================================

/**
 * Validate that required spreadsheet and sheets exist
 * Returns { valid: boolean, errors: string[] }
 */
function validateDatabase() {
  const errors = [];
  const config = getConfig();
  
  if (!config.SPREADSHEET_ID) {
    errors.push('SPREADSHEET_ID not configured. Run setupDatabase() first.');
    return { valid: false, errors: errors };
  }
  
  try {
    const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
    if (!ss) {
      errors.push('Spreadsheet not accessible: ' + config.SPREADSHEET_ID);
      return { valid: false, errors: errors };
    }
    
    // Check required sheets
    const requiredSheets = [
      SHEETS.USERS,
      SHEETS.EMPLOYEES,
      SHEETS.CLIENTS,
      SHEETS.GUARD_DUTY,
      SHEETS.SALARY_LEDGER
    ];
    
    for (const sheetName of requiredSheets) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        errors.push('Required sheet missing: ' + sheetName);
      }
    }
    
    // Check Drive folder
    if (!config.DRIVE_FOLDER_ID) {
      errors.push('DRIVE_FOLDER_ID not configured');
    } else {
      try {
        const folder = DriveApp.getFolderById(config.DRIVE_FOLDER_ID);
        if (!folder) {
          errors.push('Drive folder not accessible: ' + config.DRIVE_FOLDER_ID);
        }
      } catch (e) {
        errors.push('Drive folder not accessible: ' + config.DRIVE_FOLDER_ID);
      }
    }
    
  } catch (error) {
    errors.push('Database validation error: ' + error.toString());
  }
  
  return { valid: errors.length === 0, errors: errors };
}

/**
 * Get startup validation status
 */
function getStartupStatus() {
  const validation = validateDatabase();
  const config = getConfig();
  
  return {
    appVersion: APP_VERSION,
    deploymentDate: APP_DEPLOYMENT_DATE,
    spreadsheetId: config.SPREADSHEET_ID || 'NOT_CONFIGURED',
    spreadsheetIdMasked: config.SPREADSHEET_ID ? 
      config.SPREADSHEET_ID.substring(0, 8) + '...' : 'NOT_CONFIGURED',
    driveFolderId: config.DRIVE_FOLDER_ID || 'NOT_CONFIGURED',
    databaseValid: validation.valid,
    errors: validation.errors,
    timestamp: new Date().toISOString()
  };
}

// Run startup validation on first request
let _startupValidated = false;
function ensureDatabaseValid() {
  if (_startupValidated) return;
  
  const validation = validateDatabase();
  if (!validation.valid) {
    Logger.log('Startup validation failed: ' + JSON.stringify(validation.errors));
  }
  _startupValidated = true;
}

// ============================================
// PERMISSIONS CONFIG VALIDATION (Phase 3)
// ============================================
// Read-only consistency checker — see AUTH_CONTRACT.md §8.
// Call manually or on first request. Logs warnings only.
// ============================================

/**
 * Validate that ACTION_PERMISSIONS, PUBLIC_ACTIONS, and BACKEND_PERMISSIONS
 * are internally consistent and that routeAction cases are covered.
 *
 * Checks performed:
 *   1. Every module in ACTION_PERMISSIONS exists in BACKEND_PERMISSIONS.Admin
 *   2. Every permission in ACTION_PERMISSIONS is a valid key (canView/canAdd/canEdit/canDelete)
 *   3. All roles in BACKEND_PERMISSIONS have the same set of modules
 *   4. No ACTION_PERMISSIONS entry duplicates a PUBLIC_ACTIONS entry
 *
 * @returns {{ valid: boolean, warnings: string[] }}
 */
function validatePermissionsConfig() {
  var warnings = [];
  var validPerms = ['canView', 'canAdd', 'canEdit', 'canDelete'];
  var adminModules = Object.keys(BACKEND_PERMISSIONS.Admin || {});

  // Check 1 & 2: ACTION_PERMISSIONS modules and permissions exist
  var actions = Object.keys(ACTION_PERMISSIONS);
  for (var i = 0; i < actions.length; i++) {
    var action = actions[i];
    var entry = ACTION_PERMISSIONS[action];
    if (entry === null) continue; // auth-only — no module/perm to validate

    var module = entry.module;
    if (adminModules.indexOf(module) === -1) {
      warnings.push('ACTION_PERMISSIONS["' + action + '"] references unknown module "' + module + '"');
    }

    var perms = Array.isArray(entry.permission) ? entry.permission : [entry.permission];
    for (var j = 0; j < perms.length; j++) {
      if (validPerms.indexOf(perms[j]) === -1) {
        warnings.push('ACTION_PERMISSIONS["' + action + '"] references unknown permission "' + perms[j] + '"');
      }
    }
  }

  // Check 3: All roles have the same module set
  var roles = Object.keys(BACKEND_PERMISSIONS);
  for (var r = 0; r < roles.length; r++) {
    var role = roles[r];
    var roleModules = Object.keys(BACKEND_PERMISSIONS[role]);
    // Modules in Admin but not in this role
    for (var m = 0; m < adminModules.length; m++) {
      if (roleModules.indexOf(adminModules[m]) === -1) {
        warnings.push('BACKEND_PERMISSIONS.' + role + ' is missing module "' + adminModules[m] + '" (present in Admin)');
      }
    }
    // Modules in this role but not in Admin
    for (var m2 = 0; m2 < roleModules.length; m2++) {
      if (adminModules.indexOf(roleModules[m2]) === -1) {
        warnings.push('BACKEND_PERMISSIONS.' + role + ' has extra module "' + roleModules[m2] + '" (not in Admin)');
      }
    }
  }

  // Check 4: No overlap between ACTION_PERMISSIONS and PUBLIC_ACTIONS
  for (var p = 0; p < PUBLIC_ACTIONS.length; p++) {
    if (ACTION_PERMISSIONS.hasOwnProperty(PUBLIC_ACTIONS[p])) {
      warnings.push('Action "' + PUBLIC_ACTIONS[p] + '" is in both PUBLIC_ACTIONS and ACTION_PERMISSIONS — ambiguous');
    }
  }

  if (warnings.length > 0) {
    Logger.log('validatePermissionsConfig — ' + warnings.length + ' warnings:');
    for (var w = 0; w < warnings.length; w++) {
      Logger.log('  ⚠ ' + warnings[w]);
    }
  } else {
    Logger.log('validatePermissionsConfig — all checks passed ✓');
  }

  return { valid: warnings.length === 0, warnings: warnings };
}

// ============================================
// MAIN HANDLERS
// ============================================

/**
 * Handle GET requests
 */
function doGet(e) {
  return handleRequest(e, 'GET');
}

/**
 * Handle POST requests
 */
function doPost(e) {
  return handleRequest(e, 'POST');
}

/**
 * Main request handler - routes to appropriate handler
 * Now resilient to missing postData and detects GET downgrade
 */
function handleRequest(e, method) {
  try {
    // Run startup validation
    ensureDatabaseValid();
    
    // Parse request body
    let body = {};
    
    // CRITICAL: Handle missing postData properly
    // GAS redirects POST to GET can cause postData to be undefined
    if (!e.postData || !e.postData.contents) {
      // Check if this looks like a POST that lost its body (GAS 302 redirect issue)
      if (method === 'POST') {
        // Try to parse from parameter as fallback (less common)
        if (e.parameter && e.parameter.contents) {
          try {
            body = JSON.parse(e.parameter.contents);
          } catch (parseError) {
            // Return clear error for POST without body
            return jsonResponse({
              success: false,
              action: '',
              data: null,
              error: 'POST_REQUEST_ERROR',
              message: 'POST body missing. This may be due to a redirect. Please ensure your request is properly configured.'
            });
          }
        } else {
          // POST but no postData - return clear error
          return jsonResponse({
            success: false,
            action: '',
            data: null,
            error: 'POST_REQUEST_ERROR',
            message: 'POST body is required but was not received. Check your request configuration.'
          });
        }
      }
      // For GET, use parameters as query string
      if (method === 'GET') {
        body = e.parameter || {};
      }
    } else {
      // Normal case: postData exists
      try {
        body = JSON.parse(e.postData.contents);
      } catch (parseError) {
        Logger.log('JSON parse error: ' + parseError.toString());
        return jsonResponse({
          success: false,
          action: '',
          data: null,
          error: 'JSON_PARSE_ERROR',
          message: 'Invalid request format'
        });
      }
    }
    
    const action = body.action || '';
    const payload = body.payload || {};
    const token = body.token || '';
    
    // Handle health and meta actions (public, no auth required)
    if (action === 'health') {
      const status = getStartupStatus();
      return jsonResponse({
        success: status.databaseValid,
        action: 'health',
        data: status,
        message: status.databaseValid ? 'System healthy' : 'System has configuration errors'
      });
    }
    
    if (action === 'meta') {
      const status = getStartupStatus();
      return jsonResponse({
        success: true,
        action: 'meta',
        data: {
          appVersion: status.appVersion,
          deploymentDate: status.deploymentDate,
          spreadsheetIdMasked: status.spreadsheetIdMasked,
          configSource: 'PropertiesService'
        },
        message: 'App metadata retrieved'
      });
    }
    
    // Refuse to process empty actions silently
    if (!action) {
      return jsonResponse({
        success: false,
        action: '',
        data: null,
        error: 'MISSING_ACTION',
        message: 'No action specified. Please provide an action in the request body.'
      });
    }
    
    // ── AUTH GATE (PHASE 2 — ACTIVE) ───────────────────────────
    // 1. Public actions bypass auth entirely.
    // 2. Login bypasses session validation (handled by handleLogin).
    // 3. All other actions: validateSession → assertAuthenticated → assertAuthorized.
    // ─────────────────────────────────────────────────────────────
    var sessionUser = null;
    if (!PUBLIC_ACTIONS.includes(action)) {
      if (action === 'login') {
        // Login bypasses session check — handleLogin validates credentials
      } else {
        // Validate server-side session
        var sessionResult = validateSession(token);
        var authErr = assertAuthenticated(sessionResult);
        if (authErr) {
          authErr.action = action;
          return jsonResponse(authErr);
        }
        sessionUser = sessionResult.user;

        // Enforce role-based authorization
        var permErr = assertAuthorized(action, sessionUser.role);
        if (permErr) {
          permErr.action = action;
          return jsonResponse(permErr);
        }
      }
    }

    // Route to appropriate handler
    var result = routeAction(action, payload, sessionUser);
    return jsonResponse(result);
    
  } catch (error) {
    Logger.log('Error in handleRequest: ' + error.toString());
    return jsonResponse({
      success: false,
      action: '',
      data: null,
      error: 'SERVER_ERROR',
      message: 'An unexpected error occurred. Please try again.'
    });
  }
}

/**
 * Route action to handler
 *
 * Authorization is enforced in two layers:
 *   Layer 1 (centralized): handleRequest() → assertAuthorized() using ACTION_PERMISSIONS map
 *   Layer 2 (defense-in-depth): individual handler checkPermission() calls
 *
 * See AUTH_CONTRACT.md for the full action→permission mapping.
 */
function routeAction(action, payload, sessionUser) {
  switch (action) {

    // ── Employees ─────────────────────────────────────
    // CONTRACT: Employees/{canView,canAdd+canEdit,canDelete} — see AUTH_CONTRACT.md §3
    case 'getEmployees':
      return handleGetEmployees(payload, sessionUser);
    // CONTRACT: Employees/{canAdd,canEdit} (dynamic) — see AUTH_CONTRACT.md §3
    case 'addOrUpdateEmployee':
      return handleAddOrUpdateEmployee(payload, sessionUser);
    // CONTRACT: Employees/canDelete — see AUTH_CONTRACT.md §3
    case 'deleteEmployee':
      return handleDeleteEmployee(payload, sessionUser);

    // ── Clients ───────────────────────────────────────
    // CONTRACT: Clients/{canView,canAdd+canEdit,canDelete} — see AUTH_CONTRACT.md §3
    case 'getClients':
      return handleGetClients(payload, sessionUser);
    // CONTRACT: Clients/{canAdd,canEdit} (dynamic) — see AUTH_CONTRACT.md §3
    case 'addOrUpdateClient':
      return handleAddOrUpdateClient(payload, sessionUser);
    // CONTRACT: Clients/canDelete — see AUTH_CONTRACT.md §3
    case 'deleteClient':
      return handleDeleteClient(payload, sessionUser);

    // ── Guard Duty ────────────────────────────────────
    // CONTRACT: GuardDuty/{canView,canAdd,canDelete} — see AUTH_CONTRACT.md §3
    case 'getGuardDuty':
      return handleGetGuardDuty(payload, sessionUser);
    case 'addGuardDuty':
      return handleAddGuardDuty(payload, sessionUser);
    case 'deleteGuardDuty':
      return handleDeleteGuardDuty(payload, sessionUser);

    // ── Day Labor ─────────────────────────────────────
    // CONTRACT: DayLabor/{canView,canAdd,canDelete} — see AUTH_CONTRACT.md §3
    case 'getDayLabor':
      return handleGetDayLabor(payload, sessionUser);
    case 'addDayLabor':
      return handleAddDayLabor(payload, sessionUser);
    case 'deleteDayLabor':
      return handleDeleteDayLabor(payload, sessionUser);

    // ── Escort Duty ───────────────────────────────────
    // CONTRACT: EscortDuty/{canView,canAdd,canDelete} — see AUTH_CONTRACT.md §3
    case 'getEscortDuty':
      return handleGetEscortDuty(payload, sessionUser);
    case 'addEscortDuty':
      return handleAddEscortDuty(payload, sessionUser);
    case 'updateEscortDuty':
      return handleUpdateEscortDuty(payload, sessionUser);
    case 'deleteEscortDuty':
      return handleDeleteEscortDuty(payload, sessionUser);

    // ── Loan/Advance ──────────────────────────────────
    // CONTRACT: LoanAdvance/{canView,canAdd,canDelete} — see AUTH_CONTRACT.md §3
    case 'getLoanAdvance':
      return handleGetLoanAdvance(payload, sessionUser);
    case 'addLoanAdvance':
      return handleAddLoanAdvance(payload, sessionUser);
    case 'deleteLoanAdvance':
      return handleDeleteLoanAdvance(payload, sessionUser);

    // ── Salary Ledger ─────────────────────────────────
    // CONTRACT: Salary/canView — see AUTH_CONTRACT.md §3
    case 'getSalaryLedger':
      return handleGetSalaryLedger(payload, sessionUser);

    // ── Invoices ──────────────────────────────────────
    // CONTRACT: Invoices/{canView,canAdd,canEdit,canDelete} — see AUTH_CONTRACT.md §3
    // NOTE: Backend module "Invoices"; frontend "Invoice". checkPermission() normalizes.
    case 'getInvoices':
      return handleGetInvoices(payload, sessionUser);
    case 'getInvoiceDetails':
      return handleGetInvoiceDetails(payload, sessionUser);
    case 'generateInvoice':
      return handleGenerateInvoice(payload, sessionUser);
    case 'finalizeInvoice':
      return handleFinalizeInvoice(payload, sessionUser);
    case 'markInvoicePaid':
      return handleMarkInvoicePaid(payload, sessionUser);
    case 'deleteInvoice':
      return handleDeleteInvoice(payload, sessionUser);

    // ── File Uploads ──────────────────────────────────
    // CONTRACT: auth-only at gate; module-level + ownership checks in handler — see AUTH_CONTRACT.md §4
    case 'uploadFile':
      return handleUploadFile(payload, sessionUser);
    case 'getFiles':
      return handleGetFiles(payload, sessionUser);
    case 'deleteFile':
      return handleDeleteFile(payload, sessionUser);

    // ── Job Posts (PUBLIC for getJobPosts with Open status) ──
    // CONTRACT: PUBLIC (getJobPosts); JobPosts/{canAdd,canEdit,canDelete} — see AUTH_CONTRACT.md §3,§5
    case 'getJobPosts':
      return handleGetJobPosts(payload, sessionUser);
    case 'addJobPost':
      return handleAddJobPost(payload, sessionUser);
    case 'updateJobPost':
      return handleUpdateJobPost(payload, sessionUser);
    case 'deleteJobPost':
      return handleDeleteJobPost(payload, sessionUser);

    // ── Job Applications (PUBLIC for add + get single) ─────
    // CONTRACT: PUBLIC (addJobApplication, getJobApplication);
    //   JobApplications/{canView,canEdit} — see AUTH_CONTRACT.md §3,§5
    case 'getJobApplications':
      return handleGetJobApplications(payload, sessionUser);
    case 'addJobApplication':
      return handleAddJobApplication(payload, sessionUser);
    case 'updateApplicationStatus':
      return handleUpdateApplicationStatus(payload, sessionUser);
    case 'getJobApplication':
      return handleGetJobApplication(payload, sessionUser);

    // ── Dashboard ─────────────────────────────────────
    // CONTRACT: GuardDuty/canView (proxy) — see AUTH_CONTRACT.md §3
    case 'getDashboardStats':
      return handleGetDashboardStats(payload, sessionUser);

    // ── User Management & Auth ────────────────────────
    // CONTRACT: PUBLIC (login); auth-only (logout);
    //   UserManagement/{canView,canAdd,canEdit,canDelete} — see AUTH_CONTRACT.md §3
    case 'login':
      return handleLogin(payload);
    case 'logout':
      return handleLogout(payload);
    case 'getUsers':
      return handleGetUsers(payload, sessionUser);
    case 'addUser':
      return handleAddUser(payload, sessionUser);
    case 'updateUser':
      return handleUpdateUser(payload, sessionUser);
    case 'resetPassword':
      return handleResetPassword(payload, sessionUser);
    case 'deleteUser':
      return handleDeleteUser(payload, sessionUser);

    // ── Margin Analytics ──────────────────────────────
    // CONTRACT: Analytics/canView — see AUTH_CONTRACT.md §3
    case 'getMarginAnalytics':
      return handleGetMarginAnalytics(payload, sessionUser);

    // ── Activity Logs ─────────────────────────────────
    case 'getActivityLogs':
      return handleGetActivityLogs(payload, sessionUser);

    default:
      return {
        success: false,
        action: action,
        data: null,
        message: 'Unknown action: ' + action
      };
  }
}

/**
 * Create JSON response
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
