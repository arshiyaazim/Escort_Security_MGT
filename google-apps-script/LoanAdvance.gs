/**
 * Al-Aqsa HRM Backend - Loan/Advance Handler
 * Operations for loan and advance tracking
 *
 * Phase 1 schema:
 *   id, employeeId, employeeName, amount, issueDate, status, createdAt
 *
 * On create: immediately appends a negative-amount entry to salary ledger.
 */

/**
 * Get all loan/advance records
 */
function handleGetLoanAdvance(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'LoanAdvance', 'canView')) {
    return unauthorizedResponse('getLoanAdvance');
  }
  try {
    var records = getSheetData(SHEETS.LOAN_ADVANCE);
    return { success: true, action: 'getLoanAdvance', data: records, message: 'Loan/advance records retrieved' };
  } catch (error) {
    return sanitizedError('getLoanAdvance', error);
  }
}

/**
 * Add loan/advance record
 *
 * Phase 1: Simplified schema + immediate ledger deduction.
 */
function handleAddLoanAdvance(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'LoanAdvance', 'canAdd')) {
    return unauthorizedResponse('addLoanAdvance');
  }

  try {
    var requiredFields = ['id', 'employeeName', 'amount'];
    var validationError = validateRequired(payload, requiredFields);
    if (validationError) {
      return { success: false, action: 'addLoanAdvance', data: null, message: validationError };
    }

    var amount = parseNumber(payload.amount, 0);

    var recordData = {
      id: payload.id,
      employeeId: payload.employeeId || '',
      employeeName: payload.employeeName,
      amount: amount,
      issueDate: payload.issueDate || getTodayISO(),
      status: payload.status || 'Active',
      createdAt: getNowISO()
    };

    addRecord(SHEETS.LOAN_ADVANCE, recordData);

    // Immediately append negative amount to salary ledger
    appendLedgerEntry({
      employeeId: recordData.employeeId,
      employeeName: recordData.employeeName,
      clientId: '',
      clientName: '',
      sourceModule: 'LoanAdvance',
      sourceId: recordData.id,
      entryType: 'advance',
      dutyType: 'Loan',
      rateSnapshot: 0,
      quantity: 1,
      amount: -Math.abs(amount)
    });

    return { success: true, action: 'addLoanAdvance', data: recordData, message: 'Loan/advance record added' };
  } catch (error) {
    return sanitizedError('addLoanAdvance', error);
  }
}

/**
 * Delete loan/advance record
 */
function handleDeleteLoanAdvance(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'LoanAdvance', 'canDelete')) {
    return unauthorizedResponse('deleteLoanAdvance');
  }
  try {
    // Verify loan exists before reversing
    var loan = findById(SHEETS.LOAN_ADVANCE, payload.id);
    if (!loan) {
      return { success: false, action: 'deleteLoanAdvance', data: null, message: 'Loan/advance record not found' };
    }

    // Reverse the advance entry(ies) in the salary ledger
    var reversals = reverseLoanEntry(payload.id);

    // Delete the loan record
    deleteRecord(SHEETS.LOAN_ADVANCE, payload.id);

    logActivity({ sessionUser: sessionUser, action: 'deleteLoanAdvance', module: 'LoanAdvance', recordId: payload.id, summary: 'Deleted loan ' + payload.id + ' for ' + (loan.employeeName || '') + ' (reversed ' + reversals.length + ' ledger entries)', success: true });

    return { success: true, action: 'deleteLoanAdvance', data: null, message: 'Loan/advance record deleted (ledger reversed)' };
  } catch (error) {
    return sanitizedError('deleteLoanAdvance', error);
  }
}
