/**
 * Al-Aqsa HRM Backend - Escort Duty Handler
 * Operations for escort duty tracking
 */

/**
 * Get escort duty records (filtered by date range)
 */
function handleGetEscortDuty(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'EscortDuty', 'canView')) {
    return unauthorizedResponse('getEscortDuty');
  }
  
  try {
    let records = getSheetData(SHEETS.ESCORT_DUTY);
    
    // Filter by date range if provided
    // Normalize all dates: sheet may store Date objects via getValues()
    if (payload.startDate && payload.endDate) {
      var filterStart = normalizeDateValue(payload.startDate);
      var filterEnd = normalizeDateValue(payload.endDate);
      records = records.filter(function(r) {
        var rStart = normalizeDateValue(r.startDate);
        var rEnd = normalizeDateValue(r.endDate);
        return rStart <= filterEnd && rEnd >= filterStart;
      });
    }
    
    // Normalize date fields in returned records so frontend always gets strings
    records = records.map(function(r) {
      r.startDate = normalizeDateValue(r.startDate);
      r.endDate = normalizeDateValue(r.endDate);
      return r;
    });
    
    return {
      success: true,
      action: 'getEscortDuty',
      data: records,
      message: 'Escort duty records retrieved'
    };
  } catch (error) {
    return sanitizedError('getEscortDuty', error);
  }
}

/**
 * Add escort duty record
 */
function handleAddEscortDuty(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'EscortDuty', 'canAdd')) {
    return unauthorizedResponse('addEscortDuty');
  }
  
  try {
    // Validate required fields - endDate is optional (duty can be ongoing)
    const requiredFields = ['id', 'startDate', 'employeeName'];
    const validationError = validateRequired(payload, requiredFields);
    if (validationError) {
      return {
        success: false,
        action: 'addEscortDuty',
        data: null,
        message: validationError
      };
    }
    
    // Cross-duty conflict validation — escort blocks all dates in range (both shifts)
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

    // Prepare record data (v3 schema — aligned with frontend)
    const recordData = {
      id: payload.id,
      employeeId: payload.employeeId || '',
      employeeName: payload.employeeName,
      clientId: payload.clientId || '',
      clientName: payload.clientName || '',
      vesselName: payload.vesselName || '',
      lighterName: payload.lighterName || '',
      startDate: payload.startDate,
      startShift: payload.startShift || '',
      endDate: payload.endDate,
      endShift: payload.endShift || '',
      releasePoint: payload.releasePoint || '',
      totalDays: parseNumber(payload.totalDays, 1),
      conveyance: parseNumber(payload.conveyance, 0),
      status: payload.status || 'Active',
      notes: payload.notes || ''
    };
    
    // Add record
    addRecord(SHEETS.ESCORT_DUTY, recordData);
    
    // Activity logging
    logActivity({ sessionUser: sessionUser, action: 'addEscortDuty', module: 'EscortDuty', recordId: recordData.id, summary: recordData.employeeName + ' escort ' + recordData.startDate + ' – ' + (recordData.endDate || 'ongoing'), date: recordData.startDate, employeeId: recordData.employeeId, clientId: recordData.clientId, success: true });

    return {
      success: true,
      action: 'addEscortDuty',
      data: recordData,
      message: 'Escort duty record added'
    };
  } catch (error) {
    return sanitizedError('addEscortDuty', error);
  }
}

/**
 * Delete escort duty record
 */
function handleDeleteEscortDuty(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'EscortDuty', 'canDelete')) {
    return unauthorizedResponse('deleteEscortDuty');
  }
  
  try {
    const deleted = deleteRecord(SHEETS.ESCORT_DUTY, payload.id);
    
    if (deleted) {
      logActivity({ sessionUser: sessionUser, action: 'deleteEscortDuty', module: 'EscortDuty', recordId: payload.id, summary: 'Deleted escort duty ' + payload.id });
    }

    if (!deleted) {
      return {
        success: false,
        action: 'deleteEscortDuty',
        data: null,
        message: 'Escort duty record not found'
      };
    }
    
    return {
      success: true,
      action: 'deleteEscortDuty',
      data: null,
      message: 'Escort duty record deleted'
    };
  } catch (error) {
    return sanitizedError('deleteEscortDuty', error);
  }
}

/**
 * Update escort duty record
 * Supports editing existing records (e.g. adding end date, recalculating days)
 */
function handleUpdateEscortDuty(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'EscortDuty', 'canEdit')) {
    return unauthorizedResponse('updateEscortDuty');
  }
  
  try {
    // Validate required fields — id and startDate are always required
    const requiredFields = ['id', 'startDate', 'employeeName'];
    const validationError = validateRequired(payload, requiredFields);
    if (validationError) {
      return {
        success: false,
        action: 'updateEscortDuty',
        data: null,
        message: validationError
      };
    }
    
    // Check record exists
    const existing = findById(SHEETS.ESCORT_DUTY, payload.id);
    if (!existing) {
      return {
        success: false,
        action: 'updateEscortDuty',
        data: null,
        message: 'Escort duty record not found'
      };
    }
    
    // Cross-duty conflict validation on update — escort blocks all dates in range
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

    // Prepare updated record data
    const recordData = {
      id: payload.id,
      employeeId: payload.employeeId || existing.employeeId || '',
      employeeName: payload.employeeName,
      clientId: payload.clientId || existing.clientId || '',
      clientName: payload.clientName || existing.clientName || '',
      vesselName: payload.vesselName || existing.vesselName || '',
      lighterName: payload.lighterName || existing.lighterName || '',
      startDate: payload.startDate,
      startShift: payload.startShift || existing.startShift || '',
      endDate: payload.endDate || '',
      endShift: payload.endShift || '',
      releasePoint: payload.releasePoint || existing.releasePoint || '',
      totalDays: parseNumber(payload.totalDays, 0),
      conveyance: parseNumber(payload.conveyance, 0),
      status: payload.status || existing.status || 'Active',
      notes: payload.notes !== undefined ? payload.notes : (existing.notes || '')
    };
    
    // Update record
    updateRecord(SHEETS.ESCORT_DUTY, payload.id, recordData);
    
    // Activity logging
    logActivity({ sessionUser: sessionUser, action: 'updateEscortDuty', module: 'EscortDuty', recordId: recordData.id, summary: recordData.employeeName + ' escort updated ' + recordData.startDate + ' – ' + (recordData.endDate || 'ongoing'), date: recordData.startDate, employeeId: recordData.employeeId, clientId: recordData.clientId, success: true });

    return {
      success: true,
      action: 'updateEscortDuty',
      data: recordData,
      message: 'Escort duty record updated'
    };
  } catch (error) {
    return sanitizedError('updateEscortDuty', error);
  }
}
