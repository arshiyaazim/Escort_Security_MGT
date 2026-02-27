/**
 * Al-Aqsa HRM Backend - Escort Duty Handler
 * Operations for escort duty tracking
 *
 * Phase 1 schema:
 *   id, employeeId, employeeName, clientId, clientName,
 *   vesselName, lighterVessel, startDate, startShift,
 *   endDate, endShift, totalDays, rateSnapshot,
 *   conveyance, status, createdAt
 *
 * status: 'On-going' | 'Completed'
 */

/**
 * Get escort duty records (filtered by date range)
 */
function handleGetEscortDuty(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'EscortDuty', 'canView')) {
    return unauthorizedResponse('getEscortDuty');
  }

  try {
    var records = getSheetData(SHEETS.ESCORT_DUTY);

    if (payload.startDate && payload.endDate) {
      var filterStart = normalizeDateValue(payload.startDate);
      var filterEnd = normalizeDateValue(payload.endDate);
      records = records.filter(function(r) {
        var rStart = normalizeDateValue(r.startDate);
        var rEnd = normalizeDateValue(r.endDate);
        return rStart <= filterEnd && rEnd >= filterStart;
      });
    }

    records = records.map(function(r) {
      r.startDate = normalizeDateValue(r.startDate);
      r.endDate = normalizeDateValue(r.endDate);
      return r;
    });

    return { success: true, action: 'getEscortDuty', data: records, message: 'Escort duty records retrieved' };
  } catch (error) {
    return sanitizedError('getEscortDuty', error);
  }
}

/**
 * Add escort duty record
 *
 * Phase 1 changes:
 *   - Fetches client.escortRate → stores as rateSnapshot
 *   - lighterName renamed to lighterVessel
 *   - releasePoint, notes dropped from schema
 *   - status uses 'On-going' / 'Completed'
 *   - Ledger entry written only when status === 'Completed'
 */
function handleAddEscortDuty(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'EscortDuty', 'canAdd')) {
    return unauthorizedResponse('addEscortDuty');
  }

  try {
    var requiredFields = ['id', 'startDate', 'employeeName'];
    var validationError = validateRequired(payload, requiredFields);
    if (validationError) {
      return { success: false, action: 'addEscortDuty', data: null, message: validationError };
    }

    // Cross-duty conflict validation
    var escortDates = expandDateRange(normalizeDateValue(payload.startDate), payload.endDate ? normalizeDateValue(payload.endDate) : '');
    var conflictCheck = validateEmployeeDutyConflict({
      employeeId: payload.employeeId || '',
      dates: escortDates,
      shifts: ['Day', 'Night'],
      sourceModule: 'EscortDuty'
    });
    if (conflictCheck.conflict) {
      logActivity({ sessionUser: sessionUser, action: 'VALIDATION_REJECTED', module: 'EscortDuty', recordId: payload.id, summary: 'Conflict: ' + conflictCheck.message, date: normalizeDateValue(payload.startDate), employeeId: payload.employeeId || '', clientId: payload.clientId || '', success: false, message: conflictCheck.message });
      return { success: false, action: 'addEscortDuty', data: null, message: conflictCheck.message };
    }

    // Fetch client escortRate for snapshot
    var clientId = String(payload.clientId || '').trim();
    var client = clientId ? findById(SHEETS.CLIENTS, clientId) : null;
    var rateSnapshot = client ? parseNumber(client.escortRate, 0) : 0;

    // Determine status
    var status = payload.endDate ? 'Completed' : 'On-going';
    if (payload.status) {
      status = payload.status; // allow explicit override
    }

    var totalDays = parseNumber(payload.totalDays, 0);
    var conveyance = parseNumber(payload.conveyance, 0);

    var recordData = {
      id: payload.id,
      employeeId: payload.employeeId || '',
      employeeName: payload.employeeName,
      clientId: clientId,
      clientName: payload.clientName || '',
      vesselName: payload.vesselName || '',
      lighterVessel: payload.lighterVessel || payload.lighterName || '',
      startDate: payload.startDate,
      startShift: payload.startShift || '',
      endDate: payload.endDate || '',
      endShift: payload.endShift || '',
      totalDays: totalDays,
      rateSnapshot: rateSnapshot,
      conveyance: conveyance,
      status: status,
      createdAt: getNowISO()
    };

    addRecord(SHEETS.ESCORT_DUTY, recordData);

    // Salary crediting delegated to processDailySalary() (Phase 2)

    logActivity({ sessionUser: sessionUser, action: 'addEscortDuty', module: 'EscortDuty', recordId: recordData.id, summary: recordData.employeeName + ' escort ' + recordData.startDate + ' – ' + (recordData.endDate || 'ongoing'), date: recordData.startDate, employeeId: recordData.employeeId, clientId: recordData.clientId, success: true });

    return { success: true, action: 'addEscortDuty', data: recordData, message: 'Escort duty record added' };
  } catch (error) {
    return sanitizedError('addEscortDuty', error);
  }
}

/**
 * Delete escort duty record
 */
function handleDeleteEscortDuty(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'EscortDuty', 'canDelete')) {
    return unauthorizedResponse('deleteEscortDuty');
  }

  try {
    // Reverse any salary ledger earnings before deleting the duty
    var reversals = reverseDutyEntries(payload.id);

    var deleted = deleteRecord(SHEETS.ESCORT_DUTY, payload.id);
    if (deleted) {
      logActivity({ sessionUser: sessionUser, action: 'deleteEscortDuty', module: 'EscortDuty', recordId: payload.id, summary: 'Deleted escort duty ' + payload.id + ' (reversed ' + reversals.length + ' ledger entries)' });
    }
    if (!deleted) {
      return { success: false, action: 'deleteEscortDuty', data: null, message: 'Escort duty record not found' };
    }
    return { success: true, action: 'deleteEscortDuty', data: null, message: 'Escort duty record deleted' };
  } catch (error) {
    return sanitizedError('deleteEscortDuty', error);
  }
}

/**
 * Update escort duty record
 *
 * Phase 1: When an ongoing duty is marked Completed (endDate set),
 * the rateSnapshot is re-fetched and a ledger entry is written.
 */
function handleUpdateEscortDuty(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'EscortDuty', 'canEdit')) {
    return unauthorizedResponse('updateEscortDuty');
  }

  try {
    var requiredFields = ['id', 'startDate', 'employeeName'];
    var validationError = validateRequired(payload, requiredFields);
    if (validationError) {
      return { success: false, action: 'updateEscortDuty', data: null, message: validationError };
    }

    var existing = findById(SHEETS.ESCORT_DUTY, payload.id);
    if (!existing) {
      return { success: false, action: 'updateEscortDuty', data: null, message: 'Escort duty record not found' };
    }

    // Cross-duty conflict validation on update
    var updEscortDates = expandDateRange(normalizeDateValue(payload.startDate), payload.endDate ? normalizeDateValue(payload.endDate) : '');
    var updConflict = validateEmployeeDutyConflict({
      employeeId: payload.employeeId || existing.employeeId || '',
      dates: updEscortDates,
      shifts: ['Day', 'Night'],
      sourceModule: 'EscortDuty',
      excludeId: payload.id
    });
    if (updConflict.conflict) {
      logActivity({ sessionUser: sessionUser, action: 'VALIDATION_REJECTED', module: 'EscortDuty', recordId: payload.id, summary: 'Update conflict: ' + updConflict.message, date: normalizeDateValue(payload.startDate), employeeId: payload.employeeId || existing.employeeId || '', clientId: payload.clientId || existing.clientId || '', success: false, message: updConflict.message });
      return { success: false, action: 'updateEscortDuty', data: null, message: updConflict.message };
    }

    // Determine status transition
    var wasOngoing = (existing.status || '').toLowerCase() !== 'completed';
    var newStatus = payload.endDate ? 'Completed' : 'On-going';
    if (payload.status) newStatus = payload.status;
    var justCompleted = wasOngoing && newStatus === 'Completed';

    // Re-fetch rate if completing now
    var clientId = String(payload.clientId || existing.clientId || '').trim();
    var rateSnapshot = parseNumber(existing.rateSnapshot, 0);
    if (justCompleted && clientId) {
      var client = findById(SHEETS.CLIENTS, clientId);
      if (client) rateSnapshot = parseNumber(client.escortRate, 0);
    }

    var totalDays = parseNumber(payload.totalDays, 0);
    var conveyance = parseNumber(payload.conveyance, 0);

    var recordData = {
      id: payload.id,
      employeeId: payload.employeeId || existing.employeeId || '',
      employeeName: payload.employeeName,
      clientId: clientId,
      clientName: payload.clientName || existing.clientName || '',
      vesselName: payload.vesselName || existing.vesselName || '',
      lighterVessel: payload.lighterVessel || payload.lighterName || existing.lighterVessel || existing.lighterName || '',
      startDate: payload.startDate,
      startShift: payload.startShift || existing.startShift || '',
      endDate: payload.endDate || '',
      endShift: payload.endShift || '',
      totalDays: totalDays,
      rateSnapshot: rateSnapshot,
      conveyance: conveyance,
      status: newStatus,
      createdAt: existing.createdAt || getNowISO()
    };

    updateRecord(SHEETS.ESCORT_DUTY, payload.id, recordData);

    // Salary crediting delegated to processDailySalary() (Phase 2)
    // Reversal engine (Phase 3): reverse old earnings so daily
    // processor can regenerate with updated duty data.
    reverseDutyEntries(payload.id);
    // Clear conveyance processed-event key so daily processor can
    // re-evaluate conveyance on the next run.
    deleteRecord(SHEETS.PROCESSED_EVENTS, 'ED-CONV|' + payload.id, 'eventKey');

    logActivity({ sessionUser: sessionUser, action: 'updateEscortDuty', module: 'EscortDuty', recordId: recordData.id, summary: recordData.employeeName + ' escort updated ' + recordData.startDate + ' – ' + (recordData.endDate || 'ongoing') + ' (earnings reversed for re-credit)', date: recordData.startDate, employeeId: recordData.employeeId, clientId: recordData.clientId, success: true });

    return { success: true, action: 'updateEscortDuty', data: recordData, message: 'Escort duty record updated' };
  } catch (error) {
    return sanitizedError('updateEscortDuty', error);
  }
}
