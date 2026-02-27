/**
 * Al-Aqsa HRM Backend - Invoices Handler
 * Invoice generation aligned with client rate structure + salary ledger.
 *
 * Phase 3 invoice schema:
 *   id, clientId, clientName, periodStart, periodEnd,
 *   grossAmount, salaryCost, margin, status, createdAt
 *
 * Phase 3 invoiceDetails schema:
 *   invoiceId, dutyType, dutyId, employeeId, quantity, rate, amount
 *
 * Status lifecycle: Draft → Finalized → Paid
 * Only Draft invoices may be modified or deleted.
 */

// ────────────────────────────────────────────
// READ
// ────────────────────────────────────────────

/**
 * Get invoices (optionally filtered by clientId and/or date range)
 */
function handleGetInvoices(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'Invoices', 'canView')) {
    return unauthorizedResponse('getInvoices');
  }

  try {
    var records = getSheetData(SHEETS.INVOICES);

    if (payload.clientId) {
      var searchTerm = String(payload.clientId).toLowerCase();
      records = records.filter(function(r) {
        return r.clientId === payload.clientId ||
               (r.clientName && r.clientName.toLowerCase().indexOf(searchTerm) !== -1);
      });
    }

    if (payload.startDate) {
      var filterStart = normalizeDateValue(payload.startDate);
      records = records.filter(function(r) {
        return normalizeDateValue(r.periodEnd) >= filterStart;
      });
    }
    if (payload.endDate) {
      var filterEnd = normalizeDateValue(payload.endDate);
      records = records.filter(function(r) {
        return normalizeDateValue(r.periodStart) <= filterEnd;
      });
    }

    records = records.map(function(r) {
      r.periodStart = normalizeDateValue(r.periodStart);
      r.periodEnd = normalizeDateValue(r.periodEnd);
      return r;
    });

    return { success: true, action: 'getInvoices', data: records, message: 'Invoices retrieved' };
  } catch (error) {
    return sanitizedError('getInvoices', error);
  }
}

/**
 * Get invoice detail rows for a specific invoice
 */
function handleGetInvoiceDetails(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'Invoices', 'canView')) {
    return unauthorizedResponse('getInvoiceDetails');
  }

  try {
    if (!payload.invoiceId) {
      return { success: false, action: 'getInvoiceDetails', data: null, message: 'Missing invoiceId' };
    }
    var all = getSheetData(SHEETS.INVOICE_DETAILS);
    var details = all.filter(function(d) { return d.invoiceId === payload.invoiceId; });
    return { success: true, action: 'getInvoiceDetails', data: details, message: 'Invoice details retrieved' };
  } catch (error) {
    return sanitizedError('getInvoiceDetails', error);
  }
}

// ────────────────────────────────────────────
// GENERATE INVOICE
// ────────────────────────────────────────────

/**
 * Generate an invoice for a client over a date range.
 *
 * Steps:
 *   1. Fetch client rate structure (guardRate, escortRate, dayLaborRate, overtimeRate)
 *   2. Scan GuardDuty within range — Present=1, Late=0.5
 *   3. Scan EscortDuty — shift-based formula + conveyance
 *   4. Scan DayLabor — recalculate from hoursWorked using client rates
 *   5. grossAmount = sum of all billable amounts
 *   6. salaryCost = sum of salary ledger earning entries for client+period
 *   7. margin = grossAmount − salaryCost
 *   8. Create invoice (Draft) + invoiceDetails rows
 *
 * @param {Object} payload  { clientId, startDate, endDate }
 */
function handleGenerateInvoice(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'Invoices', 'canAdd')) {
    return unauthorizedResponse('generateInvoice');
  }

  try {
    // ── Validate ───────────────────────────
    if (!payload.clientId || !payload.startDate || !payload.endDate) {
      return { success: false, action: 'generateInvoice', data: null,
               message: 'clientId, startDate, and endDate are required' };
    }

    var clientId = String(payload.clientId).trim();
    var periodStart = normalizeDateValue(payload.startDate);
    var periodEnd   = normalizeDateValue(payload.endDate);

    if (!periodStart || !periodEnd || periodEnd < periodStart) {
      return { success: false, action: 'generateInvoice', data: null,
               message: 'Invalid date range' };
    }

    // ── Client rate structure ──────────────
    var client = findById(SHEETS.CLIENTS, clientId);
    if (!client) {
      return { success: false, action: 'generateInvoice', data: null,
               message: 'Client not found: ' + clientId };
    }
    var guardRate     = parseNumber(client.guardRate, 0);
    var escortRate    = parseNumber(client.escortRate, 0);
    var dayLaborRate  = parseNumber(client.dayLaborRate, 0);
    var overtimeRate  = parseNumber(client.overtimeRate, 0);
    var clientName    = client.companyName || '';

    var invoiceId = generateId('INV');
    var detailRows = [];
    var grossAmount = 0;

    // ── Guard Duty ────────────────────────
    var guardRecords = getSheetData(SHEETS.GUARD_DUTY).filter(function(g) {
      var d = normalizeDateValue(g.date);
      return g.clientId === clientId && d >= periodStart && d <= periodEnd;
    });

    for (var gi = 0; gi < guardRecords.length; gi++) {
      var g = guardRecords[gi];
      var statusLower = String(g.status || '').toLowerCase();
      var qty = 0;
      if (statusLower === 'present') qty = 1;
      else if (statusLower === 'late') qty = 0.5;
      if (qty <= 0) continue;

      var gAmt = parseFloat((qty * guardRate).toFixed(2));
      grossAmount += gAmt;
      detailRows.push({
        invoiceId: invoiceId,
        dutyType: 'GuardDuty',
        dutyId: g.id,
        employeeId: g.employeeId || '',
        quantity: qty,
        rate: guardRate,
        amount: gAmt
      });
    }

    // ── Escort Duty ───────────────────────
    var escortRecords = getSheetData(SHEETS.ESCORT_DUTY).filter(function(e) {
      var sDate = normalizeDateValue(e.startDate);
      var eDate = normalizeDateValue(e.endDate) || sDate;
      return e.clientId === clientId && sDate <= periodEnd && eDate >= periodStart;
    });

    for (var ei = 0; ei < escortRecords.length; ei++) {
      var e = escortRecords[ei];
      var eStatus = String(e.status || '').toLowerCase();
      var isOngoing   = eStatus === 'on-going' || eStatus === 'ongoing';
      var isCompleted = eStatus === 'completed';
      if (!isOngoing && !isCompleted) continue;

      var sDateStr = normalizeDateValue(e.startDate);
      var eDateStr = normalizeDateValue(e.endDate) || '';

      // Clamp to invoice period
      var calcStart = sDateStr < periodStart ? periodStart : sDateStr;
      var calcEnd;
      if (isOngoing) {
        calcEnd = periodEnd;
      } else {
        calcEnd = eDateStr && eDateStr < periodEnd ? eDateStr : periodEnd;
      }
      if (calcEnd < calcStart) continue;

      // Total calendar days (inclusive)
      var startMs = new Date(calcStart + 'T00:00:00Z').getTime();
      var endMs   = new Date(calcEnd   + 'T00:00:00Z').getTime();
      var calendarDays = Math.round((endMs - startMs) / 86400000) + 1;

      // Total shifts
      var totalShifts = calendarDays * 2;

      // Adjust start shift only if calcStart === actual startDate
      if (calcStart === sDateStr) {
        var startShift = String(e.startShift || '').toLowerCase();
        if (startShift === 'night') totalShifts -= 1;
      }

      // Adjust end shift only if Completed and calcEnd === actual endDate
      if (isCompleted && calcEnd === eDateStr) {
        var endShift = String(e.endShift || '').toLowerCase();
        if (endShift === 'day') totalShifts -= 1;
      }

      var payableDays = parseFloat((totalShifts * 0.5).toFixed(4));
      if (payableDays <= 0) continue;

      var eAmt = parseFloat((payableDays * escortRate).toFixed(2));
      grossAmount += eAmt;
      detailRows.push({
        invoiceId: invoiceId,
        dutyType: 'EscortDuty',
        dutyId: e.id,
        employeeId: e.employeeId || '',
        quantity: payableDays,
        rate: escortRate,
        amount: eAmt
      });

      // Conveyance (one-time per completed escort)
      var conv = parseNumber(e.conveyance, 0);
      if (isCompleted && conv > 0) {
        grossAmount += conv;
        detailRows.push({
          invoiceId: invoiceId,
          dutyType: 'Conveyance',
          dutyId: e.id,
          employeeId: e.employeeId || '',
          quantity: 1,
          rate: conv,
          amount: conv
        });
      }
    }

    // ── Day Labor ─────────────────────────
    var dayLaborRecords = getSheetData(SHEETS.DAY_LABOR).filter(function(d) {
      var dd = normalizeDateValue(d.date);
      return d.clientId === clientId && dd >= periodStart && dd <= periodEnd;
    });

    for (var di = 0; di < dayLaborRecords.length; di++) {
      var d = dayLaborRecords[di];
      var hours = parseNumber(d.hoursWorked, 0);
      if (hours <= 0) continue;

      var regHours = Math.min(hours, 9);
      var otHours  = Math.max(0, hours - 9);
      var baseAmt = parseFloat(((regHours / 9) * dayLaborRate).toFixed(2));
      var otAmt   = parseFloat((otHours * overtimeRate).toFixed(2));
      var dlTotal = parseFloat((baseAmt + otAmt).toFixed(2));

      grossAmount += dlTotal;
      detailRows.push({
        invoiceId: invoiceId,
        dutyType: 'DayLabor',
        dutyId: d.id,
        employeeId: d.employeeId || '',
        quantity: hours,
        rate: dayLaborRate,
        amount: dlTotal
      });
    }

    grossAmount = parseFloat(grossAmount.toFixed(2));

    // ── Salary cost from ledger ────────────
    // Net earning cost: earning + reversal entries (reversals correct earnings)
    // Advances excluded — they are employee loans, not operational cost.
    var ledger = getSheetData(SHEETS.SALARY_LEDGER);
    var salaryCost = 0;
    for (var li = 0; li < ledger.length; li++) {
      var lr = ledger[li];
      if (lr.clientId !== clientId) continue;
      if (lr.entryType !== 'earning' && lr.entryType !== 'reversal') continue;
      var ledgerDate = normalizeDateValue(lr.createdAt);
      if (ledgerDate.length >= 10) ledgerDate = ledgerDate.substring(0, 10);
      if (ledgerDate >= periodStart && ledgerDate <= periodEnd) {
        salaryCost += parseNumber(lr.amount, 0);
      }
    }
    salaryCost = parseFloat(salaryCost.toFixed(2));

    var margin = parseFloat((grossAmount - salaryCost).toFixed(2));

    // ── Write invoice record ──────────────
    var invoiceRecord = {
      id: invoiceId,
      clientId: clientId,
      clientName: clientName,
      periodStart: periodStart,
      periodEnd: periodEnd,
      grossAmount: grossAmount,
      salaryCost: salaryCost,
      margin: margin,
      status: 'Draft',
      createdAt: getNowISO()
    };
    addRecord(SHEETS.INVOICES, invoiceRecord);

    // ── Write detail rows ─────────────────
    for (var ri = 0; ri < detailRows.length; ri++) {
      addRecord(SHEETS.INVOICE_DETAILS, detailRows[ri]);
    }

    invoiceRecord.details = detailRows;

    return { success: true, action: 'generateInvoice', data: invoiceRecord,
             message: 'Invoice generated with ' + detailRows.length + ' line items' };
  } catch (error) {
    return sanitizedError('generateInvoice', error);
  }
}

// ────────────────────────────────────────────
// FINALIZE INVOICE
// ────────────────────────────────────────────

/**
 * Transition invoice from Draft → Finalized.
 * Locks the invoice against further edits.
 */
function handleFinalizeInvoice(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'Invoices', 'canEdit')) {
    return unauthorizedResponse('finalizeInvoice');
  }

  try {
    var invoice = findById(SHEETS.INVOICES, payload.id);
    if (!invoice) {
      return { success: false, action: 'finalizeInvoice', data: null, message: 'Invoice not found' };
    }
    if (invoice.status !== 'Draft') {
      return { success: false, action: 'finalizeInvoice', data: null,
               message: 'Only Draft invoices can be finalized (current: ' + invoice.status + ')' };
    }

    invoice.status = 'Finalized';
    updateRecord(SHEETS.INVOICES, payload.id, invoice);

    logActivity({ sessionUser: sessionUser, action: 'finalizeInvoice', module: 'Invoices', recordId: payload.id, summary: 'Finalized invoice ' + payload.id + ' for ' + (invoice.clientName || invoice.clientId), success: true });

    return { success: true, action: 'finalizeInvoice', data: invoice, message: 'Invoice finalized' };
  } catch (error) {
    return sanitizedError('finalizeInvoice', error);
  }
}

// ────────────────────────────────────────────
// MARK AS PAID
// ────────────────────────────────────────────

/**
 * Transition invoice from Finalized → Paid.
 * No further edits allowed after this.
 */
function handleMarkInvoicePaid(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'Invoices', 'canEdit')) {
    return unauthorizedResponse('markInvoicePaid');
  }

  try {
    var invoice = findById(SHEETS.INVOICES, payload.id);
    if (!invoice) {
      return { success: false, action: 'markInvoicePaid', data: null, message: 'Invoice not found' };
    }
    if (invoice.status !== 'Finalized') {
      return { success: false, action: 'markInvoicePaid', data: null,
               message: 'Only Finalized invoices can be marked as paid (current: ' + invoice.status + ')' };
    }

    invoice.status = 'Paid';
    updateRecord(SHEETS.INVOICES, payload.id, invoice);

    logActivity({ sessionUser: sessionUser, action: 'markInvoicePaid', module: 'Invoices', recordId: payload.id, summary: 'Marked invoice ' + payload.id + ' as paid (' + (invoice.clientName || invoice.clientId) + ', gross: ' + invoice.grossAmount + ')', success: true });

    return { success: true, action: 'markInvoicePaid', data: invoice, message: 'Invoice marked as paid' };
  } catch (error) {
    return sanitizedError('markInvoicePaid', error);
  }
}

// ────────────────────────────────────────────
// DELETE INVOICE (Draft only)
// ────────────────────────────────────────────

/**
 * Delete invoice and its detail rows.
 * Only Draft status invoices may be deleted.
 */
function handleDeleteInvoice(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'Invoices', 'canDelete')) {
    return unauthorizedResponse('deleteInvoice');
  }

  try {
    var invoice = findById(SHEETS.INVOICES, payload.id);
    if (!invoice) {
      return { success: false, action: 'deleteInvoice', data: null, message: 'Invoice not found' };
    }
    if (invoice.status !== 'Draft') {
      return { success: false, action: 'deleteInvoice', data: null,
               message: 'Only Draft invoices can be deleted (current: ' + invoice.status + ')' };
    }

    // Delete detail rows first
    deleteInvoiceDetails_(payload.id);

    // Delete invoice header
    deleteRecord(SHEETS.INVOICES, payload.id);

    logActivity({ sessionUser: sessionUser, action: 'deleteInvoice', module: 'Invoices', recordId: payload.id, summary: 'Deleted draft invoice ' + payload.id + ' (' + (invoice.clientName || invoice.clientId) + ', gross: ' + invoice.grossAmount + ')', success: true });

    return { success: true, action: 'deleteInvoice', data: null, message: 'Invoice deleted' };
  } catch (error) {
    return sanitizedError('deleteInvoice', error);
  }
}

// ────────────────────────────────────────────
// INTERNAL HELPERS
// ────────────────────────────────────────────

/**
 * Delete all invoiceDetails rows for a given invoiceId.
 * Scans from bottom to top to avoid row-shift issues.
 * @param {string} invoiceId
 */
function deleteInvoiceDetails_(invoiceId) {
  var sheet = getSheet(SHEETS.INVOICE_DETAILS);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return; // headers only

  var headers = data[0];
  var invIdCol = headers.indexOf('invoiceId');
  if (invIdCol < 0) return;

  // Collect rows to delete (bottom-up)
  var rowsToDelete = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][invIdCol]) === String(invoiceId)) {
      rowsToDelete.push(i + 1); // 1-indexed sheet row
    }
  }

  // Delete from bottom to preserve indices
  for (var j = rowsToDelete.length - 1; j >= 0; j--) {
    sheet.deleteRow(rowsToDelete[j]);
  }
}
