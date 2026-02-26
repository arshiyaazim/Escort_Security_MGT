/**
 * Al-Aqsa HRM Backend - Day Labor Handler
 * Operations for day labor tracking
 */

/**
 * Get day labor records (filtered by date)
 */
function handleGetDayLabor(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'DayLabor', 'canView')) {
    return unauthorizedResponse('getDayLabor');
  }
  
  try {
    let records = getSheetData(SHEETS.DAY_LABOR);
    
    // Filter by date if provided
    // Normalize both sides: sheet may store Date objects via getValues()
    if (payload.date) {
      var filterDate = normalizeDateValue(payload.date);
      records = records.filter(function(r) {
        return normalizeDateValue(r.date) === filterDate;
      });
    }
    
    // Normalize date field in returned records so frontend always gets strings
    records = records.map(function(r) {
      r.date = normalizeDateValue(r.date);
      return r;
    });
    
    return {
      success: true,
      action: 'getDayLabor',
      data: records,
      message: 'Day labor records retrieved'
    };
  } catch (error) {
    return sanitizedError('getDayLabor', error);
  }
}

/**
 * Add day labor record
 */
function handleAddDayLabor(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'DayLabor', 'canAdd')) {
    return unauthorizedResponse('addDayLabor');
  }
  
  try {
    // Validate required fields
    const requiredFields = ['id', 'date', 'employeeName'];
    const validationError = validateRequired(payload, requiredFields);
    if (validationError) {
      return {
        success: false,
        action: 'addDayLabor',
        data: null,
        message: validationError
      };
    }
    
    // Cross-duty conflict validation (day labor blocks only the selected shift)
    var selectedShift = payload.shift || 'Day';
    var conflictCheck = validateEmployeeDutyConflict({
      employeeId: payload.employeeId || '',
      dates: [normalizeDateValue(payload.date)],
      shifts: [selectedShift],
      sourceModule: 'DayLabor'
    });
    if (conflictCheck.conflict) {
      logActivity({ sessionUser: sessionUser, action: 'VALIDATION_REJECTED', module: 'DayLabor', recordId: payload.id, summary: 'Conflict: ' + conflictCheck.message, date: normalizeDateValue(payload.date), employeeId: payload.employeeId || '', clientId: payload.clientId || '', success: false, message: conflictCheck.message });
      return { success: false, action: 'addDayLabor', data: null, message: conflictCheck.message };
    }

    // Prepare record data (v3 schema — aligned with frontend)
    const recordData = {
      id: payload.id,
      date: payload.date,
      employeeId: payload.employeeId || '',
      employeeName: payload.employeeName,
      clientId: payload.clientId || '',
      clientName: payload.clientName || '',
      shift: selectedShift,
      hoursWorked: parseNumber(payload.hoursWorked, 0),
      rate: parseNumber(payload.rate, 0),
      amount: parseNumber(payload.amount, 0),
      notes: payload.notes || ''
    };
    
    // Add record
    addRecord(SHEETS.DAY_LABOR, recordData);
    
    // Activity logging
    logActivity({ sessionUser: sessionUser, action: 'addDayLabor', module: 'DayLabor', recordId: recordData.id, summary: recordData.employeeName + ' day labor ' + recordData.date, date: recordData.date, employeeId: recordData.employeeId, clientId: recordData.clientId, success: true });

    return {
      success: true,
      action: 'addDayLabor',
      data: recordData,
      message: 'Day labor record added'
    };
  } catch (error) {
    return sanitizedError('addDayLabor', error);
  }
}

/**
 * Delete day labor record
 */
function handleDeleteDayLabor(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'DayLabor', 'canDelete')) {
    return unauthorizedResponse('deleteDayLabor');
  }
  
  try {
    const deleted = deleteRecord(SHEETS.DAY_LABOR, payload.id);
    
    if (deleted) {
      logActivity({ sessionUser: sessionUser, action: 'deleteDayLabor', module: 'DayLabor', recordId: payload.id, summary: 'Deleted day labor ' + payload.id });
    }

    if (!deleted) {
      return {
        success: false,
        action: 'deleteDayLabor',
        data: null,
        message: 'Day labor record not found'
      };
    }
    
    return {
      success: true,
      action: 'deleteDayLabor',
      data: null,
      message: 'Day labor record deleted'
    };
  } catch (error) {
    return sanitizedError('deleteDayLabor', error);
  }
}
