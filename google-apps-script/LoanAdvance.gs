/**
 * Al-Aqsa HRM Backend - Loan/Advance Handler
 * Operations for loan and advance tracking
 */

/**
 * Get all loan/advance records
 */
function handleGetLoanAdvance(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'LoanAdvance', 'canView')) {
    return unauthorizedResponse('getLoanAdvance');
  }
  
  try {
    const records = getSheetData(SHEETS.LOAN_ADVANCE);
    
    return {
      success: true,
      action: 'getLoanAdvance',
      data: records,
      message: 'Loan/advance records retrieved'
    };
  } catch (error) {
    return sanitizedError('getLoanAdvance', error);
  }
}

/**
 * Add loan/advance record
 */
function handleAddLoanAdvance(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'LoanAdvance', 'canAdd')) {
    return unauthorizedResponse('addLoanAdvance');
  }
  
  try {
    // Validate required fields
    const requiredFields = ['id', 'employeeName', 'type', 'amount'];
    const validationError = validateRequired(payload, requiredFields);
    if (validationError) {
      return {
        success: false,
        action: 'addLoanAdvance',
        data: null,
        message: validationError
      };
    }
    
    // Prepare record data (v3 schema — aligned with frontend)
    const recordData = {
      id: payload.id,
      employeeId: payload.employeeId || '',
      employeeName: payload.employeeName,
      type: payload.type,
      amount: parseNumber(payload.amount, 0),
      issueDate: payload.issueDate || getTodayISO(),
      paymentMethod: payload.paymentMethod || '',
      remarks: payload.remarks || '',
      repaymentType: payload.repaymentType || '',
      monthlyDeduct: parseNumber(payload.monthlyDeduct, 0),
      status: payload.status || 'Active',
      createdAt: payload.createdAt || getTodayISO()
    };
    
    // Add record
    addRecord(SHEETS.LOAN_ADVANCE, recordData);
    
    return {
      success: true,
      action: 'addLoanAdvance',
      data: recordData,
      message: 'Loan/advance record added'
    };
  } catch (error) {
    return sanitizedError('addLoanAdvance', error);
  }
}

/**
 * Delete loan/advance record
 */
function handleDeleteLoanAdvance(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'LoanAdvance', 'canDelete')) {
    return unauthorizedResponse('deleteLoanAdvance');
  }
  
  try {
    const deleted = deleteRecord(SHEETS.LOAN_ADVANCE, payload.id);
    
    if (!deleted) {
      return {
        success: false,
        action: 'deleteLoanAdvance',
        data: null,
        message: 'Loan/advance record not found'
      };
    }
    
    return {
      success: true,
      action: 'deleteLoanAdvance',
      data: null,
      message: 'Loan/advance record deleted'
    };
  } catch (error) {
    return sanitizedError('deleteLoanAdvance', error);
  }
}
