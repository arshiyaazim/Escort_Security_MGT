/**
 * Al-Aqsa HRM Backend - Invoices Handler
 * Operations for invoice generation and management
 */

// Invoice counter (stored in script properties)
function getNextInvoiceNumber() {
  const props = PropertiesService.getScriptProperties();
  let counter = parseInt(props.getProperty('invoiceCounter') || '0');
  counter++;
  props.setProperty('invoiceCounter', counter.toString());
  return 'INV-' + counter;
}

/**
 * Get invoices (filtered by client and/or date range)
 */
function handleGetInvoices(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'Invoices', 'canView')) {
    return unauthorizedResponse('getInvoices');
  }
  
  try {
    let records = getSheetData(SHEETS.INVOICES);
    
    // Filter by clientId/Name if provided
    if (payload.clientId) {
      const searchTerm = payload.clientId.toLowerCase();
      records = records.filter(i => 
        (i.clientName && i.clientName.toLowerCase().includes(searchTerm)) ||
        i.clientId === payload.clientId
      );
    }
    
    // Filter by date range
    // Normalize all dates: sheet may store Date objects via getValues()
    if (payload.startDate) {
      var filterStart = normalizeDateValue(payload.startDate);
      records = records.filter(function(i) {
        return normalizeDateValue(i.periodEnd) >= filterStart;
      });
    }
    
    if (payload.endDate) {
      var filterEnd = normalizeDateValue(payload.endDate);
      records = records.filter(function(i) {
        return normalizeDateValue(i.periodStart) <= filterEnd;
      });
    }
    
    // Normalize date fields in returned records so frontend always gets strings
    records = records.map(function(r) {
      r.periodStart = normalizeDateValue(r.periodStart);
      r.periodEnd = normalizeDateValue(r.periodEnd);
      r.invoiceDate = normalizeDateValue(r.invoiceDate);
      return r;
    });
    
    return {
      success: true,
      action: 'getInvoices',
      data: records,
      message: 'Invoices retrieved'
    };
  } catch (error) {
    return sanitizedError('getInvoices', error);
  }
}

/**
 * Generate invoice from duty data
 */
function handleGenerateInvoice(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'Invoices', 'canAdd')) {
    return unauthorizedResponse('generateInvoice');
  }
  
  try {
    const periodStart = payload.periodStart;
    const periodEnd = payload.periodEnd;
    const clientName = payload.clientName;
    const contactRate = parseNumber(payload.contactRate, 0);
    const vatPercent = parseNumber(payload.vatPercent, 0);
    
    // Validate required fields
    if (!periodStart || !periodEnd || !clientName) {
      return {
        success: false,
        action: 'generateInvoice',
        data: null,
        message: 'Period start, period end, and client name are required'
      };
    }
    
    // Calculate Escort Duty totals for this client/period
    const escortDuty = getSheetData(SHEETS.ESCORT_DUTY);
    const escortRecords = escortDuty.filter(e => 
      e.clientName === clientName &&
      e.startDate <= periodEnd &&
      e.endDate >= periodStart &&
      String(e.status || '').toLowerCase() === 'active'
    );
    const totalEscortDays = escortRecords.reduce((sum, e) => sum + parseNumber(e.totalDays, 0), 0);
    const escortAmount = totalEscortDays * contactRate;
    
    // Calculate Guard Duty totals (Present only)
    const guardDuty = getSheetData(SHEETS.GUARD_DUTY);
    const guardRecords = guardDuty.filter(g => 
      g.clientName === clientName &&
      g.date >= periodStart &&
      g.date <= periodEnd &&
      g.status === 'Present'
    );
    const totalGuardDays = guardRecords.length;
    const guardAmount = totalGuardDays * contactRate;
    
    // Calculate Day Labor totals
    const dayLabor = getSheetData(SHEETS.DAY_LABOR);
    const laborRecords = dayLabor.filter(l => 
      l.clientName === clientName &&
      l.date >= periodStart &&
      l.date <= periodEnd
    );
    const totalLaborHours = laborRecords.reduce((sum, l) => sum + parseNumber(l.hoursWorked, 0), 0);
    const laborAmount = (totalLaborHours / 9) * contactRate; // 9 hours = 1 day
    
    // Calculate totals
    const subtotal = escortAmount + guardAmount + laborAmount;
    const vatAmount = subtotal * (vatPercent / 100);
    const totalAmount = subtotal + vatAmount;
    
    // Generate invoice
    const newInvoice = {
      id: generateId('INV'),
      invoiceNumber: getNextInvoiceNumber(),
      clientId: payload.clientId || '',
      clientName: clientName,
      periodStart: periodStart,
      periodEnd: periodEnd,
      totalEscortDays: totalEscortDays,
      escortAmount: parseFloat(escortAmount.toFixed(2)),
      totalGuardDays: totalGuardDays,
      guardAmount: parseFloat(guardAmount.toFixed(2)),
      totalLaborHours: totalLaborHours,
      laborAmount: parseFloat(laborAmount.toFixed(2)),
      subtotal: parseFloat(subtotal.toFixed(2)),
      vatPercent: vatPercent,
      vatAmount: parseFloat(vatAmount.toFixed(2)),
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      status: 'Draft',
      createdAt: getTodayISO()
    };
    
    addRecord(SHEETS.INVOICES, newInvoice);
    
    return {
      success: true,
      action: 'generateInvoice',
      data: newInvoice,
      message: 'Invoice generated'
    };
  } catch (error) {
    return sanitizedError('generateInvoice', error);
  }
}

/**
 * Finalize invoice
 */
function handleFinalizeInvoice(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'Invoices', 'canEdit')) {
    return unauthorizedResponse('finalizeInvoice');
  }
  
  try {
    const invoice = findById(SHEETS.INVOICES, payload.id);
    
    if (!invoice) {
      return {
        success: false,
        action: 'finalizeInvoice',
        data: null,
        message: 'Invoice not found'
      };
    }
    
    if (invoice.status !== 'Draft') {
      return {
        success: false,
        action: 'finalizeInvoice',
        data: null,
        message: 'Only draft invoices can be finalized'
      };
    }
    
    // Update status
    invoice.status = 'Finalized';
    updateRecord(SHEETS.INVOICES, payload.id, invoice);
    
    return {
      success: true,
      action: 'finalizeInvoice',
      data: invoice,
      message: 'Invoice finalized'
    };
  } catch (error) {
    return sanitizedError('finalizeInvoice', error);
  }
}

/**
 * Mark invoice as paid
 */
function handleMarkInvoicePaid(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'Invoices', 'canEdit')) {
    return unauthorizedResponse('markInvoicePaid');
  }
  
  try {
    const invoice = findById(SHEETS.INVOICES, payload.id);
    
    if (!invoice) {
      return {
        success: false,
        action: 'markInvoicePaid',
        data: null,
        message: 'Invoice not found'
      };
    }
    
    if (invoice.status !== 'Finalized') {
      return {
        success: false,
        action: 'markInvoicePaid',
        data: null,
        message: 'Only finalized invoices can be marked as paid'
      };
    }
    
    // Update status
    invoice.status = 'Paid';
    updateRecord(SHEETS.INVOICES, payload.id, invoice);
    
    return {
      success: true,
      action: 'markInvoicePaid',
      data: invoice,
      message: 'Invoice marked as paid'
    };
  } catch (error) {
    return sanitizedError('markInvoicePaid', error);
  }
}

/**
 * Delete invoice (only draft)
 */
function handleDeleteInvoice(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'Invoices', 'canDelete')) {
    return unauthorizedResponse('deleteInvoice');
  }
  
  try {
    const invoice = findById(SHEETS.INVOICES, payload.id);
    
    if (!invoice) {
      return {
        success: false,
        action: 'deleteInvoice',
        data: null,
        message: 'Invoice not found'
      };
    }
    
    if (invoice.status !== 'Draft') {
      return {
        success: false,
        action: 'deleteInvoice',
        data: null,
        message: 'Only draft invoices can be deleted'
      };
    }
    
    deleteRecord(SHEETS.INVOICES, payload.id);
    
    return {
      success: true,
      action: 'deleteInvoice',
      data: null,
      message: 'Invoice deleted'
    };
  } catch (error) {
    return sanitizedError('deleteInvoice', error);
  }
}
