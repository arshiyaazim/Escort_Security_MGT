/**
 * Al-Aqsa HRM Backend - Clients Handler
 * CRUD operations for client management
 *
 * Target schema (sheet headers, exact order):
 *   id, companyName, contactPerson, phone, email, address, status,
 *   name, contactRate, serviceStartDate, lastBillSubmitted,
 *   billStatus, dueAmount, assignedEmployeeSalary, createdAt
 *
 * Canonical display name rule:
 *   displayName = (companyName || name || '').trim()
 */

/**
 * Get all clients
 */
function handleGetClients(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'Clients', 'canView')) {
    return unauthorizedResponse('getClients');
  }
  
  try {
    const clients = getSheetData(SHEETS.CLIENTS);
    
    return {
      success: true,
      action: 'getClients',
      data: clients,
      message: 'Clients retrieved'
    };
  } catch (error) {
    return sanitizedError('getClients', error);
  }
}

/**
 * Add or update client
 *
 * Accepts both companyName and legacy name fields.
 * Ensures both columns are persisted to prevent column misalignment.
 * Backward compat: never overwrites a non-empty value with empty.
 */
function handleAddOrUpdateClient(payload, sessionUser) {
  // Use indexed lookup for existence check
  const indexedClients = getIndexedSheet(SHEETS.CLIENTS, 'id');
  const existing = payload.id ? getFromIndex(indexedClients, payload.id) : null;
  const permission = existing ? 'canEdit' : 'canAdd';
  
  // Permission check
  if (!checkPermission(sessionUser.role, 'Clients', permission)) {
    return unauthorizedResponse('addOrUpdateClient');
  }
  
  try {
    // Accept both 'companyName' and legacy 'name'
    var payloadCompanyName = (payload.companyName || '').toString().trim();
    var payloadName = (payload.name || '').toString().trim();

    // Require at least one of companyName or name to be non-empty
    if (!payload.id || (!payloadCompanyName && !payloadName)) {
      return {
        success: false,
        action: 'addOrUpdateClient',
        data: null,
        message: 'Missing required fields: id and at least one of companyName or name'
      };
    }

    // Resolve canonical values:
    // If only one is provided, auto-fill the other
    var resolvedCompanyName = payloadCompanyName || payloadName;
    var resolvedName = payloadName || payloadCompanyName;

    // Backward compat: if updating, never overwrite a non-empty value with empty
    if (existing) {
      var existingCompanyName = (existing.companyName || '').toString().trim();
      var existingName = (existing.name || '').toString().trim();
      if (!resolvedCompanyName && existingCompanyName) {
        resolvedCompanyName = existingCompanyName;
      }
      if (!resolvedName && existingName) {
        resolvedName = existingName;
      }
    }
    
    // Prepare client data — full schema (matches sheet headers exactly)
    var clientData = {
      id: payload.id,
      companyName: resolvedCompanyName,
      contactPerson: (payload.contactPerson || '').toString().trim(),
      phone: (payload.phone || '').toString().trim(),
      email: (payload.email || '').toString().trim(),
      address: (payload.address || '').toString().trim(),
      status: (payload.status || 'Active').toString().trim(),
      name: resolvedName,
      contactRate: parseNumber(payload.contactRate, 0),
      serviceStartDate: payload.serviceStartDate || '',
      lastBillSubmitted: payload.lastBillSubmitted || '',
      billStatus: payload.billStatus || '',
      dueAmount: parseNumber(payload.dueAmount, 0),
      assignedEmployeeSalary: parseNumber(payload.assignedEmployeeSalary, 0),
      createdAt: payload.createdAt || ''
    };
    
    // Add or update (upsertRecord maps by header keys — safe)
    upsertRecord(SHEETS.CLIENTS, payload.id, clientData);
    
    return {
      success: true,
      action: 'addOrUpdateClient',
      data: clientData,
      message: existing ? 'Client updated' : 'Client added'
    };
  } catch (error) {
    return sanitizedError('addOrUpdateClient', error);
  }
}

/**
 * Delete client
 */
function handleDeleteClient(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'Clients', 'canDelete')) {
    return unauthorizedResponse('deleteClient');
  }
  
  try {
    if (!payload.id) {
      return {
        success: false,
        action: 'deleteClient',
        data: null,
        message: 'Missing required field: id'
      };
    }

    const deleted = deleteRecord(SHEETS.CLIENTS, payload.id);
    
    if (!deleted) {
      return {
        success: false,
        action: 'deleteClient',
        data: null,
        message: 'Client not found'
      };
    }
    
    return {
      success: true,
      action: 'deleteClient',
      data: null,
      message: 'Client deleted'
    };
  } catch (error) {
    return sanitizedError('deleteClient', error);
  }
}
