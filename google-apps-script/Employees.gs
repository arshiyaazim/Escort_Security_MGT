/**
 * Al-Aqsa HRM Backend - Employees Handler
 * CRUD operations for employee management
 */

/**
 * Get all employees
 */
function handleGetEmployees(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'Employees', 'canView')) {
    return unauthorizedResponse('getEmployees');
  }
  
  try {
    const employees = getSheetData(SHEETS.EMPLOYEES);
    
    return {
      success: true,
      action: 'getEmployees',
      data: employees,
      message: 'Employees retrieved'
    };
  } catch (error) {
    return sanitizedError('getEmployees', error);
  }
}

/**
 * Add or update employee
 */
function handleAddOrUpdateEmployee(payload, sessionUser) {
  // Use indexed lookup for existence check
  const indexedEmployees = getIndexedSheet(SHEETS.EMPLOYEES, 'id');
  const existing = payload.id ? getFromIndex(indexedEmployees, payload.id) : null;
  const permission = existing ? 'canEdit' : 'canAdd';
  
  // Permission check
  if (!checkPermission(sessionUser.role, 'Employees', permission)) {
    return unauthorizedResponse('addOrUpdateEmployee');
  }
  
  try {
    // Validate required fields
    const requiredFields = ['id', 'name'];
    const validationError = validateRequired(payload, requiredFields);
    if (validationError) {
      return {
        success: false,
        action: 'addOrUpdateEmployee',
        data: null,
        message: validationError
      };
    }
    
    // Prepare employee data (v3 schema — aligned with frontend)
    const employeeData = {
      id: payload.id,
      name: payload.name || '',
      phone: payload.phone || '',
      nid: payload.nid || '',
      role: payload.role || '',
      salary: parseNumber(payload.salary, 0),
      deployedAt: payload.deployedAt || '',
      joinDate: payload.joinDate || '',
      guardianName: payload.guardianName || '',
      guardianPhone: payload.guardianPhone || '',
      address: payload.address || '',
      status: payload.status || 'Active'
    };
    
    // Add or update
    upsertRecord(SHEETS.EMPLOYEES, payload.id, employeeData);
    
    return {
      success: true,
      action: 'addOrUpdateEmployee',
      data: employeeData,
      message: existing ? 'Employee updated' : 'Employee added'
    };
  } catch (error) {
    return sanitizedError('addOrUpdateEmployee', error);
  }
}

/**
 * Delete employee
 */
function handleDeleteEmployee(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'Employees', 'canDelete')) {
    return unauthorizedResponse('deleteEmployee');
  }
  
  try {
    const deleted = deleteRecord(SHEETS.EMPLOYEES, payload.id);
    
    if (!deleted) {
      return {
        success: false,
        action: 'deleteEmployee',
        data: null,
        message: 'Employee not found'
      };
    }
    
    return {
      success: true,
      action: 'deleteEmployee',
      data: null,
      message: 'Employee deleted'
    };
  } catch (error) {
    return sanitizedError('deleteEmployee', error);
  }
}
