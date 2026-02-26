/**
 * WARNING — ONE-TIME INITIALIZATION ONLY
 *
 * setupDatabase() is a ONE-TIME initialization function.
 *
 * It creates the v3 database spreadsheet and Drive folder and stores
 * their IDs in PropertiesService (APP_CONFIG).
 *
 * After successful execution:
 * - Configuration is loaded dynamically at runtime
 * - Hardcoded IDs in Code.gs are NOT used
 *
 * DO NOT rerun this function in production.
 * DO NOT hardcode Spreadsheet or Drive IDs in Code.gs.
 * DO NOT call this function from frontend or scheduled triggers.
 */
function setupDatabase() {
  // Check if config already exists in PropertiesService
  const scriptProps = PropertiesService.getScriptProperties();
  const existingConfig = scriptProps.getProperty('APP_CONFIG');
  
  if (existingConfig) {
    const config = JSON.parse(existingConfig);
    
    // Verify existing spreadsheet still exists
    try {
      const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
      if (ss) {
        Logger.log('Database already exists!');
        Logger.log('Spreadsheet ID: ' + config.SPREADSHEET_ID);
        Logger.log('Drive Folder ID: ' + config.DRIVE_FOLDER_ID);
        Logger.log('To reconfigure, first clear APP_CONFIG in PropertiesService');
        return {
          spreadsheetId: config.SPREADSHEET_ID,
          driveFolderId: config.DRIVE_FOLDER_ID,
          alreadyExists: true
        };
      }
    } catch (e) {
      // Spreadsheet no longer exists, need to recreate
      Logger.log('Existing spreadsheet not found, creating new one...');
    }
  }
  
  // Create the spreadsheet
  const ss = SpreadsheetApp.create('Al-Aqsa-App-Database');
  const spreadsheetId = ss.getId();
  
  // Create all sheets with headers
  createSheet(ss, SHEETS.USERS, ['id', 'username', 'passwordHash', 'role', 'status', 'createdAt']);
  createSheet(ss, SHEETS.EMPLOYEES, ['id', 'name', 'phone', 'nid', 'role', 'salary', 'deployedAt', 'joinDate', 'guardianName', 'guardianPhone', 'address', 'status']);
  createSheet(ss, SHEETS.CLIENTS, ['id', 'companyName', 'contactPerson', 'phone', 'email', 'address', 'status', 'name', 'contactRate', 'serviceStartDate', 'lastBillSubmitted', 'billStatus', 'dueAmount', 'assignedEmployeeSalary', 'createdAt']);
  createSheet(ss, SHEETS.GUARD_DUTY, ['id', 'date', 'employeeId', 'employeeName', 'clientId', 'clientName', 'shift', 'status', 'checkIn', 'checkOut', 'notes']);
  createSheet(ss, SHEETS.ESCORT_DUTY, ['id', 'employeeId', 'employeeName', 'clientId', 'clientName', 'vesselName', 'lighterName', 'startDate', 'startShift', 'endDate', 'endShift', 'releasePoint', 'totalDays', 'conveyance', 'status', 'notes']);
  createSheet(ss, SHEETS.DAY_LABOR, ['id', 'date', 'employeeId', 'employeeName', 'clientId', 'clientName', 'shift', 'hoursWorked', 'rate', 'amount', 'notes']);
  createSheet(ss, SHEETS.LOAN_ADVANCE, ['id', 'employeeId', 'employeeName', 'type', 'amount', 'issueDate', 'paymentMethod', 'remarks', 'repaymentType', 'monthlyDeduct', 'status', 'createdAt']);
  createSheet(ss, SHEETS.SALARY_LEDGER, ['id', 'employeeId', 'employeeName', 'sourceModule', 'sourceId', 'date', 'shiftOrHours', 'earnedAmount', 'deductedAmount', 'netChange', 'runningBalance', 'month', 'createdAt']);
  createSheet(ss, SHEETS.PROCESSED_EVENTS, ['eventKey', 'processedAt']);
  createSheet(ss, SHEETS.INVOICES, ['id', 'invoiceNumber', 'clientId', 'clientName', 'periodStart', 'periodEnd', 'totalEscortDays', 'escortAmount', 'totalGuardDays', 'guardAmount', 'totalLaborHours', 'laborAmount', 'subtotal', 'vatPercent', 'vatAmount', 'totalAmount', 'status', 'createdAt']);
  createSheet(ss, SHEETS.FILE_UPLOADS, ['id', 'module', 'recordId', 'fileName', 'fileType', 'fileSize', 'driveFileId', 'driveUrl', 'uploadedAt', 'uploadedBy']);
  createSheet(ss, SHEETS.JOB_POSTS, ['id', 'title', 'description', 'requirements', 'location', 'salary', 'status', 'openDate', 'closeDate', 'createdAt']);
  createSheet(ss, SHEETS.JOB_APPLICATIONS, ['id', 'jobId', 'applicantName', 'phone', 'email', 'experience', 'education', 'skills', 'resumeUrl', 'status', 'appliedAt', 'notes']);
  createSheet(ss, SHEETS.PERMISSIONS, ['role', 'module', 'canView', 'canAdd', 'canEdit', 'canDelete']);
  createSheet(ss, SHEETS.SESSIONS, ['sessionId', 'userId', 'role', 'expiresAt', 'createdAt']);
  createSheet(ss, SHEETS.ACTIVITY_LOGS, ['id', 'timestamp', 'userId', 'userName', 'role', 'action', 'module', 'recordId', 'summary', 'date', 'employeeId', 'clientId', 'success', 'message', 'payloadHash']);
  
  // Remove default Sheet1
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet) {
    ss.deleteSheet(defaultSheet);
  }
  
  // Add default admin user
  const usersSheet = ss.getSheetByName(SHEETS.USERS);
  usersSheet.appendRow(['user-admin-001', 'admin', 'admin123', 'Admin', 'Active', getTodayISO()]);
  
  // Create Drive folder for uploads
  const folder = DriveApp.createFolder('Al-Aqsa-HRM-Uploads');
  const folderId = folder.getId();
  
  // Store configuration in PropertiesService (single source of truth)
  initConfig(spreadsheetId, folderId, 500);
  
  // Log results
  Logger.log('='.repeat(60));
  Logger.log('DATABASE SETUP COMPLETE!');
  Logger.log('='.repeat(60));
  Logger.log('Spreadsheet ID: ' + spreadsheetId);
  Logger.log('Drive Folder ID: ' + folderId);
  Logger.log('');
  Logger.log('Configuration stored in PropertiesService');
  Logger.log('UPDATE CODE.gs is no longer needed - config is automatic');
  Logger.log('='.repeat(60));
  
  return {
    spreadsheetId: spreadsheetId,
    driveFolderId: folderId,
    alreadyExists: false
  };
}

/**
 * Create a sheet with headers
 */
function createSheet(ss, sheetName, headers) {
  const sheet = ss.insertSheet(sheetName);
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  return sheet;
}

/**
 * Migrate existing database sheets to v3 schema.
 * Adds missing columns to existing sheets without deleting data or reordering columns.
 * Safe to run multiple times (idempotent).
 */
function migrateDatabase() {
  const ss = getSpreadsheet();
  const v3Schema = {
    [SHEETS.EMPLOYEES]:        ['id', 'name', 'phone', 'nid', 'role', 'salary', 'deployedAt', 'joinDate', 'guardianName', 'guardianPhone', 'address', 'status'],
    [SHEETS.CLIENTS]:          ['id', 'companyName', 'contactPerson', 'phone', 'email', 'address', 'status', 'name', 'contactRate', 'serviceStartDate', 'lastBillSubmitted', 'billStatus', 'dueAmount', 'assignedEmployeeSalary', 'createdAt'],
    [SHEETS.GUARD_DUTY]:       ['id', 'date', 'employeeId', 'employeeName', 'clientId', 'clientName', 'shift', 'status', 'checkIn', 'checkOut', 'notes'],
    [SHEETS.ESCORT_DUTY]:      ['id', 'employeeId', 'employeeName', 'clientId', 'clientName', 'vesselName', 'lighterName', 'startDate', 'startShift', 'endDate', 'endShift', 'releasePoint', 'totalDays', 'conveyance', 'status', 'notes'],
    [SHEETS.DAY_LABOR]:        ['id', 'date', 'employeeId', 'employeeName', 'clientId', 'clientName', 'shift', 'hoursWorked', 'rate', 'amount', 'notes'],
    [SHEETS.LOAN_ADVANCE]:     ['id', 'employeeId', 'employeeName', 'type', 'amount', 'issueDate', 'paymentMethod', 'remarks', 'repaymentType', 'monthlyDeduct', 'status', 'createdAt'],
    [SHEETS.ACTIVITY_LOGS]:    ['id', 'timestamp', 'userId', 'userName', 'role', 'action', 'module', 'recordId', 'summary', 'date', 'employeeId', 'clientId', 'success', 'message', 'payloadHash']
  };

  const results = [];
  for (const [sheetName, expectedHeaders] of Object.entries(v3Schema)) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log('SKIP: Sheet "' + sheetName + '" not found');
      results.push({ sheet: sheetName, added: [], skipped: true });
      continue;
    }

    const lastCol = sheet.getLastColumn();
    const currentHeaders = lastCol > 0
      ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String)
      : [];

    const missingHeaders = expectedHeaders.filter(h => currentHeaders.indexOf(h) === -1);
    if (missingHeaders.length === 0) {
      Logger.log('OK: Sheet "' + sheetName + '" already up-to-date');
      results.push({ sheet: sheetName, added: [], skipped: false });
      continue;
    }

    // Append missing columns to the right
    const startCol = lastCol + 1;
    sheet.getRange(1, startCol, 1, missingHeaders.length)
      .setValues([missingHeaders])
      .setFontWeight('bold');

    Logger.log('MIGRATED: Sheet "' + sheetName + '" — added columns: ' + missingHeaders.join(', '));
    results.push({ sheet: sheetName, added: missingHeaders, skipped: false });
  }

  Logger.log('='.repeat(60));
  Logger.log('DATABASE MIGRATION COMPLETE');
  Logger.log('='.repeat(60));
  return results;
}

// ============================================
// SPREADSHEET HELPERS
// ============================================

/**
 * Get spreadsheet instance
 */
function getSpreadsheet() {
  if (!CONFIG.SPREADSHEET_ID) {
    throw new Error('SPREADSHEET_ID not configured. Run setupDatabase() first.');
  }
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/**
 * Get sheet by name
 */
function getSheet(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet not found: ' + sheetName);
  }
  return sheet;
}

/**
 * Get all data from sheet as array of objects
 */
function getSheetData(sheetName) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return []; // Only headers, no data
  }
  
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

// ============================================
// INDEXED SHEET LOOKUPS
// ============================================

/**
 * Get indexed sheet data for fast lookups
 * Returns { rows: array of objects, index: { keyValue -> rowIndex } }
 * 
 * RULES:
 * - Indexes are READ-ONLY
 * - Rebuilt per request (no stale cache)
 * - Keys stored as STRING for consistent lookup
 * - rowIndex in index is 0-based into rows array
 * 
 * @param {string} sheetName - Name of sheet
 * @param {string} keyColumn - Column to index by (e.g., 'id', 'username')
 * @returns {Object} { rows: [], index: {}, headers: [] }
 */
function getIndexedSheet(sheetName, keyColumn) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return { rows: [], index: {}, headers: data[0] || [] };
  }
  
  const headers = data[0];
  const keyIndex = headers.indexOf(keyColumn);
  
  if (keyIndex < 0) {
    throw new Error('Index column not found: ' + keyColumn + ' in sheet ' + sheetName);
  }
  
  const rows = [];
  const index = {};
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const obj = {};
    headers.forEach((header, colIndex) => {
      obj[header] = row[colIndex];
    });
    
    // Store in rows array
    const rowIndex = rows.length;
    rows.push(obj);
    
    // Build index (key as string for consistent lookup)
    const keyValue = String(row[keyIndex]);
    index[keyValue] = rowIndex;
  }
  
  return { rows, index, headers };
}

/**
 * Get record from indexed sheet by key value
 * Returns record object or null if not found
 * 
 * @param {Object} indexedSheet - Result from getIndexedSheet()
 * @param {string|number} keyValue - Value to look up
 * @returns {Object|null} Record or null
 */
function getFromIndex(indexedSheet, keyValue) {
  const rowIndex = indexedSheet.index[String(keyValue)];
  if (rowIndex === undefined) {
    return null;
  }
  return indexedSheet.rows[rowIndex];
}

/**
 * Check if key exists in indexed sheet
 * 
 * @param {Object} indexedSheet - Result from getIndexedSheet()
 * @param {string|number} keyValue - Value to check
 * @returns {boolean} True if exists
 */
function indexHasKey(indexedSheet, keyValue) {
  return indexedSheet.index[String(keyValue)] !== undefined;
}

/**
 * Find row index by ID (1-indexed, includes header row)
 */
function findRowById(sheetName, id, idColumn = 'id') {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf(idColumn);
  
  if (idIndex < 0) {
    throw new Error('Column not found: ' + idColumn);
  }
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === id) {
      return i + 1; // Convert to 1-indexed row number
    }
  }
  
  return -1; // Not found
}

/**
 * Find record by ID
 */
function findById(sheetName, id, idColumn = 'id') {
  const records = getSheetData(sheetName);
  return records.find(r => r[idColumn] === id) || null;
}

/**
 * Add record to sheet
 */
function addRecord(sheetName, record) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const row = headers.map(header => record[header] !== undefined ? record[header] : '');
  sheet.appendRow(row);
  
  return record;
}

/**
 * Update record in sheet
 */
function updateRecord(sheetName, id, record, idColumn = 'id') {
  const sheet = getSheet(sheetName);
  const rowIndex = findRowById(sheetName, id, idColumn);
  
  if (rowIndex < 0) {
    return null;
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(header => record[header] !== undefined ? record[header] : '');
  
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
  
  return record;
}

/**
 * Delete record from sheet
 */
function deleteRecord(sheetName, id, idColumn = 'id') {
  const sheet = getSheet(sheetName);
  const rowIndex = findRowById(sheetName, id, idColumn);
  
  if (rowIndex < 0) {
    return false;
  }
  
  sheet.deleteRow(rowIndex);
  return true;
}

/**
 * Add or update record
 */
function upsertRecord(sheetName, id, record, idColumn = 'id') {
  const existing = findById(sheetName, id, idColumn);
  
  if (existing) {
    return updateRecord(sheetName, id, record, idColumn);
  } else {
    return addRecord(sheetName, record);
  }
}

// ============================================
// DATE HELPERS
// ============================================

/**
 * Normalize a date value to YYYY-MM-DD string.
 * Handles: Date objects (from Sheets getValues()), strings, numbers.
 * Returns empty string for falsy / unparseable values.
 * @param {*} value - Raw cell value (Date object, string, etc.)
 * @returns {string} Date in YYYY-MM-DD format, or ''
 */
function normalizeDateValue(value) {
  if (!value && value !== 0) return '';
  // Already a Date object (Google Sheets auto-converts date cells)
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  // String — trim and return if already YYYY-MM-DD
  var s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Try to parse other date string formats
  var d = new Date(s);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return s; // Return as-is if nothing works
}

/**
 * Get today's date in ISO format (YYYY-MM-DD)
 */
function getTodayISO() {
  const now = new Date();
  return Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Get current datetime in ISO format
 */
function getNowISO() {
  const now = new Date();
  return Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
}

/**
 * Get current month in YYYY-MM format
 */
function getCurrentMonth() {
  const now = new Date();
  return Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM');
}

// ============================================
// ID GENERATION
// ============================================

/**
 * Generate unique ID with prefix
 */
function generateId(prefix = '') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return prefix ? prefix + '-' + timestamp + '-' + random : timestamp + '-' + random;
}

// ============================================
// PERMISSION HELPERS
// ============================================

/**
 * Check if user has permission for action
 */
function checkPermission(role, module, permission) {
  if (!role || !BACKEND_PERMISSIONS[role]) {
    return false;
  }
  
  // Normalize module name: accept both "Invoice" (frontend) and "Invoices" (backend)
  var normalizedModule = module;
  if (module === 'Invoice') {
    normalizedModule = 'Invoices';
  }
  
  var modulePerms = BACKEND_PERMISSIONS[role][normalizedModule];
  if (!modulePerms) {
    return false;
  }
  
  return modulePerms[permission] === true;
}

/**
 * Create unauthorized response
 */
function unauthorizedResponse(action) {
  return {
    success: false,
    action: action,
    data: null,
    error: 'FORBIDDEN',
    message: 'Insufficient permissions'
  };
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate required fields
 */
function validateRequired(payload, fields) {
  const missing = fields.filter(f => !payload[f] && payload[f] !== 0);
  return missing.length === 0 ? null : 'Missing required fields: ' + missing.join(', ');
}

/**
 * Parse number safely
 */
function parseNumber(value, defaultValue = 0) {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

// ============================================
// PHASE 2 SECURITY — AUTH GATE FUNCTIONS
// These are the real implementations, wired into handleRequest().
// ============================================

/**
 * Assert that the session validation result indicates a valid user.
 * @param {Object} sessionResult - result from validateSession()
 * @returns {Object|null} denial response if unauthenticated, or null if OK
 */
function assertAuthenticated(sessionResult) {
  if (!sessionResult || sessionResult.error) {
    var errorCode = (sessionResult && sessionResult.error) || 'UNAUTHORIZED';
    return deny(
      errorCode,
      errorCode === 'SESSION_EXPIRED'
        ? 'Session expired. Please log in again.'
        : 'Authentication required'
    );
  }
  if (!sessionResult.user) {
    return deny('UNAUTHORIZED', 'Authentication required');
  }
  return null; // authenticated OK
}

/**
 * Assert that the authenticated user's role is allowed to perform
 * the given action, using the ACTION_PERMISSIONS map as authority.
 *   null entry        → auth-only; allowed for any authenticated user.
 *   missing entry     → FAIL CLOSED (deny by default).
 *   array permission  → allow if ANY listed permission is true.
 *   string permission → single checkPermission() call.
 *
 * @param {string} action - the routeAction case name
 * @param {string} role   - sessionUser.role (Admin | Supervisor | Viewer)
 * @returns {Object|null} denial response if forbidden, or null if OK
 */
function assertAuthorized(action, role) {
  // Fail closed: if action is not in the map, deny
  if (!(action in ACTION_PERMISSIONS)) {
    Logger.log('SECURITY: Unknown action denied (fail-closed): ' + action);
    return deny('FORBIDDEN', 'Action not permitted');
  }

  var perm = ACTION_PERMISSIONS[action];

  // null → auth-only, no role check needed
  if (perm === null) {
    return null;
  }

  // Array of permissions → allow if the role has ANY of them
  if (Array.isArray(perm.permission)) {
    var hasAny = perm.permission.some(function(p) {
      return checkPermission(role, perm.module, p);
    });
    if (!hasAny) {
      return deny('FORBIDDEN', 'Insufficient permissions for ' + perm.module);
    }
    return null;
  }

  // Single permission check
  if (!checkPermission(role, perm.module, perm.permission)) {
    return deny('FORBIDDEN', 'Insufficient permissions for ' + perm.module);
  }
  return null;
}

/**
 * Build a standardised denial response.
 * @param {string} errorCode - UNAUTHORIZED | FORBIDDEN | SESSION_EXPIRED
 * @param {string} message   - human-readable denial reason
 * @param {string} [action]  - optional action name (set by caller if needed)
 * @returns {Object} { success:false, action, data:null, error, message }
 */
function deny(errorCode, message, action) {
  return {
    success: false,
    action: action || '',
    data: null,
    error: errorCode,
    message: message || 'Access denied'
  };
}

/**
 * Return a sanitized error response for handler catch blocks.
 * Logs the real error internally but returns a generic message to the client.
 * @param {string} action - action name for the response
 * @param {Error}  error  - the caught error (logged, not exposed)
 * @returns {Object} safe error response
 */
function sanitizedError(action, error) {
  Logger.log('Handler error [' + action + ']: ' + error.toString());
  return {
    success: false,
    action: action,
    data: null,
    error: 'SERVER_ERROR',
    message: 'An unexpected error occurred. Please try again.'
  };
}

// ============================================
// CROSS-DUTY CONFLICT VALIDATION
// ============================================

/**
 * Check if an employee has a date/shift conflict across all three duty types.
 * Forward-only: called on add/update, does not touch historic data.
 *
 * Rules:
 *  - Guard Duty: 1 employee → max 1 guard shift per date+shift
 *  - Escort Duty: exclusive — blocks BOTH shifts for every date in [startDate, endDate]
 *  - Day Labor:  per-shift — only blocks the same shift on the same date
 *  - An employee on active escort cannot be assigned guard or day-labor for overlapping dates
 *
 * @param {Object}  opts
 * @param {string}  opts.employeeId    - employee to check
 * @param {string[]}opts.dates         - array of YYYY-MM-DD dates to check
 * @param {string[]}[opts.shifts]      - shifts to check (['Day'], ['Night'], or ['Day','Night'] for full-day block)
 * @param {string}  opts.sourceModule  - 'GuardDuty' | 'EscortDuty' | 'DayLabor'
 * @param {string}  [opts.excludeId]   - record ID to exclude (for edits)
 * @returns {Object} { conflict: boolean, message: string }
 */
function validateEmployeeDutyConflict(opts) {
  var empId = String(opts.employeeId);
  var dates = opts.dates || [];
  var shifts = opts.shifts || ['Day', 'Night'];
  var sourceModule = opts.sourceModule;
  var excludeId = opts.excludeId || '';

  // Build a dateSet for fast lookup
  var dateSet = {};
  dates.forEach(function(d) { dateSet[d] = true; });

  // --- Check Guard Duty conflicts ---
  var guardData = getSheetData(SHEETS.GUARD_DUTY);
  for (var i = 0; i < guardData.length; i++) {
    var g = guardData[i];
    if (String(g.employeeId) !== empId) continue;
    if (excludeId && String(g.id) === excludeId) continue;
    var gDate = normalizeDateValue(g.date);
    if (!dateSet[gDate]) continue;
    if (sourceModule === 'GuardDuty') {
      // Conflict only on same shift
      if (shifts.indexOf(g.shift) >= 0) {
        return { conflict: true, message: 'Employee already has a Guard Duty record on ' + gDate + ' (' + g.shift + ' shift)' };
      }
    } else if (sourceModule === 'DayLabor') {
      // Day Labor now per-shift — conflict only on same shift
      if (shifts.indexOf(g.shift) >= 0) {
        return { conflict: true, message: 'Employee has Guard Duty on ' + gDate + ' (' + g.shift + ') — conflicts with Day Labor' };
      }
    } else {
      // Escort blocks both shifts — any guard record on that date is a conflict
      return { conflict: true, message: 'Employee has Guard Duty on ' + gDate + ' (' + g.shift + ') — conflicts with ' + sourceModule };
    }
  }

  // --- Check Escort Duty conflicts (date-range overlap, shift-agnostic, endDate inclusive) ---
  var escortData = getSheetData(SHEETS.ESCORT_DUTY);
  for (var j = 0; j < escortData.length; j++) {
    var e = escortData[j];
    if (String(e.employeeId) !== empId) continue;
    if (excludeId && String(e.id) === excludeId) continue;
    if (String(e.status || '').toLowerCase() !== 'active') continue;
    var eStart = normalizeDateValue(e.startDate);
    var eEnd = e.endDate ? normalizeDateValue(e.endDate) : '9999-12-31';
    for (var k = 0; k < dates.length; k++) {
      if (dates[k] >= eStart && dates[k] <= eEnd) {
        return { conflict: true, message: 'Employee is on Escort Duty (' + eStart + ' – ' + (e.endDate ? eEnd : 'ongoing') + ') — conflicts with ' + sourceModule + ' on ' + dates[k] };
      }
    }
  }

  // --- Check Day Labor conflicts (per-shift) ---
  var laborData = getSheetData(SHEETS.DAY_LABOR);
  for (var m = 0; m < laborData.length; m++) {
    var dl = laborData[m];
    if (String(dl.employeeId) !== empId) continue;
    if (excludeId && String(dl.id) === excludeId) continue;
    var dlDate = normalizeDateValue(dl.date);
    if (!dateSet[dlDate]) continue;
    var dlShift = dl.shift || 'Day';
    if (sourceModule === 'DayLabor') {
      // Day Labor + Day Labor: conflict only on same date + same shift
      if (shifts.indexOf(dlShift) >= 0) {
        return { conflict: true, message: 'Employee already has a Day Labor record on ' + dlDate + ' (' + dlShift + ' shift)' };
      }
    } else if (sourceModule === 'GuardDuty') {
      // Guard + Day Labor: conflict only on same shift
      if (shifts.indexOf(dlShift) >= 0) {
        return { conflict: true, message: 'Employee has Day Labor on ' + dlDate + ' (' + dlShift + ') — conflicts with Guard Duty' };
      }
    } else {
      // Escort blocks both shifts — any day labor on that date is a conflict
      return { conflict: true, message: 'Employee has Day Labor on ' + dlDate + ' — conflicts with ' + sourceModule };
    }
  }

  return { conflict: false, message: '' };
}

/**
 * Expand a date range into an array of YYYY-MM-DD strings (inclusive).
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate   - YYYY-MM-DD (if falsy, returns [startDate])
 * @returns {string[]}
 */
function expandDateRange(startDate, endDate) {
  if (!endDate) return [startDate];
  var result = [];
  var current = new Date(startDate + 'T00:00:00');
  var end = new Date(endDate + 'T00:00:00');
  while (current <= end) {
    var y = current.getFullYear();
    var mm = String(current.getMonth() + 1).padStart(2, '0');
    var dd = String(current.getDate()).padStart(2, '0');
    result.push(y + '-' + mm + '-' + dd);
    current.setDate(current.getDate() + 1);
  }
  return result;
}

// ============================================
// ACTIVITY LOGGING
// ============================================

/**
 * Log an activity to the ACTIVITY_LOGS sheet.
 * Fire-and-forget — errors are swallowed so they never break the calling handler.
 *
 * Stores minimal metadata only — NO raw payload.
 *
 * @param {Object} opts
 * @param {Object} opts.sessionUser - { userId, username, role }
 * @param {string} opts.action      - e.g. 'addGuardDuty', 'deleteEmployee'
 * @param {string} opts.module      - e.g. 'GuardDuty', 'Employees'
 * @param {string} [opts.recordId]  - primary key of affected record
 * @param {string} [opts.summary]   - human-readable one-liner
 * @param {string} [opts.date]      - relevant date (YYYY-MM-DD)
 * @param {string} [opts.employeeId] - affected employee ID
 * @param {string} [opts.clientId]  - affected client ID
 * @param {boolean}[opts.success]   - true if action succeeded (default true)
 * @param {string} [opts.message]   - optional status or error message
 * @param {Object} [opts.payload]   - if provided, SHA-256 hash is stored (NOT the payload itself)
 */
function logActivity(opts) {
  try {
    var user = opts.sessionUser || {};
    var payloadHash = '';
    if (opts.payload) {
      try {
        var raw = typeof opts.payload === 'string' ? opts.payload : JSON.stringify(opts.payload);
        var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
        payloadHash = hash.map(function(b) { return ('0' + ((b < 0 ? b + 256 : b)).toString(16)).slice(-2); }).join('');
      } catch (hashErr) {
        payloadHash = 'hash-error';
      }
    }
    var record = {
      id:          generateId('LOG'),
      timestamp:   getNowISO(),
      userId:      user.userId  || user.username || '',
      userName:    user.username || '',
      role:        user.role     || '',
      action:      opts.action   || '',
      module:      opts.module   || '',
      recordId:    opts.recordId || '',
      summary:     opts.summary  || '',
      date:        opts.date     || '',
      employeeId:  opts.employeeId || '',
      clientId:    opts.clientId || '',
      success:     opts.success !== undefined ? String(opts.success) : 'true',
      message:     opts.message  || '',
      payloadHash: payloadHash
    };
    addRecord(SHEETS.ACTIVITY_LOGS, record);
  } catch (e) {
    Logger.log('logActivity error (swallowed): ' + e.toString());
  }
}

/**
 * Retrieve activity logs. Supports optional filters: module, userId, limit.
 */
function handleGetActivityLogs(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'UserManagement', 'canView')) {
    return unauthorizedResponse('getActivityLogs');
  }
  try {
    var records = getSheetData(SHEETS.ACTIVITY_LOGS);
    // Filter by module
    if (payload.module) {
      var mod = String(payload.module).toLowerCase();
      records = records.filter(function(r) { return (r.module || '').toLowerCase() === mod; });
    }
    // Filter by userId
    if (payload.userId) {
      records = records.filter(function(r) { return r.userId === payload.userId; });
    }
    // Sort newest first
    records.sort(function(a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); });
    // Limit
    var limit = Number(payload.limit) || 200;
    records = records.slice(0, limit);
    return { success: true, action: 'getActivityLogs', data: records, message: 'Activity logs retrieved' };
  } catch (error) {
    return sanitizedError('getActivityLogs', error);
  }
}
