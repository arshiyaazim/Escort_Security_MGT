/**
 * Al-Aqsa HRM Backend - Clients Handler
 * CRUD operations for client management
 *
 * Phase 1 schema (sheet headers, exact order):
 *   id, companyName, guardRate, escortRate, dayLaborRate, overtimeRate, status, createdAt
 */

/**
 * Get all clients
 */
function handleGetClients(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'Clients', 'canView')) {
    return unauthorizedResponse('getClients');
  }
  try {
    var clients = getSheetData(SHEETS.CLIENTS);
    return { success: true, action: 'getClients', data: clients, message: 'Clients retrieved' };
  } catch (error) {
    return sanitizedError('getClients', error);
  }
}

/**
 * Add or update client
 *
 * Phase 1 schema — four rate fields replace the old contactRate.
 * Migration note: if payload still sends contactRate (legacy),
 * copy it to all three duty-rate fields as a convenience.
 */
function handleAddOrUpdateClient(payload, sessionUser) {
  var indexedClients = getIndexedSheet(SHEETS.CLIENTS, 'id');
  var existing = payload.id ? getFromIndex(indexedClients, payload.id) : null;
  var permission = existing ? 'canEdit' : 'canAdd';

  if (!checkPermission(sessionUser.role, 'Clients', permission)) {
    return unauthorizedResponse('addOrUpdateClient');
  }

  try {
    var companyName = (payload.companyName || payload.name || '').toString().trim();
    if (!payload.id || !companyName) {
      return { success: false, action: 'addOrUpdateClient', data: null,
        message: 'Missing required fields: id and companyName' };
    }

    // Legacy migration: if contactRate is sent but duty-specific rates are not,
    // copy contactRate to all three duty-rate fields.
    var legacyRate = parseNumber(payload.contactRate, 0);
    var guardRate  = parseNumber(payload.guardRate, 0) || legacyRate;
    var escortRate = parseNumber(payload.escortRate, 0) || legacyRate;
    var dayLaborRate = parseNumber(payload.dayLaborRate, 0) || legacyRate;
    var overtimeRate = parseNumber(payload.overtimeRate, 0);

    var clientData = {
      id: payload.id,
      companyName: companyName,
      guardRate: guardRate,
      escortRate: escortRate,
      dayLaborRate: dayLaborRate,
      overtimeRate: overtimeRate,
      status: (payload.status || 'Active').toString().trim(),
      createdAt: (existing && existing.createdAt) ? existing.createdAt : getNowISO()
    };

    upsertRecord(SHEETS.CLIENTS, payload.id, clientData);

    return { success: true, action: 'addOrUpdateClient', data: clientData,
      message: existing ? 'Client updated' : 'Client added' };
  } catch (error) {
    return sanitizedError('addOrUpdateClient', error);
  }
}

/**
 * Delete client
 */
function handleDeleteClient(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'Clients', 'canDelete')) {
    return unauthorizedResponse('deleteClient');
  }
  try {
    if (!payload.id) {
      return { success: false, action: 'deleteClient', data: null, message: 'Missing required field: id' };
    }
    var deleted = deleteRecord(SHEETS.CLIENTS, payload.id);
    if (!deleted) {
      return { success: false, action: 'deleteClient', data: null, message: 'Client not found' };
    }
    return { success: true, action: 'deleteClient', data: null, message: 'Client deleted' };
  } catch (error) {
    return sanitizedError('deleteClient', error);
  }
}
