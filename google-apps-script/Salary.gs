/**
 * Al-Aqsa HRM Backend - Salary Ledger Handler
 *
 * Phase 1 schema (with reversal engine):
 *   id, employeeId, employeeName, clientId, clientName,
 *   sourceModule, sourceId, entryType, dutyType,
 *   rateSnapshot, quantity, amount, reversalOf,
 *   createdAt, runningBalance
 *
 * entryType: 'earning' | 'advance' | 'reversal'
 * sourceModule: 'GuardDuty' | 'EscortDuty' | 'DayLabor' | 'LoanAdvance'
 * Append-only — no edits or deletes allowed.  Use reversal entries only.
 * reversalOf: links a reversal entry to the original entry ID it cancels.
 */

/**
 * Get salary ledger records (filtered by employeeId and/or month)
 */
function handleGetSalaryLedger(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'Salary', 'canView')) {
    return unauthorizedResponse('getSalaryLedger');
  }

  try {
    var records = getSheetData(SHEETS.SALARY_LEDGER);

    // Filter by employeeId/Name if provided
    if (payload.employeeId) {
      var searchTerm = String(payload.employeeId).toLowerCase();
      records = records.filter(function(e) {
        return (e.employeeName && e.employeeName.toLowerCase().indexOf(searchTerm) !== -1) ||
               e.employeeId === payload.employeeId;
      });
    }

    // Filter by month (YYYY-MM) — match against createdAt
    if (payload.month) {
      var filterMonth = String(payload.month).trim();
      records = records.filter(function(e) {
        var created = normalizeDateValue(e.createdAt);
        return created.substring(0, 7) === filterMonth;
      });
    }

    return { success: true, action: 'getSalaryLedger', data: records, message: 'Salary ledger retrieved' };
  } catch (error) {
    return sanitizedError('getSalaryLedger', error);
  }
}

/**
 * Append a single entry to the salary ledger.
 *
 * Calculates runningBalance from the employee's last entry.
 * This is the ONLY write path — all duty handlers and loan handler call this.
 *
 * @param {Object} entry  Required keys:
 *   employeeId, employeeName, clientId, clientName,
 *   sourceModule, sourceId, entryType, dutyType,
 *   rateSnapshot, quantity, amount
 * @returns {Object} The persisted ledger row (with id, runningBalance, createdAt)
 */
function appendLedgerEntry(entry) {
  // Compute running balance for this employee
  var allRecords = getSheetData(SHEETS.SALARY_LEDGER);
  var empRecords = allRecords.filter(function(r) {
    return r.employeeId === entry.employeeId;
  });
  var lastBalance = 0;
  if (empRecords.length > 0) {
    // Last row by insertion order (sheet append order)
    lastBalance = parseNumber(empRecords[empRecords.length - 1].runningBalance, 0);
  }
  var newBalance = parseFloat((lastBalance + parseNumber(entry.amount, 0)).toFixed(2));

  var row = {
    id: generateId('SAL'),
    employeeId: entry.employeeId || '',
    employeeName: entry.employeeName || '',
    clientId: entry.clientId || '',
    clientName: entry.clientName || '',
    sourceModule: entry.sourceModule || '',
    sourceId: entry.sourceId || '',
    entryType: entry.entryType || 'earning',
    dutyType: entry.dutyType || '',
    rateSnapshot: parseNumber(entry.rateSnapshot, 0),
    quantity: parseNumber(entry.quantity, 0),
    amount: parseNumber(entry.amount, 0),
    reversalOf: entry.reversalOf || '',
    createdAt: getNowISO(),
    runningBalance: newBalance
  };

  addRecord(SHEETS.SALARY_LEDGER, row);
  return row;
}

// ============================================================
// PHASE 2 — UNIFIED DAILY SALARY ENGINE
// ============================================================
// Designed to run once per day at 23:59 GMT via time-driven trigger.
// Idempotent: uses processedEvents + ledger quantity checks to
// ensure no duplicate credits on re-run.
// ============================================================

/**
 * Mark an event as processed (idempotency guard).
 * @param {string} eventKey - Unique key (e.g. "GD|<recordId>|<date>")
 */
function markEventProcessed_(eventKey) {
  addRecord(SHEETS.PROCESSED_EVENTS, {
    eventKey: eventKey,
    processedAt: getNowISO()
  });
}

/**
 * Check whether an event has already been processed.
 * Loads the full processedEvents sheet and builds a Set for O(1) lookups
 * when called repeatedly within the same run.
 * @param {Object} eventsIndex - Set of previously processed eventKeys
 * @param {string} eventKey
 * @returns {boolean}
 */
function isEventProcessed_(eventsIndex, eventKey) {
  return eventsIndex.has(eventKey);
}

/**
 * Build a Set of all processed event keys (one-time per run).
 * @returns {Set<string>}
 */
function loadProcessedEventsIndex_() {
  var rows = getSheetData(SHEETS.PROCESSED_EVENTS);
  var s = new Set();
  for (var i = 0; i < rows.length; i++) {
    s.add(String(rows[i].eventKey));
  }
  return s;
}

/**
 * Sum already-credited quantity in the salary ledger for a given
 * sourceModule + sourceId combination.
 * @param {Array} ledgerRows - Full ledger data (pre-loaded)
 * @param {string} sourceModule
 * @param {string} sourceId
 * @returns {number} Total credited quantity
 */
function getCreditedQuantity_(ledgerRows, sourceModule, sourceId) {
  var total = 0;
  for (var i = 0; i < ledgerRows.length; i++) {
    var r = ledgerRows[i];
    if (r.sourceModule === sourceModule && r.sourceId === sourceId &&
        (r.entryType === 'earning' || r.entryType === 'reversal')) {
      total += parseNumber(r.quantity, 0);
    }
  }
  return total;
}

/**
 * Sum already-credited amount in the salary ledger for a given
 * sourceModule + sourceId + specific dutyType.
 * @param {Array} ledgerRows
 * @param {string} sourceModule
 * @param {string} sourceId
 * @param {string} dutyType
 * @returns {number}
 */
function getCreditedAmount_(ledgerRows, sourceModule, sourceId, dutyType) {
  var total = 0;
  for (var i = 0; i < ledgerRows.length; i++) {
    var r = ledgerRows[i];
    if (r.sourceModule === sourceModule && r.sourceId === sourceId && r.dutyType === dutyType &&
        (r.entryType === 'earning' || r.entryType === 'reversal' || r.entryType === 'advance')) {
      total += parseNumber(r.amount, 0);
    }
  }
  return total;
}

// ────────────────────────────────────────────
// GUARD DUTY PROCESSOR
// ────────────────────────────────────────────
/**
 * Process all guard duty records for today.
 *
 * Rules:
 *   Present → quantity 1
 *   Late    → quantity 0.5
 *   Absent  → quantity 0  (no credit)
 *   Double shift allowed (Day + Night = 2 records)
 *   Multi-duty allowed except escort overlap (handled at entry)
 *
 * Idempotency:
 *   eventKey = "GD|<recordId>"
 *   Also checks already-credited quantity in ledger.
 *   Adds difference only.
 *
 * @param {string} today - YYYY-MM-DD
 * @param {Array} ledgerRows - Pre-loaded salary ledger rows
 * @param {Set} eventsIndex - Pre-loaded processed events
 * @returns {Object} { processed: number, skipped: number, credited: number }
 */
function processGuardSalary(today, ledgerRows, eventsIndex) {
  var stats = { processed: 0, skipped: 0, credited: 0 };
  var guardRecords = getSheetData(SHEETS.GUARD_DUTY);

  // Filter to today's records
  var todayRecords = guardRecords.filter(function(r) {
    return normalizeDateValue(r.date) === today;
  });

  for (var i = 0; i < todayRecords.length; i++) {
    var rec = todayRecords[i];
    var eventKey = 'GD|' + rec.id;

    // Skip if already processed
    if (isEventProcessed_(eventsIndex, eventKey)) {
      stats.skipped++;
      continue;
    }

    // Determine quantity from status
    var statusLower = String(rec.status || '').toLowerCase();
    var qty = 0;
    if (statusLower === 'present') {
      qty = 1;
    } else if (statusLower === 'late') {
      qty = 0.5;
    }
    // Absent = 0 → no credit

    if (qty <= 0) {
      // Mark processed even for absent so we don't revisit
      markEventProcessed_(eventKey);
      eventsIndex.add(eventKey);
      stats.processed++;
      continue;
    }

    // Check already-credited quantity in ledger
    var alreadyCredited = getCreditedQuantity_(ledgerRows, 'GuardDuty', rec.id);
    var diff = parseFloat((qty - alreadyCredited).toFixed(4));

    if (diff <= 0) {
      // Already fully credited
      markEventProcessed_(eventKey);
      eventsIndex.add(eventKey);
      stats.skipped++;
      continue;
    }

    var rate = parseNumber(rec.rateSnapshot, 0);
    var amount = parseFloat((diff * rate).toFixed(2));

    var entry = appendLedgerEntry({
      employeeId: rec.employeeId || '',
      employeeName: rec.employeeName || '',
      clientId: rec.clientId || '',
      clientName: rec.clientName || '',
      sourceModule: 'GuardDuty',
      sourceId: rec.id,
      entryType: 'earning',
      dutyType: rec.shift || 'Day',
      rateSnapshot: rate,
      quantity: diff,
      amount: amount
    });

    // Push into local ledger copy so subsequent lookups see it
    ledgerRows.push(entry);

    markEventProcessed_(eventKey);
    eventsIndex.add(eventKey);
    stats.processed++;
    stats.credited++;
  }

  return stats;
}

// ────────────────────────────────────────────
// ESCORT DUTY PROCESSOR
// ────────────────────────────────────────────
/**
 * Process all active/recently-completed escort duties.
 *
 * Formula:
 *   effectiveEnd =
 *     if On-going → today
 *     if Completed → min(today, endDate)
 *
 *   totalCalendarDays = inclusive date diff (effectiveEnd − startDate + 1)
 *   totalShifts = totalCalendarDays × 2
 *   if startShift = Night → totalShifts -= 1
 *   if Completed AND endShift = Day → totalShifts -= 1
 *   payableDays = totalShifts × 0.5
 *
 * Compare payableDays with already-credited quantity.
 * Add difference only.
 *
 * If Completed AND conveyance not credited → add conveyance as separate entry.
 *
 * @param {string} today - YYYY-MM-DD
 * @param {Array} ledgerRows - Pre-loaded salary ledger rows
 * @param {Set} eventsIndex - Pre-loaded processed events
 * @returns {Object} { processed: number, skipped: number, credited: number }
 */
function processEscortSalary(today, ledgerRows, eventsIndex) {
  var stats = { processed: 0, skipped: 0, credited: 0 };
  var escortRecords = getSheetData(SHEETS.ESCORT_DUTY);

  for (var i = 0; i < escortRecords.length; i++) {
    var rec = escortRecords[i];
    var statusLower = String(rec.status || '').toLowerCase();
    var startDateStr = normalizeDateValue(rec.startDate);

    // Skip records with no start date
    if (!startDateStr) {
      stats.skipped++;
      continue;
    }

    // Only process On-going or Completed duties that fall within range
    var isOngoing = statusLower === 'on-going' || statusLower === 'ongoing';
    var isCompleted = statusLower === 'completed';
    if (!isOngoing && !isCompleted) {
      stats.skipped++;
      continue;
    }

    // Calculate effectiveEnd
    var effectiveEnd;
    if (isOngoing) {
      effectiveEnd = today;
    } else {
      // Completed → min(today, endDate)
      var endDateStr = normalizeDateValue(rec.endDate);
      if (!endDateStr) endDateStr = today;
      effectiveEnd = endDateStr <= today ? endDateStr : today;
    }

    // If effectiveEnd < startDate, skip (future duty or data error)
    if (effectiveEnd < startDateStr) {
      stats.skipped++;
      continue;
    }

    // Don't process if duty hasn't started yet
    if (startDateStr > today) {
      stats.skipped++;
      continue;
    }

    // Calculate totalCalendarDays (inclusive)
    var startMs = new Date(startDateStr + 'T00:00:00Z').getTime();
    var endMs = new Date(effectiveEnd + 'T00:00:00Z').getTime();
    var totalCalendarDays = Math.round((endMs - startMs) / 86400000) + 1;

    // Calculate totalShifts
    var totalShifts = totalCalendarDays * 2;

    // Adjust for start shift
    var startShift = String(rec.startShift || '').toLowerCase();
    if (startShift === 'night') {
      totalShifts -= 1;
    }

    // Adjust for end shift (only if Completed)
    if (isCompleted) {
      var endShift = String(rec.endShift || '').toLowerCase();
      if (endShift === 'day') {
        totalShifts -= 1;
      }
    }

    // payableDays
    var payableDays = parseFloat((totalShifts * 0.5).toFixed(4));
    if (payableDays <= 0) {
      stats.skipped++;
      continue;
    }

    // Compare with already-credited quantity
    var alreadyCredited = getCreditedQuantity_(ledgerRows, 'EscortDuty', rec.id);
    var diff = parseFloat((payableDays - alreadyCredited).toFixed(4));

    if (diff > 0) {
      var rate = parseNumber(rec.rateSnapshot, 0);
      var amount = parseFloat((diff * rate).toFixed(2));

      var entry = appendLedgerEntry({
        employeeId: rec.employeeId || '',
        employeeName: rec.employeeName || '',
        clientId: rec.clientId || '',
        clientName: rec.clientName || '',
        sourceModule: 'EscortDuty',
        sourceId: rec.id,
        entryType: 'earning',
        dutyType: 'Escort',
        rateSnapshot: rate,
        quantity: diff,
        amount: amount
      });

      ledgerRows.push(entry);
      stats.credited++;
    }

    // Conveyance: credit once when Completed
    if (isCompleted) {
      var conveyance = parseNumber(rec.conveyance, 0);
      if (conveyance > 0) {
        var conveyanceKey = 'ED-CONV|' + rec.id;
        if (!isEventProcessed_(eventsIndex, conveyanceKey)) {
          // Check ledger for existing conveyance credit
          var existingConv = getCreditedAmount_(ledgerRows, 'EscortDuty', rec.id, 'Conveyance');
          if (existingConv < conveyance) {
            var convDiff = parseFloat((conveyance - existingConv).toFixed(2));
            var convEntry = appendLedgerEntry({
              employeeId: rec.employeeId || '',
              employeeName: rec.employeeName || '',
              clientId: rec.clientId || '',
              clientName: rec.clientName || '',
              sourceModule: 'EscortDuty',
              sourceId: rec.id,
              entryType: 'earning',
              dutyType: 'Conveyance',
              rateSnapshot: 0,
              quantity: 1,
              amount: convDiff
            });
            ledgerRows.push(convEntry);
          }
          markEventProcessed_(conveyanceKey);
          eventsIndex.add(conveyanceKey);
        }
      }
    }

    stats.processed++;
  }

  return stats;
}

// ────────────────────────────────────────────
// DAY LABOR PROCESSOR
// ────────────────────────────────────────────
/**
 * Process all day labor records for today.
 *
 * Uses stored snapshot amounts (totalAmount) from the duty record.
 * Adds ledger entry if not already credited (eventKey check).
 *
 * @param {string} today - YYYY-MM-DD
 * @param {Array} ledgerRows - Pre-loaded salary ledger rows
 * @param {Set} eventsIndex - Pre-loaded processed events
 * @returns {Object} { processed: number, skipped: number, credited: number }
 */
function processDayLaborSalary(today, ledgerRows, eventsIndex) {
  var stats = { processed: 0, skipped: 0, credited: 0 };
  var dayLaborRecords = getSheetData(SHEETS.DAY_LABOR);

  // Filter to today's records
  var todayRecords = dayLaborRecords.filter(function(r) {
    return normalizeDateValue(r.date) === today;
  });

  for (var i = 0; i < todayRecords.length; i++) {
    var rec = todayRecords[i];
    var eventKey = 'DL|' + rec.id;

    // Skip if already processed
    if (isEventProcessed_(eventsIndex, eventKey)) {
      stats.skipped++;
      continue;
    }

    var totalAmount = parseNumber(rec.totalAmount, 0);
    if (totalAmount <= 0) {
      markEventProcessed_(eventKey);
      eventsIndex.add(eventKey);
      stats.processed++;
      continue;
    }

    // Check if already credited in ledger
    var alreadyCredited = getCreditedQuantity_(ledgerRows, 'DayLabor', rec.id);
    if (alreadyCredited > 0) {
      // Already has a ledger entry for this record
      markEventProcessed_(eventKey);
      eventsIndex.add(eventKey);
      stats.skipped++;
      continue;
    }

    var entry = appendLedgerEntry({
      employeeId: rec.employeeId || '',
      employeeName: rec.employeeName || '',
      clientId: rec.clientId || '',
      clientName: rec.clientName || '',
      sourceModule: 'DayLabor',
      sourceId: rec.id,
      entryType: 'earning',
      dutyType: parseNumber(rec.hoursWorked, 0) + 'h',
      rateSnapshot: parseNumber(rec.baseRateSnapshot, 0),
      quantity: parseNumber(rec.hoursWorked, 0),
      amount: totalAmount
    });

    ledgerRows.push(entry);
    markEventProcessed_(eventKey);
    eventsIndex.add(eventKey);
    stats.processed++;
    stats.credited++;
  }

  return stats;
}

// ────────────────────────────────────────────
// MAIN ORCHESTRATOR
// ────────────────────────────────────────────
/**
 * Unified daily salary processor.
 *
 * Designed to run at 23:59 GMT daily via time-driven trigger.
 * Processes guard duty, escort duty, and day labor for today.
 * Fully idempotent — safe to re-run.
 *
 * @returns {Object} Summary of processing results
 */
function processDailySalary() {
  var today = getTodayISO();
  Logger.log('[DailySalary] Starting daily salary processing for ' + today);

  // Pre-load shared data once for performance
  var ledgerRows = getSheetData(SHEETS.SALARY_LEDGER);
  var eventsIndex = loadProcessedEventsIndex_();

  // Process each module
  var guardStats = processGuardSalary(today, ledgerRows, eventsIndex);
  Logger.log('[DailySalary] Guard Duty: ' + JSON.stringify(guardStats));

  var escortStats = processEscortSalary(today, ledgerRows, eventsIndex);
  Logger.log('[DailySalary] Escort Duty: ' + JSON.stringify(escortStats));

  var dayLaborStats = processDayLaborSalary(today, ledgerRows, eventsIndex);
  Logger.log('[DailySalary] Day Labor: ' + JSON.stringify(dayLaborStats));

  var summary = {
    date: today,
    guard: guardStats,
    escort: escortStats,
    dayLabor: dayLaborStats,
    totalCredited: guardStats.credited + escortStats.credited + dayLaborStats.credited
  };

  Logger.log('[DailySalary] Complete: ' + JSON.stringify(summary));
  return summary;
}

// ────────────────────────────────────────────
// TRIGGER MANAGEMENT
// ────────────────────────────────────────────
/**
 * Set up the daily salary trigger.
 *
 * Deletes any existing processDailySalary triggers, then creates
 * a new time-driven trigger that fires daily at 23:00–23:59 GMT.
 *
 * Run this function ONCE from the Apps Script editor to install.
 */
function setupDailySalaryTrigger() {
  // Remove any existing triggers for this function
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'processDailySalary') {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log('[Trigger] Removed existing processDailySalary trigger');
    }
  }

  // Create new daily trigger at 23:00–23:59 GMT
  ScriptApp.newTrigger('processDailySalary')
    .timeBased()
    .everyDays(1)
    .atHour(23)
    .nearMinute(59)
    .inTimezone('GMT')
    .create();

  Logger.log('[Trigger] Created daily trigger: processDailySalary at ~23:59 GMT');
  return { success: true, message: 'Daily salary trigger installed (23:59 GMT)' };
}

// ============================================================
// PHASE 3 — ACCOUNTING-GRADE REVERSAL ENGINE
// ============================================================
// Ledger is strictly append-only.  Corrections are recorded as
// reversal entries with negative amounts that link back to the
// original entry via the reversalOf column.
// ============================================================

/**
 * Internal helper: reverse all unreversed ledger entries matching
 * a sourceId + entryType filter.
 *
 * Builds reversal entries with:
 *   entryType   = 'reversal'
 *   amount      = −original.amount
 *   quantity    = −original.quantity
 *   reversalOf  = original.id
 *
 * Safely handles repeat calls — entries already reversed
 * (an existing reversal row references them) are skipped.
 *
 * @param {string} sourceId        - duty or loan record ID
 * @param {string} entryTypeFilter - 'earning' or 'advance'
 * @returns {Object[]} Array of created reversal rows
 * @private
 */
function reverseLedgerEntries_(sourceId, entryTypeFilter) {
  var allRecords = getSheetData(SHEETS.SALARY_LEDGER);

  // All entries for this source
  var sourceEntries = allRecords.filter(function(r) {
    return r.sourceId === sourceId;
  });

  // Build set of IDs that already have a reversal
  var reversedIds = {};
  sourceEntries.forEach(function(r) {
    if (r.entryType === 'reversal' && r.reversalOf) {
      reversedIds[String(r.reversalOf)] = true;
    }
  });

  // Filter to unreversed entries of the requested type
  var unreversed = sourceEntries.filter(function(r) {
    return r.entryType === entryTypeFilter && !reversedIds[String(r.id)];
  });

  var reversals = [];
  for (var i = 0; i < unreversed.length; i++) {
    var orig = unreversed[i];
    var reversal = appendLedgerEntry({
      employeeId:   orig.employeeId,
      employeeName: orig.employeeName,
      clientId:     orig.clientId,
      clientName:   orig.clientName,
      sourceModule: orig.sourceModule,
      sourceId:     orig.sourceId,
      entryType:    'reversal',
      dutyType:     orig.dutyType,
      rateSnapshot: parseNumber(orig.rateSnapshot, 0),
      quantity:     -parseNumber(orig.quantity, 0),
      amount:       -parseNumber(orig.amount, 0),
      reversalOf:   orig.id
    });
    reversals.push(reversal);
  }

  return reversals;
}

/**
 * Reverse all unreversed earning entries for a duty record.
 *
 * Call this BEFORE deleting or editing a duty (GuardDuty, EscortDuty,
 * DayLabor) so the ledger stays balanced.
 *
 * @param {string} dutyId - The duty record ID whose earnings to reverse
 * @returns {Object[]} Array of reversal ledger rows created
 */
function reverseDutyEntries(dutyId) {
  return reverseLedgerEntries_(dutyId, 'earning');
}

/**
 * Reverse all unreversed advance entries for a loan/advance record.
 *
 * Call this BEFORE deleting a loan so the negative-amount advance
 * entry is compensated in the ledger.
 *
 * @param {string} loanId - The loan/advance record ID
 * @returns {Object[]} Array of reversal ledger rows created
 */
function reverseLoanEntry(loanId) {
  return reverseLedgerEntries_(loanId, 'advance');
}

// ────────────────────────────────────────────
// RUNNING BALANCE REBUILD (corruption recovery)
// ────────────────────────────────────────────
/**
 * Rebuild the runningBalance column for the entire salary ledger
 * in chronological (row) order.
 *
 * This is a RECOVERY tool — only run if balance corruption is
 * suspected.  It reads the full ledger, groups entries by
 * employeeId, sorts by createdAt, recalculates each running
 * balance sequentially, then writes the corrected column back
 * to the sheet in a single batch.
 *
 * Bypasses the immutability guard because it uses raw Sheet API
 * and only modifies the runningBalance column — amounts, quantities,
 * and all other fields remain untouched.
 *
 * Run from Apps Script Editor → Run → rebuildRunningBalance()
 *
 * @returns {Object} Summary { totalRows, employeesProcessed, corrections }
 */
function rebuildRunningBalance() {
  Logger.log('[rebuildRunningBalance] Starting full ledger balance rebuild…');

  var sheet = getSheet(SHEETS.SALARY_LEDGER);
  var data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    Logger.log('[rebuildRunningBalance] Ledger is empty — nothing to rebuild.');
    return { totalRows: 0, employeesProcessed: 0, corrections: 0 };
  }

  var headers = data[0].map(String);
  var colEmpId   = headers.indexOf('employeeId');
  var colAmount  = headers.indexOf('amount');
  var colBalance = headers.indexOf('runningBalance');
  var colCreated = headers.indexOf('createdAt');

  if (colEmpId < 0 || colAmount < 0 || colBalance < 0 || colCreated < 0) {
    throw new Error('[rebuildRunningBalance] ABORT: Missing required column(s). Headers: ' + headers.join(', '));
  }

  // Group data rows by employeeId, preserving row numbers
  var groups = {};  // employeeId → [ { rowNum, amount, currentBalance, createdAt } ]
  for (var r = 1; r < data.length; r++) {
    var empId = String(data[r][colEmpId]);
    if (!groups[empId]) groups[empId] = [];
    groups[empId].push({
      rowNum: r + 1,   // 1-indexed sheet row
      amount: parseNumber(data[r][colAmount], 0),
      currentBalance: parseNumber(data[r][colBalance], 0),
      createdAt: String(data[r][colCreated] || '')
    });
  }

  // Rebuild per employee — sort by createdAt ascending (safety against
  // manual reordering / sheet sort corruption), then by rowNum as tiebreaker.
  var corrections = 0;
  var balanceUpdates = [];  // [{ row, col, value }]

  var employeeIds = Object.keys(groups);
  for (var e = 0; e < employeeIds.length; e++) {
    var rows = groups[employeeIds[e]];
    rows.sort(function(a, b) {
      if (a.createdAt < b.createdAt) return -1;
      if (a.createdAt > b.createdAt) return 1;
      return a.rowNum - b.rowNum;
    });
    var running = 0;
    for (var i = 0; i < rows.length; i++) {
      running = parseFloat((running + rows[i].amount).toFixed(2));
      if (rows[i].currentBalance !== running) {
        corrections++;
        balanceUpdates.push({
          row: rows[i].rowNum,
          col: colBalance + 1,  // 1-indexed column
          value: running
        });
      }
    }
  }

  // Write corrections in batch
  for (var u = 0; u < balanceUpdates.length; u++) {
    sheet.getRange(balanceUpdates[u].row, balanceUpdates[u].col).setValue(balanceUpdates[u].value);
  }

  Logger.log('[rebuildRunningBalance] Complete. Rows: ' + (data.length - 1) +
    ', Employees: ' + employeeIds.length +
    ', Corrections: ' + corrections);

  return {
    totalRows: data.length - 1,
    employeesProcessed: employeeIds.length,
    corrections: corrections
  };
}

// ============================================================
// LEDGER INTEGRITY VALIDATOR
// ============================================================
// Read-only diagnostic.  No writes.  Run monthly or on demand.
// ============================================================

/**
 * Validate the salary ledger for structural and financial integrity.
 *
 * Checks performed:
 *   1. Running balance accuracy — recalculates every balance per employee
 *      and flags rows where stored balance ≠ expected balance.
 *   2. Orphaned reversalOf — reversal entries whose reversalOf value
 *      does not point to a real ledger ID.
 *   3. Duplicate unreversed earnings — two or more unreversed earning
 *      entries that share the same sourceId (indicates double-credit).
 *
 * ██  READ-ONLY — NO WRITES PERFORMED  ██
 *
 * Run from Apps Script Editor → Run → validateLedgerIntegrity()
 * Then open View → Logs (or Executions) to read the report.
 *
 * @returns {Object} Integrity report
 */
function validateLedgerIntegrity() {
  Logger.log('[LedgerIntegrity] Starting integrity validation…');

  var allRecords = getSheetData(SHEETS.SALARY_LEDGER);
  if (allRecords.length === 0) {
    Logger.log('[LedgerIntegrity] Ledger is empty — nothing to validate.');
    return { totalRows: 0, balanceMismatches: [], orphanedReversals: [], duplicateEarnings: [], healthy: true };
  }

  // Build ID set for orphan check
  var idSet = {};
  for (var i = 0; i < allRecords.length; i++) {
    idSet[String(allRecords[i].id)] = true;
  }

  // ── CHECK 1: Running balance accuracy ─────────────
  var empGroups = {};
  for (var j = 0; j < allRecords.length; j++) {
    var r = allRecords[j];
    var empId = String(r.employeeId);
    if (!empGroups[empId]) empGroups[empId] = [];
    empGroups[empId].push({
      index: j,
      id: r.id,
      amount: parseNumber(r.amount, 0),
      storedBalance: parseNumber(r.runningBalance, 0),
      createdAt: String(r.createdAt || '')
    });
  }

  var balanceMismatches = [];
  var employeeIds = Object.keys(empGroups);
  for (var e = 0; e < employeeIds.length; e++) {
    var rows = empGroups[employeeIds[e]];
    // Sort by createdAt, then by original index
    rows.sort(function(a, b) {
      if (a.createdAt < b.createdAt) return -1;
      if (a.createdAt > b.createdAt) return 1;
      return a.index - b.index;
    });
    var running = 0;
    for (var k = 0; k < rows.length; k++) {
      running = parseFloat((running + rows[k].amount).toFixed(2));
      if (rows[k].storedBalance !== running) {
        balanceMismatches.push({
          employeeId: employeeIds[e],
          entryId: rows[k].id,
          expected: running,
          stored: rows[k].storedBalance,
          diff: parseFloat((rows[k].storedBalance - running).toFixed(2))
        });
      }
    }
  }

  // ── CHECK 2: Orphaned reversalOf ──────────────────
  var orphanedReversals = [];
  for (var m = 0; m < allRecords.length; m++) {
    var rec = allRecords[m];
    if (rec.entryType === 'reversal' && rec.reversalOf) {
      if (!idSet[String(rec.reversalOf)]) {
        orphanedReversals.push({
          reversalId: rec.id,
          reversalOf: rec.reversalOf,
          sourceId: rec.sourceId,
          amount: rec.amount
        });
      }
    }
  }

  // ── CHECK 3: Duplicate unreversed earnings ────────
  // Group earning entries by sourceModule + sourceId
  var earningGroups = {};  // key → [ { id, ... } ]
  var reversedTargets = {};
  // First pass: build set of reversed original IDs
  for (var n = 0; n < allRecords.length; n++) {
    if (allRecords[n].entryType === 'reversal' && allRecords[n].reversalOf) {
      reversedTargets[String(allRecords[n].reversalOf)] = true;
    }
  }
  // Second pass: group unreversed earnings
  for (var p = 0; p < allRecords.length; p++) {
    var entry = allRecords[p];
    if (entry.entryType === 'earning' && !reversedTargets[String(entry.id)]) {
      var groupKey = String(entry.sourceModule) + '|' + String(entry.sourceId);
      if (!earningGroups[groupKey]) earningGroups[groupKey] = [];
      earningGroups[groupKey].push({
        id: entry.id,
        amount: parseNumber(entry.amount, 0),
        quantity: parseNumber(entry.quantity, 0),
        dutyType: entry.dutyType
      });
    }
  }
  // Flag groups where the same dutyType appears more than once unreversed
  // (legitimate for escort incremental credits, so use dutyType + sourceId)
  var duplicateEarnings = [];
  var groupKeys = Object.keys(earningGroups);
  for (var q = 0; q < groupKeys.length; q++) {
    var grp = earningGroups[groupKeys[q]];
    // Check for exact duplicate amounts (same dutyType, same amount, same qty)
    var seen = {};
    for (var s = 0; s < grp.length; s++) {
      var sig = grp[s].dutyType + '|' + grp[s].amount + '|' + grp[s].quantity;
      if (seen[sig]) {
        duplicateEarnings.push({
          sourceKey: groupKeys[q],
          entry1: seen[sig],
          entry2: grp[s].id,
          amount: grp[s].amount,
          dutyType: grp[s].dutyType
        });
      } else {
        seen[sig] = grp[s].id;
      }
    }
  }

  // ── REPORT ────────────────────────────────────────
  var healthy = balanceMismatches.length === 0 &&
                orphanedReversals.length === 0 &&
                duplicateEarnings.length === 0;

  Logger.log('');
  Logger.log('═'.repeat(60));
  Logger.log('  LEDGER INTEGRITY REPORT');
  Logger.log('═'.repeat(60));
  Logger.log('');
  Logger.log('Total rows:              ' + allRecords.length);
  Logger.log('Employees:               ' + employeeIds.length);
  Logger.log('Balance mismatches:      ' + balanceMismatches.length);
  Logger.log('Orphaned reversals:      ' + orphanedReversals.length);
  Logger.log('Duplicate earnings:      ' + duplicateEarnings.length);
  Logger.log('Overall health:          ' + (healthy ? '✅ HEALTHY' : '⚠️  ISSUES DETECTED'));
  Logger.log('');

  if (balanceMismatches.length > 0) {
    Logger.log('── Balance Mismatches ────────────────────────');
    for (var bm = 0; bm < Math.min(balanceMismatches.length, 20); bm++) {
      var mm = balanceMismatches[bm];
      Logger.log('  Employee ' + mm.employeeId + ' | Entry ' + mm.entryId +
        ' | Stored: ' + mm.stored + ' | Expected: ' + mm.expected +
        ' | Diff: ' + mm.diff);
    }
    if (balanceMismatches.length > 20) Logger.log('  ... and ' + (balanceMismatches.length - 20) + ' more');
    Logger.log('  → Run rebuildRunningBalance() to fix.');
    Logger.log('');
  }

  if (orphanedReversals.length > 0) {
    Logger.log('── Orphaned Reversals ────────────────────────');
    for (var or2 = 0; or2 < Math.min(orphanedReversals.length, 20); or2++) {
      var orph = orphanedReversals[or2];
      Logger.log('  Reversal ' + orph.reversalId + ' → reversalOf: ' + orph.reversalOf + ' (NOT FOUND)');
    }
    Logger.log('');
  }

  if (duplicateEarnings.length > 0) {
    Logger.log('── Duplicate Unreversed Earnings ─────────────');
    for (var de = 0; de < Math.min(duplicateEarnings.length, 20); de++) {
      var dup = duplicateEarnings[de];
      Logger.log('  Source: ' + dup.sourceKey + ' | Entries: ' + dup.entry1 + ', ' + dup.entry2 +
        ' | Amount: ' + dup.amount + ' | Type: ' + dup.dutyType);
    }
    Logger.log('');
  }

  Logger.log('══════════════════════════════════════════════');
  Logger.log('  ██  READ-ONLY — NO WRITES PERFORMED  ██');
  Logger.log('══════════════════════════════════════════════');

  return {
    totalRows: allRecords.length,
    employees: employeeIds.length,
    balanceMismatches: balanceMismatches,
    orphanedReversals: orphanedReversals,
    duplicateEarnings: duplicateEarnings,
    healthy: healthy
  };
}
