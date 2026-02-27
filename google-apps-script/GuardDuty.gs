/**
 * Al-Aqsa HRM Backend - Guard Duty Handler
 * Operations for guard duty attendance tracking
 *
 * Phase 1 schema:
 *   id, employeeId, employeeName, clientId, clientName,
 *   date, shift, rateSnapshot, status, createdAt
 */

/**
 * Get guard duty records (filtered by date)
 */
function handleGetGuardDuty(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'GuardDuty', 'canView')) {
    return unauthorizedResponse('getGuardDuty');
  }

  try {
    var records = getSheetData(SHEETS.GUARD_DUTY);

    if (payload.date) {
      var filterDate = normalizeDateValue(payload.date);
      records = records.filter(function(r) {
        return normalizeDateValue(r.date) === filterDate;
      });
    }

    records = records.map(function(r) {
      r.date = normalizeDateValue(r.date);
      return r;
    });

    return { success: true, action: 'getGuardDuty', data: records, message: 'Guard duty records retrieved' };
  } catch (error) {
    return sanitizedError('getGuardDuty', error);
  }
}

/**
 * Add guard duty record
 *
 * Phase 1 changes:
 *   - Fetches client.guardRate → stores as rateSnapshot
 *   - Appends earning entry to salary ledger on Present status
 */
function handleAddGuardDuty(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'GuardDuty', 'canAdd')) {
    return unauthorizedResponse('addGuardDuty');
  }

  try {
    var requiredFields = ['id', 'date', 'employeeId', 'employeeName', 'clientId', 'clientName'];
    var validationError = validateRequired(payload, requiredFields);
    if (validationError) {
      return { success: false, action: 'addGuardDuty', data: null, message: validationError };
    }

    var dateStr = String(payload.date).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return { success: false, action: 'addGuardDuty', data: null, message: 'Invalid date format. Expected YYYY-MM-DD.' };
    }

    // Cross-duty conflict validation
    var conflictCheck = validateEmployeeDutyConflict({
      employeeId: String(payload.employeeId).trim(),
      dates: [dateStr],
      shifts: [payload.shift || 'Day'],
      sourceModule: 'GuardDuty'
    });
    if (conflictCheck.conflict) {
      logActivity({ sessionUser: sessionUser, action: 'VALIDATION_REJECTED', module: 'GuardDuty', recordId: payload.id, summary: 'Conflict: ' + conflictCheck.message, date: dateStr, employeeId: String(payload.employeeId).trim(), clientId: String(payload.clientId || '').trim(), success: false, message: conflictCheck.message });
      return { success: false, action: 'addGuardDuty', data: null, message: conflictCheck.message };
    }

    // Fetch client guardRate for snapshot
    var clientId = String(payload.clientId).trim();
    var client = findById(SHEETS.CLIENTS, clientId);
    var rateSnapshot = client ? parseNumber(client.guardRate, 0) : 0;

    var recordData = {
      id: payload.id,
      employeeId: String(payload.employeeId).trim(),
      employeeName: String(payload.employeeName).trim(),
      clientId: clientId,
      clientName: String(payload.clientName).trim(),
      date: dateStr,
      shift: payload.shift || 'Day',
      rateSnapshot: rateSnapshot,
      status: payload.status || 'Present',
      createdAt: getNowISO()
    };

    addRecord(SHEETS.GUARD_DUTY, recordData);

    // Salary crediting delegated to processDailySalary() (Phase 2)

    logActivity({ sessionUser: sessionUser, action: 'addGuardDuty', module: 'GuardDuty', recordId: recordData.id, summary: recordData.employeeName + ' guard duty ' + dateStr + ' ' + recordData.shift, date: dateStr, employeeId: recordData.employeeId, clientId: recordData.clientId, success: true });

    return { success: true, action: 'addGuardDuty', data: recordData, message: 'Guard duty record added' };
  } catch (error) {
    return sanitizedError('addGuardDuty', error);
  }
}

/**
 * Delete guard duty record
 */
function handleDeleteGuardDuty(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'GuardDuty', 'canDelete')) {
    return unauthorizedResponse('deleteGuardDuty');
  }
  
  try {
    if (!payload.id) {
      return {
        success: false,
        action: 'deleteGuardDuty',
        data: null,
        message: 'Missing required field: id'
      };
    }

    // Reverse any salary ledger earnings before deleting the duty
    var reversals = reverseDutyEntries(payload.id);

    const deleted = deleteRecord(SHEETS.GUARD_DUTY, payload.id);
    
    if (deleted) {
      logActivity({ sessionUser: sessionUser, action: 'deleteGuardDuty', module: 'GuardDuty', recordId: payload.id, summary: 'Deleted guard duty ' + payload.id + ' (reversed ' + reversals.length + ' ledger entries)' });
    }

    if (!deleted) {
      return {
        success: false,
        action: 'deleteGuardDuty',
        data: null,
        message: 'Guard duty record not found'
      };
    }
    
    return {
      success: true,
      action: 'deleteGuardDuty',
      data: null,
      message: 'Guard duty record deleted'
    };
  } catch (error) {
    return sanitizedError('deleteGuardDuty', error);
  }
}

/**
 * Get dashboard statistics
 *
 * PHASE 2: Permission enforced at centralized gate (ACTION_PERMISSIONS → GuardDuty/canView)
 * and defense-in-depth check below.
 */
function handleGetDashboardStats(payload, sessionUser) {
  // Defense-in-depth: also enforced by centralized gate
  if (!sessionUser || !checkPermission(sessionUser.role, 'GuardDuty', 'canView')) {
    return unauthorizedResponse('getDashboardStats');
  }

  try {
    const today = getTodayISO();
    const employees = getSheetData(SHEETS.EMPLOYEES);
    const guardDuty = getSheetData(SHEETS.GUARD_DUTY);
    const fileUploads = getSheetData(SHEETS.FILE_UPLOADS);
    
    // Filter today's duty (normalize: sheet may store Date objects)
    const todayDuty = guardDuty.filter(function(r) {
      return normalizeDateValue(r.date) === today;
    });
    
    // Calculate employee stats
    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => {
      var s = (e.status || '').toString().trim().toLowerCase();
      return s === '' || s === 'active';
    }).length;
    const inactiveEmployees = totalEmployees - activeEmployees;
    
    // Calculate guard duty stats for today
    const todayTotal = todayDuty.length;
    const todayDayShift = todayDuty.filter(r => r.shift === 'Day').length;
    const todayNightShift = todayDuty.filter(r => r.shift === 'Night').length;
    const todayPresent = todayDuty.filter(r => r.status === 'Present').length;
    const todayAbsent = todayDuty.filter(r => r.status === 'Absent').length;
    const todayLate = todayDuty.filter(r => r.status === 'Late').length;

    // Calculate file upload stats
    const totalFiles = fileUploads.length;
    const todayFiles = fileUploads.filter(f => f.uploadedAt && f.uploadedAt.startsWith(today)).length;
    
    return {
      success: true,
      action: 'getDashboardStats',
      data: {
        employees: {
          total: totalEmployees,
          active: activeEmployees,
          inactive: inactiveEmployees
        },
        guardDuty: {
          todayTotal: todayTotal,
          todayDayShift: todayDayShift,
          todayNightShift: todayNightShift,
          present: todayPresent,
          absent: todayAbsent,
          late: todayLate
        },
        files: {
          total: totalFiles,
          todayUploads: todayFiles
        }
      },
      message: 'Dashboard stats retrieved'
    };
  } catch (error) {
    return sanitizedError('getDashboardStats', error);
  }
}

// ============================================
// DRY-RUN AUDIT — Legacy Client Data
// ============================================

/**
 * READ-ONLY audit of legacy Guard Duty rows where clientId
 * contains a company name instead of a proper client ID.
 *
 * ██  DRY-RUN ONLY — NO DATA IS WRITTEN  ██
 *
 * Run from Apps Script Editor → Run → auditLegacyGuardDutyClients()
 * Then open View → Logs (or Executions) to read the report.
 *
 * A row is LEGACY-CORRUPTED when ALL are true:
 *   1. clientName is empty / null / whitespace
 *   2. clientId is non-empty
 *   3. clientId does NOT match any Clients.id
 *   4. clientId DOES match a Clients.companyName (case-insensitive, trimmed)
 *
 * A row is ORPHANED when 1+2 are true but neither 3 nor 4 match.
 *
 * @returns {Object} Audit report (also logged)
 */
function auditLegacyGuardDutyClients() {
  // ── Step 1: Read Clients sheet ──────────────────────
  const clientSheet = getSheet(SHEETS.CLIENTS);
  const clientData  = clientSheet.getDataRange().getValues();

  if (clientData.length <= 1) {
    const msg = 'ABORT: Clients sheet is empty (no data rows).';
    Logger.log(msg);
    return { error: msg };
  }

  const clientHeaders = clientData[0].map(String);
  const colId          = clientHeaders.indexOf('id');
  const colCompany     = clientHeaders.indexOf('companyName');
  // Fallback: v3 schema uses 'name' instead of 'companyName'
  const colName        = colCompany >= 0 ? colCompany : clientHeaders.indexOf('name');

  if (colId < 0 || colName < 0) {
    const msg = 'ABORT: Clients sheet missing required columns. Found headers: ' + clientHeaders.join(', ');
    Logger.log(msg);
    return { error: msg };
  }

  // Build lookups
  const clientIdSet = {};          // id → true  (for fast existence check)
  const companyNameMap = {};       // lowercase trimmed companyName → { id, companyName }
  const duplicateNames = [];       // track duplicate companyNames

  for (var i = 1; i < clientData.length; i++) {
    var row = clientData[i];
    var id   = String(row[colId]).trim();
    var name = String(row[colName]).trim();
    var key  = name.toLowerCase();

    if (id) {
      clientIdSet[id] = true;
    }

    if (key) {
      if (companyNameMap[key]) {
        duplicateNames.push({
          name: name,
          firstId: companyNameMap[key].id,
          duplicateId: id,
          clientRow: i + 1
        });
      } else {
        companyNameMap[key] = { id: id, companyName: name };
      }
    }
  }

  // ── Step 2: Validate companyName uniqueness ─────────
  if (duplicateNames.length > 0) {
    var abortMsg = 'ABORT: Duplicate companyName values found in Clients sheet. Cannot safely resolve.\n';
    for (var d = 0; d < duplicateNames.length; d++) {
      abortMsg += '  - "' + duplicateNames[d].name + '" appears in client IDs: '
        + duplicateNames[d].firstId + ' and ' + duplicateNames[d].duplicateId
        + ' (row ' + duplicateNames[d].clientRow + ')\n';
    }
    Logger.log(abortMsg);
    return { error: abortMsg, duplicates: duplicateNames };
  }

  Logger.log('✓ companyName uniqueness validated (' + Object.keys(companyNameMap).length + ' unique names)');

  // ── Step 3: Read Guard Duty sheet with row numbers ──
  var gdSheet = getSheet(SHEETS.GUARD_DUTY);
  var gdData  = gdSheet.getDataRange().getValues();

  if (gdData.length <= 1) {
    var emptyMsg = 'Guard Duty sheet is empty (no data rows). Nothing to audit.';
    Logger.log(emptyMsg);
    return { totalRows: 0, legacyCorrupted: [], orphaned: [], writesPerformed: false };
  }

  var gdHeaders    = gdData[0].map(String);
  var gdColClientId   = gdHeaders.indexOf('clientId');
  var gdColClientName = gdHeaders.indexOf('clientName');

  if (gdColClientId < 0) {
    var msg2 = 'ABORT: Guard Duty sheet missing clientId column. Headers: ' + gdHeaders.join(', ');
    Logger.log(msg2);
    return { error: msg2 };
  }

  // ── Step 4: Scan rows ──────────────────────────────
  var totalDataRows    = gdData.length - 1;
  var legacyCorrupted  = [];
  var orphaned         = [];

  for (var r = 1; r < gdData.length; r++) {
    var gdRow       = gdData[r];
    var clientId    = String(gdRow[gdColClientId] || '').trim();
    var clientName  = gdColClientName >= 0 ? String(gdRow[gdColClientName] || '').trim() : '';
    var sheetRowNum = r + 1; // 1-indexed, accounting for header

    // Condition 1+2: clientName empty AND clientId non-empty
    if (clientName === '' && clientId !== '') {

      // Condition 3: clientId does NOT match any Clients.id
      var isValidId = clientIdSet[clientId] === true;

      if (!isValidId) {
        // Condition 4: clientId matches a companyName
        var lookupKey = clientId.toLowerCase();
        var match     = companyNameMap[lookupKey];

        if (match) {
          // LEGACY-CORRUPTED
          legacyCorrupted.push({
            rowNumber: sheetRowNum,
            currentClientId: clientId,
            proposedClientId: match.id,
            proposedClientName: match.companyName
          });
        } else {
          // ORPHANED — no match anywhere
          orphaned.push({
            rowNumber: sheetRowNum,
            clientIdValue: clientId
          });
        }
      }
      // If isValidId === true, the row is correct (valid clientId, just missing
      // clientName). Not legacy-corrupted, but could be backfilled separately.
    }
  }

  // ── Step 5: Build report ────────────────────────────
  Logger.log('');
  Logger.log('═'.repeat(60));
  Logger.log('  DRY-RUN AUDIT REPORT — Legacy Guard Duty Client Data');
  Logger.log('═'.repeat(60));
  Logger.log('');
  Logger.log('Total Guard Duty rows scanned: ' + totalDataRows);
  Logger.log('Legacy-corrupted rows:         ' + legacyCorrupted.length);
  Logger.log('Orphaned rows:                 ' + orphaned.length);
  Logger.log('');

  if (legacyCorrupted.length > 0) {
    Logger.log('── Legacy-Corrupted Rows ──────────────────────');
    for (var lc = 0; lc < legacyCorrupted.length; lc++) {
      var entry = legacyCorrupted[lc];
      Logger.log(
        '  Row ' + entry.rowNumber
        + ' | Current clientId: "' + entry.currentClientId + '"'
        + ' → Proposed clientId: "' + entry.proposedClientId + '"'
        + ', clientName: "' + entry.proposedClientName + '"'
      );
    }
    Logger.log('');
  }

  if (orphaned.length > 0) {
    Logger.log('── Orphaned Rows (manual review needed) ──────');
    for (var o = 0; o < orphaned.length; o++) {
      var oEntry = orphaned[o];
      Logger.log(
        '  Row ' + oEntry.rowNumber
        + ' | clientId: "' + oEntry.clientIdValue + '" (no matching client)'
      );
    }
    Logger.log('');
  }

  Logger.log('══════════════════════════════════════════════');
  Logger.log('  ██  NO WRITES PERFORMED — DRY RUN ONLY  ██');
  Logger.log('══════════════════════════════════════════════');

  var report = {
    totalRows: totalDataRows,
    legacyCorruptedCount: legacyCorrupted.length,
    orphanedCount: orphaned.length,
    legacyCorrupted: legacyCorrupted,
    orphaned: orphaned,
    writesPerformed: false
  };

  return report;
}

// ============================================
// LIVE CLEANUP — Legacy Client Normalization
// ============================================

/**
 * ONE-TIME live cleanup of legacy Guard Duty rows where clientId
 * contains a company name instead of a proper client ID.
 *
 * ██  THIS FUNCTION WRITES DATA  ██
 *
 * Prerequisites (enforced):
 *   1. Creates a full backup of the Guard Duty sheet before any write
 *   2. Validates companyName uniqueness — aborts on duplicates
 *   3. Skips orphaned rows (logged for manual review)
 *
 * Run from Apps Script Editor → Run → normalizeLegacyGuardDutyClients()
 * Then open View → Logs (or Executions) to read the report.
 *
 * @returns {Object} Cleanup report
 */
function normalizeLegacyGuardDutyClients() {
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  var backupName = 'guardDuty_backup_' + today;

  // ── Step A: BACKUP ──────────────────────────────────
  Logger.log('Step A: Creating backup...');

  var ss = getSpreadsheet();
  var gdSheet = ss.getSheetByName(SHEETS.GUARD_DUTY);

  if (!gdSheet) {
    throw new Error('ABORT: Guard Duty sheet not found.');
  }

  // Check if backup already exists (idempotent — do not overwrite)
  var existingBackup = ss.getSheetByName(backupName);
  if (existingBackup) {
    Logger.log('Backup sheet "' + backupName + '" already exists. Using existing backup.');
  } else {
    var backup = gdSheet.copyTo(ss);
    backup.setName(backupName);
    Logger.log('Backup created: "' + backupName + '"');
  }

  // Verify backup
  var backupSheet = ss.getSheetByName(backupName);
  if (!backupSheet) {
    throw new Error('ABORT: Backup sheet verification failed — sheet not found.');
  }

  var originalRowCount = gdSheet.getLastRow();
  var backupRowCount   = backupSheet.getLastRow();

  if (originalRowCount !== backupRowCount) {
    throw new Error(
      'ABORT: Backup row count mismatch. Original: ' + originalRowCount
      + ', Backup: ' + backupRowCount
    );
  }

  // Verify headers match
  var origHeaders   = gdSheet.getRange(1, 1, 1, gdSheet.getLastColumn()).getValues()[0].map(String);
  var backupHeaders = backupSheet.getRange(1, 1, 1, backupSheet.getLastColumn()).getValues()[0].map(String);

  if (origHeaders.join('|') !== backupHeaders.join('|')) {
    throw new Error('ABORT: Backup header mismatch.');
  }

  Logger.log('✓ Backup verified — ' + backupRowCount + ' rows, headers match.');

  // ── Step B.1: Read Clients sheet ────────────────────
  Logger.log('Step B: Reading Clients sheet...');

  var clientSheet = getSheet(SHEETS.CLIENTS);
  var clientData  = clientSheet.getDataRange().getValues();

  if (clientData.length <= 1) {
    throw new Error('ABORT: Clients sheet is empty (no data rows).');
  }

  var clientHeaders = clientData[0].map(String);
  var colId         = clientHeaders.indexOf('id');
  var colCompany    = clientHeaders.indexOf('companyName');
  var colName       = colCompany >= 0 ? colCompany : clientHeaders.indexOf('name');

  if (colId < 0 || colName < 0) {
    throw new Error('ABORT: Clients sheet missing required columns. Found: ' + clientHeaders.join(', '));
  }

  // Build lookups
  var clientIdSet    = {};
  var companyNameMap = {};
  var duplicateNames = [];

  for (var i = 1; i < clientData.length; i++) {
    var cRow = clientData[i];
    var cId   = String(cRow[colId]).trim();
    var cName = String(cRow[colName]).trim();
    var cKey  = cName.toLowerCase();

    if (cId) {
      clientIdSet[cId] = true;
    }

    if (cKey) {
      if (companyNameMap[cKey]) {
        duplicateNames.push({
          name: cName,
          firstId: companyNameMap[cKey].id,
          duplicateId: cId
        });
      } else {
        companyNameMap[cKey] = { id: cId, companyName: cName };
      }
    }
  }

  // ── Step B.2: Validate uniqueness ───────────────────
  if (duplicateNames.length > 0) {
    var abortMsg = 'ABORT: Duplicate companyName values found. Cannot safely resolve.\n';
    for (var d = 0; d < duplicateNames.length; d++) {
      abortMsg += '  - "' + duplicateNames[d].name + '" in IDs: '
        + duplicateNames[d].firstId + ', ' + duplicateNames[d].duplicateId + '\n';
    }
    throw new Error(abortMsg);
  }

  Logger.log('✓ companyName uniqueness validated (' + Object.keys(companyNameMap).length + ' unique names).');

  // ── Step B.3: Read Guard Duty rows ──────────────────
  Logger.log('Step B.3: Scanning Guard Duty rows...');

  var gdData = gdSheet.getDataRange().getValues();

  var gdHeaders       = gdData[0].map(String);
  var gdColClientId   = gdHeaders.indexOf('clientId');
  var gdColClientName = gdHeaders.indexOf('clientName');

  if (gdColClientId < 0) {
    throw new Error('ABORT: Guard Duty sheet missing clientId column.');
  }
  if (gdColClientName < 0) {
    throw new Error('ABORT: Guard Duty sheet missing clientName column.');
  }

  var totalDataRows = gdData.length - 1;
  var updatedRows   = [];
  var orphanedRows  = [];

  // ── Step B.4: Identify and write corrections ───────
  for (var r = 1; r < gdData.length; r++) {
    var row         = gdData[r];
    var clientId    = String(row[gdColClientId] || '').trim();
    var clientName  = String(row[gdColClientName] || '').trim();
    var sheetRowNum = r + 1; // 1-indexed, header is row 1

    // Condition 1+2: clientName empty AND clientId non-empty
    if (clientName === '' && clientId !== '') {

      // Condition 3: clientId is NOT a valid Clients.id
      var isValidId = clientIdSet[clientId] === true;

      if (!isValidId) {
        var lookupKey = clientId.toLowerCase();
        var match     = companyNameMap[lookupKey];

        if (match) {
          // LEGACY-CORRUPTED — fix it
          var oldClientId    = clientId;
          var newClientId    = match.id;
          var newClientName  = match.companyName;

          // Write clientId (column is gdColClientId + 1 because Sheets are 1-indexed)
          gdSheet.getRange(sheetRowNum, gdColClientId + 1).setValue(newClientId);
          // Write clientName
          gdSheet.getRange(sheetRowNum, gdColClientName + 1).setValue(newClientName);

          updatedRows.push({
            rowNumber: sheetRowNum,
            oldClientId: oldClientId,
            newClientId: newClientId,
            newClientName: newClientName
          });

          Logger.log(
            '  UPDATED Row ' + sheetRowNum
            + ' | clientId: "' + oldClientId + '" → "' + newClientId + '"'
            + ' | clientName: "" → "' + newClientName + '"'
          );
        } else {
          // ORPHANED — skip, log for manual review
          orphanedRows.push({
            rowNumber: sheetRowNum,
            clientIdValue: clientId
          });

          Logger.log(
            '  SKIPPED Row ' + sheetRowNum
            + ' | clientId: "' + clientId + '" (orphaned — no matching client)'
          );
        }
      }
    }
  }

  // ── Step C: Post-run report ─────────────────────────
  Logger.log('');
  Logger.log('═'.repeat(60));
  Logger.log('  LIVE CLEANUP REPORT — Legacy Guard Duty Client Data');
  Logger.log('═'.repeat(60));
  Logger.log('');
  Logger.log('Backup sheet:          ' + backupName);
  Logger.log('Total rows scanned:    ' + totalDataRows);
  Logger.log('Rows updated:          ' + updatedRows.length);
  Logger.log('Rows skipped (orphan): ' + orphanedRows.length);
  Logger.log('');

  if (updatedRows.length > 0) {
    Logger.log('── Updated Rows ──────────────────────────────');
    for (var u = 0; u < updatedRows.length; u++) {
      var uEntry = updatedRows[u];
      Logger.log(
        '  Row ' + uEntry.rowNumber
        + ' | "' + uEntry.oldClientId + '" → clientId: "' + uEntry.newClientId
        + '", clientName: "' + uEntry.newClientName + '"'
      );
    }
    Logger.log('');
  }

  if (orphanedRows.length > 0) {
    Logger.log('── Skipped Orphaned Rows (manual review) ─────');
    for (var s = 0; s < orphanedRows.length; s++) {
      var sEntry = orphanedRows[s];
      Logger.log(
        '  Row ' + sEntry.rowNumber
        + ' | clientId: "' + sEntry.clientIdValue + '"'
      );
    }
    Logger.log('');
  }

  Logger.log('══════════════════════════════════════════════');
  Logger.log('  Legacy Guard Duty cleanup completed successfully');
  Logger.log('══════════════════════════════════════════════');

  return {
    backupSheet: backupName,
    totalRows: totalDataRows,
    rowsUpdated: updatedRows.length,
    rowsSkipped: orphanedRows.length,
    updatedRows: updatedRows,
    orphanedRows: orphanedRows
  };
}
