/**
 * Al-Aqsa HRM Backend - Day Labor Handler
 * Operations for day labor tracking
 *
 * Phase 1 schema:
 *   id, employeeId, employeeName, clientId, clientName,
 *   date, hoursWorked, baseRateSnapshot, overtimeRateSnapshot,
 *   baseAmount, overtimeAmount, totalAmount, createdAt
 *
 * On create:
 *   Fetch client.dayLaborRate → baseRateSnapshot
 *   Fetch client.overtimeRate → overtimeRateSnapshot
 *   baseAmount = (min(hoursWorked, 9) / 9) * baseRateSnapshot
 *   overtimeAmount = max(0, hoursWorked - 9) * overtimeRateSnapshot
 *   totalAmount = baseAmount + overtimeAmount
 *   Append earning to salary ledger
 */

/**
 * Get day labor records (filtered by date)
 */
function handleGetDayLabor(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'DayLabor', 'canView')) {
    return unauthorizedResponse('getDayLabor');
  }

  try {
    var records = getSheetData(SHEETS.DAY_LABOR);

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

    return { success: true, action: 'getDayLabor', data: records, message: 'Day labor records retrieved' };
  } catch (error) {
    return sanitizedError('getDayLabor', error);
  }
}

/**
 * Add day labor record
 *
 * Phase 1: Fetches client rates, calculates base/overtime/total amounts,
 * stores snapshots, and writes earning to salary ledger.
 */
function handleAddDayLabor(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'DayLabor', 'canAdd')) {
    return unauthorizedResponse('addDayLabor');
  }

  try {
    var requiredFields = ['id', 'date', 'employeeName'];
    var validationError = validateRequired(payload, requiredFields);
    if (validationError) {
      return { success: false, action: 'addDayLabor', data: null, message: validationError };
    }

    // Cross-duty conflict validation
    var conflictCheck = validateEmployeeDutyConflict({
      employeeId: payload.employeeId || '',
      dates: [normalizeDateValue(payload.date)],
      shifts: ['Day'],
      sourceModule: 'DayLabor'
    });
    if (conflictCheck.conflict) {
      logActivity({ sessionUser: sessionUser, action: 'VALIDATION_REJECTED', module: 'DayLabor', recordId: payload.id, summary: 'Conflict: ' + conflictCheck.message, date: normalizeDateValue(payload.date), employeeId: payload.employeeId || '', clientId: payload.clientId || '', success: false, message: conflictCheck.message });
      return { success: false, action: 'addDayLabor', data: null, message: conflictCheck.message };
    }

    // Fetch client rates for snapshot
    var clientId = String(payload.clientId || '').trim();
    var client = clientId ? findById(SHEETS.CLIENTS, clientId) : null;
    var baseRateSnapshot = client ? parseNumber(client.dayLaborRate, 0) : 0;
    var overtimeRateSnapshot = client ? parseNumber(client.overtimeRate, 0) : 0;

    // Calculate amounts
    var hoursWorked = parseNumber(payload.hoursWorked, 0);
    var regularHours = Math.min(hoursWorked, 9);
    var overtimeHours = Math.max(0, hoursWorked - 9);
    var baseAmount = parseFloat(((regularHours / 9) * baseRateSnapshot).toFixed(2));
    var overtimeAmount = parseFloat((overtimeHours * overtimeRateSnapshot).toFixed(2));
    var totalAmount = parseFloat((baseAmount + overtimeAmount).toFixed(2));

    var recordData = {
      id: payload.id,
      employeeId: payload.employeeId || '',
      employeeName: payload.employeeName,
      clientId: clientId,
      clientName: payload.clientName || '',
      date: normalizeDateValue(payload.date),
      hoursWorked: hoursWorked,
      baseRateSnapshot: baseRateSnapshot,
      overtimeRateSnapshot: overtimeRateSnapshot,
      baseAmount: baseAmount,
      overtimeAmount: overtimeAmount,
      totalAmount: totalAmount,
      createdAt: getNowISO()
    };

    addRecord(SHEETS.DAY_LABOR, recordData);

    // Salary crediting delegated to processDailySalary() (Phase 2)

    logActivity({ sessionUser: sessionUser, action: 'addDayLabor', module: 'DayLabor', recordId: recordData.id, summary: recordData.employeeName + ' day labor ' + recordData.date, date: recordData.date, employeeId: recordData.employeeId, clientId: recordData.clientId, success: true });

    return { success: true, action: 'addDayLabor', data: recordData, message: 'Day labor record added' };
  } catch (error) {
    return sanitizedError('addDayLabor', error);
  }
}

/**
 * Delete day labor record
 */
function handleDeleteDayLabor(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'DayLabor', 'canDelete')) {
    return unauthorizedResponse('deleteDayLabor');
  }

  try {
    // Reverse any salary ledger earnings before deleting the duty
    var reversals = reverseDutyEntries(payload.id);

    var deleted = deleteRecord(SHEETS.DAY_LABOR, payload.id);
    if (deleted) {
      logActivity({ sessionUser: sessionUser, action: 'deleteDayLabor', module: 'DayLabor', recordId: payload.id, summary: 'Deleted day labor ' + payload.id + ' (reversed ' + reversals.length + ' ledger entries)' });
    }
    if (!deleted) {
      return { success: false, action: 'deleteDayLabor', data: null, message: 'Day labor record not found' };
    }
    return { success: true, action: 'deleteDayLabor', data: null, message: 'Day labor record deleted' };
  } catch (error) {
    return sanitizedError('deleteDayLabor', error);
  }
}
