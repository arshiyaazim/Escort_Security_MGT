/**
 * Al-Aqsa HRM Backend - Margin Analytics Engine
 *
 * READ-ONLY analytics — no mutations to any sheet.
 *
 * Margin formula:
 *   Margin = Invoice Gross Amount − Net Earning Cost
 *
 * Net Earning Cost:
 *   SUM(ledger.amount WHERE entryType IN ('earning','reversal')
 *       AND clientId = invoice.clientId
 *       AND createdAt BETWEEN invoice.periodStart AND invoice.periodEnd)
 *
 * Exclusions:
 *   ❌ entryType = 'advance'
 *   ❌ Duty-sheet recalculation
 *   ❌ Salary summaries
 *
 * Ledger is the single source of truth for cost.
 */

// ── Duty-type normalisation ───────────────────────
// Invoice details use 'GuardDuty', 'EscortDuty', 'Conveyance', 'DayLabor'.
// Ledger uses sourceModule ('GuardDuty','EscortDuty','DayLabor').
// Spec wants 3 categories:  Guard | Escort | DayLabor
// Conveyance is merged into Escort on both revenue + cost sides.
var DUTY_CATEGORY_MAP_ = {
  'GuardDuty':  'Guard',
  'EscortDuty': 'Escort',
  'Conveyance': 'Escort',   // merge into Escort
  'DayLabor':   'DayLabor'
};

function normalizeDutyCategory_(raw) {
  return DUTY_CATEGORY_MAP_[raw] || String(raw || 'Other');
}

// ────────────────────────────────────────────────────
// MAIN HANDLER
// ────────────────────────────────────────────────────

/**
 * Compute margin analytics for a given period.
 *
 * Payload:
 *   { periodStart: 'YYYY-MM-DD', periodEnd: 'YYYY-MM-DD', clientId?: string }
 *
 * Response includes: summary, byClient[], byInvoice[], byDutyType[]
 * Operations role receives a restricted view (no margin %).
 *
 * @param {Object} payload
 * @param {Object} sessionUser
 * @returns {Object} standard response envelope
 */
function handleGetMarginAnalytics(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'Analytics', 'canView')) {
    return unauthorizedResponse('getMarginAnalytics');
  }

  try {
    // ── Validate ───────────────────────────────────
    if (!payload.periodStart || !payload.periodEnd) {
      return { success: false, action: 'getMarginAnalytics', data: null,
               message: 'periodStart and periodEnd are required (YYYY-MM-DD)' };
    }

    var periodStart = normalizeDateValue(payload.periodStart);
    var periodEnd   = normalizeDateValue(payload.periodEnd);

    if (!periodStart || !periodEnd || periodEnd < periodStart) {
      return { success: false, action: 'getMarginAnalytics', data: null,
               message: 'Invalid date range' };
    }

    // ── Step 1: Load data (once each) ──────────────
    var allInvoices = getSheetData(SHEETS.INVOICES);
    var allDetails  = getSheetData(SHEETS.INVOICE_DETAILS);
    var allLedger   = getSheetData(SHEETS.SALARY_LEDGER);

    // ── Filter invoices: Finalized|Paid within period ──
    var invoices = allInvoices.filter(function(inv) {
      var st = String(inv.status || '');
      if (st !== 'Finalized' && st !== 'Paid') return false;
      var invStart = normalizeDateValue(inv.periodStart);
      var invEnd   = normalizeDateValue(inv.periodEnd);
      return invStart >= periodStart && invEnd <= periodEnd;
    });

    if (payload.clientId) {
      var filterCid = String(payload.clientId).trim();
      invoices = invoices.filter(function(inv) {
        return String(inv.clientId) === filterCid;
      });
    }

    // ── Pre-index: ledger by clientId (earning+reversal only) ──
    var ledgerByClient = {};
    for (var li = 0; li < allLedger.length; li++) {
      var lr = allLedger[li];
      if (lr.entryType !== 'earning' && lr.entryType !== 'reversal') continue;
      var cid = String(lr.clientId || '');
      if (!ledgerByClient[cid]) ledgerByClient[cid] = [];
      ledgerByClient[cid].push(lr);
    }

    // ── Pre-index: invoiceDetails by invoiceId ──
    var detailsByInvoice = {};
    for (var di = 0; di < allDetails.length; di++) {
      var det = allDetails[di];
      var detInvId = String(det.invoiceId || '');
      if (!detailsByInvoice[detInvId]) detailsByInvoice[detInvId] = [];
      detailsByInvoice[detInvId].push(det);
    }

    // ── Step 2-4: Compute per-invoice metrics ──────
    var byInvoice = [];
    var byClientMap = {};      // clientId → { revenue, cost }
    var byDutyTypeMap = {};    // category → { revenue, cost }
    var totalRevenue = 0;
    var totalCost = 0;
    // Track which clientIds appear in invoices (for duty-cost filtering)
    var invoicedClients = {};

    for (var j = 0; j < invoices.length; j++) {
      var inv = invoices[j];
      var clientId     = String(inv.clientId || '');
      var invPeriodStart = normalizeDateValue(inv.periodStart);
      var invPeriodEnd   = normalizeDateValue(inv.periodEnd);

      invoicedClients[clientId] = true;

      // Revenue = grossAmount from invoice header
      var revenue = parseNumber(inv.grossAmount, 0);

      // Cost = net earning+reversal from ledger for this client+period
      var clientLedger = ledgerByClient[clientId] || [];
      var cost = 0;
      for (var k = 0; k < clientLedger.length; k++) {
        var entry = clientLedger[k];
        var ledgerDate = normalizeDateValue(entry.createdAt);
        if (ledgerDate.length >= 10) ledgerDate = ledgerDate.substring(0, 10);
        if (ledgerDate >= invPeriodStart && ledgerDate <= invPeriodEnd) {
          cost += parseNumber(entry.amount, 0);
        }
      }
      cost = parseFloat(cost.toFixed(2));

      var margin = parseFloat((revenue - cost).toFixed(2));
      var marginPct = revenue > 0 ? parseFloat(((margin / revenue) * 100).toFixed(2)) : 0;

      byInvoice.push({
        invoiceId:      inv.id,
        clientId:       clientId,
        clientName:     inv.clientName || '',
        periodStart:    invPeriodStart,
        periodEnd:      invPeriodEnd,
        status:         inv.status,
        revenue:        revenue,
        cost:           cost,
        margin:         margin,
        marginPercent:  marginPct,
        negativeMargin: margin < 0
      });

      totalRevenue += revenue;
      totalCost += cost;

      // ── Aggregate by client ───────────────
      if (!byClientMap[clientId]) {
        byClientMap[clientId] = {
          clientId:   clientId,
          clientName: inv.clientName || '',
          revenue:    0,
          cost:       0
        };
      }
      byClientMap[clientId].revenue += revenue;
      byClientMap[clientId].cost    += cost;

      // ── Aggregate revenue by dutyType (from invoice details) ──
      var invDetails = detailsByInvoice[String(inv.id)] || [];
      for (var dd = 0; dd < invDetails.length; dd++) {
        var cat = normalizeDutyCategory_(invDetails[dd].dutyType);
        var detAmt = parseNumber(invDetails[dd].amount, 0);
        if (!byDutyTypeMap[cat]) {
          byDutyTypeMap[cat] = { dutyType: cat, revenue: 0, cost: 0 };
        }
        byDutyTypeMap[cat].revenue += detAmt;
      }
    }

    // ── Aggregate cost by dutyType (from ledger, sourceModule) ──
    for (var lj = 0; lj < allLedger.length; lj++) {
      var le = allLedger[lj];
      if (le.entryType !== 'earning' && le.entryType !== 'reversal') continue;
      var leClientId = String(le.clientId || '');
      if (!invoicedClients[leClientId]) continue;  // only clients with invoices
      var leDate = normalizeDateValue(le.createdAt);
      if (leDate.length >= 10) leDate = leDate.substring(0, 10);
      if (leDate < periodStart || leDate > periodEnd) continue;

      var leCat = normalizeDutyCategory_(le.sourceModule);
      if (!byDutyTypeMap[leCat]) {
        byDutyTypeMap[leCat] = { dutyType: leCat, revenue: 0, cost: 0 };
      }
      byDutyTypeMap[leCat].cost += parseNumber(le.amount, 0);
    }

    // ── Finalize byClient ───────────────────
    var byClient = [];
    var clientIds = Object.keys(byClientMap);
    for (var ci = 0; ci < clientIds.length; ci++) {
      var cc = byClientMap[clientIds[ci]];
      cc.revenue   = parseFloat(cc.revenue.toFixed(2));
      cc.cost      = parseFloat(cc.cost.toFixed(2));
      cc.margin    = parseFloat((cc.revenue - cc.cost).toFixed(2));
      cc.marginPercent  = cc.revenue > 0 ? parseFloat(((cc.margin / cc.revenue) * 100).toFixed(2)) : 0;
      cc.negativeMargin = cc.margin < 0;
      byClient.push(cc);
    }

    // ── Finalize byDutyType ─────────────────
    var byDutyType = [];
    var dtKeys = Object.keys(byDutyTypeMap);
    for (var dti = 0; dti < dtKeys.length; dti++) {
      var dte = byDutyTypeMap[dtKeys[dti]];
      dte.revenue = parseFloat(dte.revenue.toFixed(2));
      dte.cost    = parseFloat(dte.cost.toFixed(2));
      dte.margin  = parseFloat((dte.revenue - dte.cost).toFixed(2));
      byDutyType.push(dte);
    }

    // ── Summary ─────────────────────────────
    totalRevenue = parseFloat(totalRevenue.toFixed(2));
    totalCost    = parseFloat(totalCost.toFixed(2));
    var totalMargin    = parseFloat((totalRevenue - totalCost).toFixed(2));
    var totalMarginPct = totalRevenue > 0
      ? parseFloat(((totalMargin / totalRevenue) * 100).toFixed(2))
      : 0;

    // ── Role-based restriction: Operations → hide margin % ──
    var restrictedView = (sessionUser.role === 'Operations');
    if (restrictedView) {
      totalMarginPct = null;
      for (var ri = 0; ri < byInvoice.length; ri++) {
        delete byInvoice[ri].marginPercent;
      }
      for (var rc = 0; rc < byClient.length; rc++) {
        delete byClient[rc].marginPercent;
      }
    }

    return {
      success: true,
      action: 'getMarginAnalytics',
      data: {
        summary: {
          totalRevenue:  totalRevenue,
          totalCost:     totalCost,
          totalMargin:   totalMargin,
          marginPercent: totalMarginPct
        },
        byClient:       byClient,
        byInvoice:      byInvoice,
        byDutyType:     byDutyType,
        period:         { start: periodStart, end: periodEnd },
        restrictedView: restrictedView
      },
      message: 'Margin analytics computed (' + invoices.length + ' invoices)'
    };
  } catch (error) {
    return sanitizedError('getMarginAnalytics', error);
  }
}
