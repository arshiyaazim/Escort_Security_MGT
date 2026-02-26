/**
 * Al-Aqsa HRM Backend - Salary Ledger Handler
 * Operations for salary ledger and salary generation
 */

/**
 * Get salary ledger records (filtered by employeeId and/or month)
 */
function handleGetSalaryLedger(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'Salary', 'canView')) {
    return unauthorizedResponse('getSalaryLedger');
  }
  
  try {
    let records = getSheetData(SHEETS.SALARY_LEDGER);
    
    // Filter by employeeId/Name if provided
    if (payload.employeeId) {
      const searchTerm = payload.employeeId.toLowerCase();
      records = records.filter(e => 
        (e.employeeName && e.employeeName.toLowerCase().includes(searchTerm)) ||
        e.employeeId === payload.employeeId
      );
    }
    
    // Filter by month if provided
    // Normalize: month column could be stored as Date object by Sheets
    if (payload.month) {
      var filterMonth = String(payload.month).trim();
      records = records.filter(function(e) {
        var m = normalizeDateValue(e.month);
        // month column is YYYY-MM; normalizeDateValue may return YYYY-MM-DD for Date objects
        return m.substring(0, 7) === filterMonth;
      });
    }
    
    // Normalize date fields in returned records
    records = records.map(function(r) {
      r.date = normalizeDateValue(r.date);
      return r;
    });
    
    return {
      success: true,
      action: 'getSalaryLedger',
      data: records,
      message: 'Salary ledger retrieved'
    };
  } catch (error) {
    return sanitizedError('getSalaryLedger', error);
  }
}

/**
 * Generate salary entries from unprocessed events
 */
function handleGenerateSalary(payload, sessionUser) {
  // Permission check
  if (!checkPermission(sessionUser.role, 'Salary', 'canAdd')) {
    return unauthorizedResponse('generateSalary');
  }
  
  try {
    const newEntries = [];
    const now = getNowISO();
    
    // Get processed events
    const processedEventsData = getSheetData(SHEETS.PROCESSED_EVENTS);
    const processedEvents = processedEventsData.map(e => e.eventKey);
    
    // Get current running balance for each employee from existing ledger
    const salaryLedger = getSheetData(SHEETS.SALARY_LEDGER);
    const employeeBalances = {};
    salaryLedger.forEach(entry => {
      employeeBalances[entry.employeeId] = parseNumber(entry.runningBalance, 0);
    });
    
    // Default daily rate
    const dailyRate = CONFIG.DEFAULT_DAILY_RATE || 500;
    
    // Process Guard Duty (if Present)
    const guardDuty = getSheetData(SHEETS.GUARD_DUTY);
    guardDuty.forEach(duty => {
      const eventKey = 'guard-' + duty.id;
      if (!processedEvents.includes(eventKey) && duty.status === 'Present') {
        const earned = dailyRate;
        const employeeId = duty.employeeId || 'EMP-' + duty.employeeName;
        const prevBalance = employeeBalances[employeeId] || 0;
        const newBalance = prevBalance + earned;
        
        const entry = {
          id: generateId('SAL'),
          employeeId: employeeId,
          employeeName: duty.employeeName,
          sourceModule: 'Guard',
          sourceId: duty.id,
          date: normalizeDateValue(duty.date),
          shiftOrHours: duty.shift,
          earnedAmount: earned,
          deductedAmount: 0,
          netChange: earned,
          runningBalance: newBalance,
          month: duty.date ? normalizeDateValue(duty.date).substring(0, 7) : getCurrentMonth(),
          createdAt: now
        };
        
        newEntries.push(entry);
        employeeBalances[employeeId] = newBalance;
        processedEvents.push(eventKey);
        
        // Record processed event
        addRecord(SHEETS.PROCESSED_EVENTS, { eventKey: eventKey, processedAt: now });
      }
    });
    
    // Process Day Labor
    const dayLabor = getSheetData(SHEETS.DAY_LABOR);
    dayLabor.forEach(labor => {
      const eventKey = 'labor-' + labor.id;
      if (!processedEvents.includes(eventKey)) {
        const hours = parseNumber(labor.hoursWorked, 0);
        const earned = (hours / 9) * dailyRate;
        const employeeId = labor.employeeId || 'EMP-' + labor.employeeName;
        const prevBalance = employeeBalances[employeeId] || 0;
        const newBalance = prevBalance + earned;
        
        const entry = {
          id: generateId('SAL'),
          employeeId: employeeId,
          employeeName: labor.employeeName,
          sourceModule: 'DayLabor',
          sourceId: labor.id,
          date: normalizeDateValue(labor.date),
          shiftOrHours: hours + ' hrs',
          earnedAmount: parseFloat(earned.toFixed(2)),
          deductedAmount: 0,
          netChange: parseFloat(earned.toFixed(2)),
          runningBalance: parseFloat(newBalance.toFixed(2)),
          month: labor.date ? normalizeDateValue(labor.date).substring(0, 7) : getCurrentMonth(),
          createdAt: now
        };
        
        newEntries.push(entry);
        employeeBalances[employeeId] = newBalance;
        processedEvents.push(eventKey);
        
        // Record processed event
        addRecord(SHEETS.PROCESSED_EVENTS, { eventKey: eventKey, processedAt: now });
      }
    });
    
    // Process Escort Duty (Active + completed only — skip ongoing duties without endDate)
    const escortDuty = getSheetData(SHEETS.ESCORT_DUTY);
    escortDuty.forEach(escort => {
      const eventKey = 'escort-' + escort.id;
      // Skip ongoing duties (no endDate) — salary is calculated only after duty completion
      if (!escort.endDate) return;
      if (!processedEvents.includes(eventKey) && String(escort.status || '').toLowerCase() === 'active') {
        const totalDays = parseNumber(escort.totalDays, 0);
        const conveyance = parseNumber(escort.conveyance, 0);
        const earned = (dailyRate * totalDays) + conveyance;
        const employeeId = escort.employeeId || 'EMP-' + escort.employeeName;
        const prevBalance = employeeBalances[employeeId] || 0;
        const newBalance = prevBalance + earned;
        
        const entry = {
          id: generateId('SAL'),
          employeeId: employeeId,
          employeeName: escort.employeeName,
          sourceModule: 'Escort',
          sourceId: escort.id,
          date: normalizeDateValue(escort.startDate),
          shiftOrHours: totalDays + ' days',
          earnedAmount: parseFloat(earned.toFixed(2)),
          deductedAmount: 0,
          netChange: parseFloat(earned.toFixed(2)),
          runningBalance: parseFloat(newBalance.toFixed(2)),
          month: escort.startDate ? normalizeDateValue(escort.startDate).substring(0, 7) : getCurrentMonth(),
          createdAt: now
        };
        
        newEntries.push(entry);
        employeeBalances[employeeId] = newBalance;
        processedEvents.push(eventKey);
        
        // Record processed event
        addRecord(SHEETS.PROCESSED_EVENTS, { eventKey: eventKey, processedAt: now });
      }
    });
    
    // Process Loan/Advance (Active only - as deductions)
    const loanAdvance = getSheetData(SHEETS.LOAN_ADVANCE);
    loanAdvance.forEach(loan => {
      const eventKey = 'loan-' + loan.id;
      if (!processedEvents.includes(eventKey) && String(loan.status || '').toLowerCase() === 'active') {
        const deducted = parseNumber(loan.amount, 0);
        const employeeId = loan.employeeId || 'EMP-' + loan.employeeName;
        const prevBalance = employeeBalances[employeeId] || 0;
        const newBalance = prevBalance - deducted;
        
        const entry = {
          id: generateId('SAL'),
          employeeId: employeeId,
          employeeName: loan.employeeName,
          sourceModule: 'LoanAdvance',
          sourceId: loan.id,
          date: normalizeDateValue(loan.issueDate),
          shiftOrHours: loan.type,
          earnedAmount: 0,
          deductedAmount: deducted,
          netChange: -deducted,
          runningBalance: parseFloat(newBalance.toFixed(2)),
          month: loan.issueDate ? normalizeDateValue(loan.issueDate).substring(0, 7) : getCurrentMonth(),
          createdAt: now
        };
        
        newEntries.push(entry);
        employeeBalances[employeeId] = newBalance;
        processedEvents.push(eventKey);
        
        // Record processed event
        addRecord(SHEETS.PROCESSED_EVENTS, { eventKey: eventKey, processedAt: now });
      }
    });
    
    // Add new entries to salary ledger
    newEntries.forEach(entry => {
      addRecord(SHEETS.SALARY_LEDGER, entry);
    });
    
    return {
      success: true,
      action: 'generateSalary',
      data: { entriesGenerated: newEntries.length },
      message: 'Generated ' + newEntries.length + ' salary entries'
    };
  } catch (error) {
    return sanitizedError('generateSalary', error);
  }
}

/**
 * Get employee payroll summary for a given month.
 * Computes salary breakdown from raw duty records (not from salary ledger).
 *
 * Formula:
 *   dailyRate = salary / totalDaysInMonth
 *   gross = dailyRate * totalWorkingDays + conveyance
 *   net = gross - totalLoanAdvance
 *
 * Working day rules:
 *   Guard: unique (date, shift) pairs where status is Present or Late
 *   Day Labor: 9 hours = 1 working day; overtimeHours = max(0, totalHours - 9*workingDays)
 *   Escort: only completed programs (endDate filled); each calendar day in month = working day
 *
 * payload: { employeeId, month (YYYY-MM) }
 */
function handleGetEmployeePayrollSummary(payload, sessionUser) {
  if (!checkPermission(sessionUser.role, 'Salary', 'canView')) {
    return unauthorizedResponse('getEmployeePayrollSummary');
  }
  try {
    var empId = String(payload.employeeId || '').trim();
    var month = String(payload.month || '').trim(); // YYYY-MM
    if (!empId || !month) {
      return { success: false, action: 'getEmployeePayrollSummary', data: null, message: 'employeeId and month are required' };
    }

    // Fetch employee record to get salary
    var employees = getSheetData(SHEETS.EMPLOYEES);
    var employee = null;
    for (var ei = 0; ei < employees.length; ei++) {
      if (String(employees[ei].id) === empId) { employee = employees[ei]; break; }
    }
    if (!employee) {
      return { success: false, action: 'getEmployeePayrollSummary', data: null, message: 'Employee not found' };
    }

    var salary = parseNumber(employee.salary, 0);
    // Total calendar days in the requested month
    var yearNum = parseInt(month.split('-')[0], 10);
    var monthNum = parseInt(month.split('-')[1], 10);
    var totalDaysInMonth = new Date(yearNum, monthNum, 0).getDate();
    var dailyRate = totalDaysInMonth > 0 ? salary / totalDaysInMonth : 0;

    // ---- Guard Duty ----
    var guardData = getSheetData(SHEETS.GUARD_DUTY);
    var guardForEmp = guardData.filter(function(r) {
      return String(r.employeeId) === empId && normalizeDateValue(r.date).substring(0, 7) === month;
    });
    var presentDays = 0, absentDays = 0, lateDays = 0;
    // Track unique date+shift combinations worked
    var guardShiftSet = {};
    guardForEmp.forEach(function(r) {
      var s = (r.status || '').toLowerCase();
      if (s === 'present' || s === 'late') {
        var key = normalizeDateValue(r.date) + '_' + (r.shift || 'Day');
        guardShiftSet[key] = true;
        if (s === 'late') lateDays++;
      } else {
        absentDays++;
      }
    });
    // Working days = unique (date, shift) pairs where present or late
    var guardWorkingDays = Object.keys(guardShiftSet).length;
    presentDays = guardWorkingDays; // present includes late
    // Overtime: > 1 shift per unique date
    var guardDateCounts = {};
    Object.keys(guardShiftSet).forEach(function(key) {
      var d = key.split('_')[0];
      guardDateCounts[d] = (guardDateCounts[d] || 0) + 1;
    });
    var overtimeShifts = 0;
    Object.keys(guardDateCounts).forEach(function(d) {
      if (guardDateCounts[d] > 1) overtimeShifts += guardDateCounts[d] - 1;
    });

    // ---- Escort Duty (completed programs only — endDate must be filled) ----
    var escortData = getSheetData(SHEETS.ESCORT_DUTY);
    var escortWorkingDays = 0, escortConveyance = 0, escortCompletedPrograms = 0;
    escortData.forEach(function(r) {
      if (String(r.employeeId) !== empId) return;
      if (String(r.status || '').toLowerCase() !== 'active') return;
      // Only completed programs (endDate is filled)
      if (!r.endDate) return;
      var rStart = normalizeDateValue(r.startDate);
      var rEnd = normalizeDateValue(r.endDate);
      if (!rStart || !rEnd) return;
      // Check if this program overlaps with the requested month
      var monthStart = month + '-01';
      var monthEnd = month + '-' + String(totalDaysInMonth).padStart(2, '0');
      if (rEnd < monthStart || rStart > monthEnd) return; // no overlap
      escortCompletedPrograms++;
      // Count calendar days within the month for this program
      var effectiveStart = rStart > monthStart ? rStart : monthStart;
      var effectiveEnd = rEnd < monthEnd ? rEnd : monthEnd;
      var curDate = new Date(effectiveStart + 'T00:00:00');
      var endDate = new Date(effectiveEnd + 'T00:00:00');
      var daysInRange = 0;
      while (curDate <= endDate) {
        daysInRange++;
        curDate.setDate(curDate.getDate() + 1);
      }
      escortWorkingDays += daysInRange;
      escortConveyance += parseNumber(r.conveyance, 0);
    });

    // ---- Day Labor ----
    var laborData = getSheetData(SHEETS.DAY_LABOR);
    var laborRecords = laborData.filter(function(r) {
      return String(r.employeeId) === empId && normalizeDateValue(r.date).substring(0, 7) === month;
    });
    var laborTotalHours = 0;
    var laborUniqueShifts = {};
    laborRecords.forEach(function(r) {
      laborTotalHours += parseNumber(r.hoursWorked, 0);
      var shiftKey = normalizeDateValue(r.date) + '_' + (r.shift || 'Day');
      laborUniqueShifts[shiftKey] = true;
    });
    var laborShiftCount = Object.keys(laborUniqueShifts).length;
    // 9 hours = 1 working day
    var laborWorkingDays = Math.floor(laborTotalHours / 9);
    var laborOvertimeHours = Math.max(0, laborTotalHours - (laborWorkingDays * 9));

    // ---- Total Working Days across all modules ----
    var totalWorkingDays = guardWorkingDays + escortWorkingDays + laborWorkingDays;

    // ---- Loans (Active only — total deduction) ----
    var loanData = getSheetData(SHEETS.LOAN_ADVANCE);
    var activeLoans = loanData.filter(function(r) {
      return String(r.employeeId) === empId && String(r.status || '').toLowerCase() === 'active';
    });
    var totalLoanAdvance = activeLoans.reduce(function(sum, r) { return sum + parseNumber(r.amount, 0); }, 0);

    // ---- Final payroll computation ----
    var gross = (dailyRate * totalWorkingDays) + escortConveyance;
    var net = gross - totalLoanAdvance;

    var summary = {
      employeeId: empId,
      employeeName: employee.name || '',
      month: month,
      salary: salary,
      totalDaysInMonth: totalDaysInMonth,
      dailyRate: parseFloat(dailyRate.toFixed(2)),
      totalWorkingDays: totalWorkingDays,
      guardDuty: {
        presentDays: presentDays,
        absentDays: absentDays,
        lateDays: lateDays,
        workingDays: guardWorkingDays,
        overtimeShifts: overtimeShifts
      },
      escortDuty: {
        completedPrograms: escortCompletedPrograms,
        workingDays: escortWorkingDays,
        conveyance: escortConveyance
      },
      dayLabor: {
        totalHours: laborTotalHours,
        workingDays: laborWorkingDays,
        overtimeHours: laborOvertimeHours,
        shiftCount: laborShiftCount
      },
      loans: {
        activeCount: activeLoans.length,
        totalDeduction: totalLoanAdvance
      },
      gross: parseFloat(gross.toFixed(2)),
      totalDeductions: totalLoanAdvance,
      net: parseFloat(net.toFixed(2))
    };

    return { success: true, action: 'getEmployeePayrollSummary', data: summary, message: 'Payroll summary retrieved' };
  } catch (error) {
    return sanitizedError('getEmployeePayrollSummary', error);
  }
}
