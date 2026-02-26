# Implementation Report — Grouped Views, Conflict Validation, Payroll Summary & Activity Logging

**Date:** 2025-01-XX  
**Scope:** Phase 2 features from IMPLEMENTATION_PLAN.md Rev 2  
**Rev 2:** Business-rule corrections applied (6 fixes)

---

## 0. Rev 2 — Corrections Applied

| # | Issue | Fix |
|---|---|---|
| 1 | Escort grouped view used single-level grouping (clientName only) | Rewrote to **two-level grouping**: Client → VesselName. New `renderTwoLevelGroupedTable()` in `group-utils.js`. |
| 2 | Day Labor had no `shift` column — blocked both shifts on conflict | Added `shift` column to DAY_LABOR schema (setupDatabase + migrateDatabase), HTML form, JS payload, grouped/flat table rendering. Backend now validates per-shift only. |
| 3 | Day Labor+Guard cross-duty validation was shift-agnostic | Fixed `validateEmployeeDutyConflict()` — Day Labor now conflicts only on same date + same shift. Guard ↔ Day Labor also per-shift. Escort remains shift-agnostic. |
| 4 | Payroll used hardcoded `CONFIG.DEFAULT_DAILY_RATE` (500) | Rewritten: `dailyRate = salary / totalDaysInMonth`. Guard working days = unique (date,shift) where Present/Late. Day Labor: 9h = 1 working day + overtime. Escort: completed programs only (endDate filled), calendar days in month. Formula: `gross = dailyRate × totalWorkingDays + conveyance`, `net = gross − totalLoanAdvance`. |
| 5 | Activity logs stored raw payload (2000-char JSON) | Stripped payload. New schema columns: `date`, `employeeId`, `clientId`, `success`, `message`, `payloadHash` (SHA-256). VALIDATION_REJECTED events now logged on conflict. |
| 6 | Payroll employee selector was a dropdown | Replaced with typeahead lookup via `employee-lookup.js` on employees.html. Hidden `payrollEmployeeId` input now used. |

---

## 1. What Changed

### Backend (Google Apps Script)

| File | Changes |
|---|---|
| **Code.gs** | Added `ACTIVITY_LOGS` to `SHEETS` constant. Added `getEmployeePayrollSummary` and `getActivityLogs` to `ACTION_PERMISSIONS`. Added 2 new cases to `routeAction()` switch. |
| **Utilities.gs** | Added `logActivity()`, `handleGetActivityLogs()`, `validateEmployeeDutyConflict()`, `expandDateRange()`. Updated `setupDatabase()` and `migrateDatabase()` to include ACTIVITY_LOGS sheet. |
| **Salary.gs** | Added `handleGetEmployeePayrollSummary()` — full payroll breakdown per employee per month. |
| **GuardDuty.gs** | Added cross-duty conflict validation before `addRecord`. Added `logActivity()` calls on add/delete. |
| **DayLabor.gs** | Added cross-duty conflict validation before `addRecord`. Added `logActivity()` calls on add/delete. |
| **EscortDuty.gs** | Added cross-duty conflict validation before `addRecord` and `updateRecord`. Added `logActivity()` calls on add/update/delete. |

### Frontend (HTML + JS)

| File | Changes |
|---|---|
| **js/group-utils.js** | **NEW** — Shared grouped list view library: `groupBy`, `normalizeGroupKey`, `renderGroupedTable`, `toggleGroup`, `toggleAllGroups`, `escapeHtmlGroup`. |
| **guard-duty.html** | Added `group-utils.js` script tag. Added Flat/Grouped toggle buttons + Expand/Collapse All buttons. |
| **js/guard-duty.js** | Added `dutyViewMode` state. Modified `renderDutyTable()` to dispatch to grouped/flat. Added `renderGroupedDutyTable()` (groups by notes/location) and `setDutyViewMode()`. |
| **escort-duty.html** | Added `group-utils.js` script tag. Added Flat/Grouped toggle + Expand/Collapse All buttons. |
| **js/escort-duty.js** | Added `escortViewMode` state. Modified `renderEscortTable()` to dispatch. Added `renderGroupedEscortTable()` (groups by clientName → vesselName, two-level grouping) and `setEscortViewMode()`. |
| **day-labor.html** | Added `group-utils.js` script tag. Added Flat/Grouped toggle + Expand/Collapse All buttons. |
| **js/day-labor.js** | Added `laborViewMode` state. Modified `renderLaborTable()` to dispatch. Added `renderGroupedLaborTable()` (groups by clientName › notes) and `setLaborViewMode()`. |
| **employees.html** | Added Payroll Summary section with employee typeahead input (not dropdown), hidden `payrollEmployeeId` input, month picker, and result container. |
| **js/employees.js** | Added typeahead employee selector, hidden payrollEmployeeId, and `loadPayrollSummary()`. Removed dropdown logic. |

---

## 2. Why

1. **Grouped List Views** — Duty managers need to see records organized by location/client instead of a flat chronological list. Toggling between flat and grouped preserves both workflows.
2. **Cross-Duty Conflict Validation** — Prevents double-booking an employee across Guard Duty, Escort Duty, and Day Labor on the same date/shift. Enforces business rules at creation time.
3. **Employee Payroll Summary** — Provides a single-screen breakdown of an employee's earnings for a given month, reducing manual spreadsheet cross-referencing.
4. **Activity Logging** — Provides an auditable trail of all create/update/delete operations for compliance and debugging.

---

## 3. New API Actions and Payloads

### `getEmployeePayrollSummary`

**Permission:** Salary.canView  
**Payload:**
```json
{
  "employeeId": "EMP-xxxx",
  "month": "2025-01"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "employeeId": "EMP-xxxx",
    "employeeName": "John Doe",
    "month": "2025-01",
    "salary": 15000,
    "totalDaysInMonth": 31,
    "dailyRate": 483.87,
    "totalWorkingDays": 25,
    "guardDuty": {
      "presentDays": 20,
      "absentDays": 2,
      "lateDays": 3,
      "workingDays": 20,
      "overtimeShifts": 2
    },
    "escortDuty": {
      "completedPrograms": 2,
      "workingDays": 4,
      "conveyance": 800
    },
    "dayLabor": {
      "totalHours": 18,
      "workingDays": 2,
      "overtimeHours": 0,
      "shiftCount": 2
    },
    "loans": {
      "activeCount": 1,
      "totalDeduction": 5000
    },
    "gross": 12896.75,
    "totalDeductions": 5000,
    "net": 7896.75
  }
}
```

### `getActivityLogs`

**Permission:** UserManagement.canView (admin-only)  
**Payload:**
```json
{
  "module": "GuardDuty",
  "userId": "USR-xxxx",
  "limit": 100
}
```
All fields optional. Default limit: 100.  
**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "LOG-xxxx",
      "timestamp": "2025-01-15T10:30:00.000Z",
      "userId": "USR-xxxx",
      "userName": "Admin",
      "role": "Admin",
      "action": "ADD",
      "module": "GuardDuty",
      "recordId": "GD-xxxx",
      "summary": "Added guard duty for EMP-001 on 2025-01-15 Day shift",
      "date": "2025-01-15",
      "employeeId": "EMP-001",
      "clientId": "CL-001",
      "success": true,
      "message": "Guard duty added successfully",
      "payloadHash": "<sha256>"
    }
  ]
}
```

---

## 4. Validation Rules and Error Messages

### Cross-Duty Conflict Validation (`validateEmployeeDutyConflict`)

Called automatically before add/update on all 3 duty modules.

| Scenario | Rule | Error Message |
|---|---|---|
| Guard + Guard same date/shift | Employee already assigned to Guard Duty on that date and shift | `"Employee already has a Guard Duty record on [date] ([shift] shift)"` |
| Guard + Escort overlap | Employee on active Escort Duty during the Guard Duty date | `"Employee is on Escort Duty ([start] – [end]) — conflicts with GuardDuty on [date]"` |
| Guard + Day Labor same shift | Day Labor conflicts only on same shift | `"Employee has Day Labor on [date] ([shift]) — conflicts with Guard Duty"` |
| Escort + Guard overlap | Employee has Guard Duty on a date within the Escort range | `"Employee has Guard Duty on [date] ([shift]) — conflicts with EscortDuty"` |
| Escort + Escort overlap | Active Escort Duty date range overlaps | `"Employee is on Escort Duty ([start] – [end]) — conflicts with EscortDuty"` |
| Escort + Day Labor overlap | Day Labor on a date within Escort range (shift-agnostic) | `"Employee has Day Labor on [date] — conflicts with EscortDuty"` |
| Day Labor + Guard same shift | Guard Duty on same date and same shift | `"Employee has Guard Duty on [date] ([shift]) — conflicts with Day Labor"` |
| Day Labor + Escort overlap | Active Escort Duty covers that date (shift-agnostic) | `"Employee is on Escort Duty ([start] – [end]) — conflicts with DayLabor"` |
| Day Labor + Day Labor same shift | Duplicate Day Labor record on same date + shift | `"Employee already has a Day Labor record on [date] ([shift] shift)"` |

**Design decisions (Rev 2):**
- Day Labor is now **per-shift** — only blocks the selected shift (Day or Night), not both
- Guard ↔ Day Labor conflicts are also **per-shift**
- Escort Duty remains **shift-agnostic** — blocks BOTH shifts for every date in range
- Escort endDate comparison is **inclusive** (`<=`)
- `VALIDATION_REJECTED` events are logged to `activityLogs` when conflicts are detected
- `excludeId` parameter allows edit operations to skip self-conflict
- Forward-only validation — historic data is not retroactively checked

### Payroll Summary Validation


| Scenario | Error Message |
|---|---|
| Missing employeeId | `"employeeId and month are required"` |
| Missing month | `"employeeId and month are required"` |
| Employee not found | `"Employee not found"` |

#### Escort Payroll Calculation (Clarified)

- **Only count escort entries with both `startDate` and `endDate` filled (completed programs only).**
- **Working days = count of calendar dates in range intersecting the selected month.**
- **If/when per-day shift tracking is added, apply: two shifts = one working day; if no shift selected, count as one full working day.**
- **Ongoing (no endDate) programs are excluded from payroll.**

---

## 5. Grouped View Behavior

### Guard Duty
- **Group key:** `notes` field (location/site name). Blank → "General"
- **Group summary:** Count of Day/Night shifts, Present/Absent/Late counts
- **Default view:** Flat

### Escort Duty
- **Group key:** Two-level: **Level 1** = `clientName`, **Level 2** = `vesselName`. Blank → "General" / "Unknown Vessel"
- **L1 summary:** Total records, total days, active/ongoing counts, total conveyance
- **L2 summary:** Record count, total days, conveyance for that vessel
- **Default view:** Flat

### Day Labor
- **Group key:** `clientName › notes`. Blank → "General"
- **Group summary:** Record count, total hours, total amount
- **Columns:** Sl No., Employee, Client, Date, **Shift**, Hours, Rate, Amount, Notes, Actions (10 cols)
- **Default view:** Flat

### Shared Controls
- **Flat/Grouped toggle:** Segmented button pair. Active state is blue, inactive is gray.
- **Expand/Collapse All:** Only visible in Grouped mode. Controls all group sections.
- **All groups expanded by default** when switching to Grouped mode.
- **Pagination hidden** in Grouped mode (all records shown within groups).

---

## 6. Activity Logging

### Sheet: `activityLogs`
**Headers:** `id`, `timestamp`, `userId`, `userName`, `role`, `action`, `module`, `recordId`, `summary`, `date`, `employeeId`, `clientId`, `success`, `message`, `payloadHash`

### Logged Operations

| Module | Actions Logged |
|---|---|
| GuardDuty | addGuardDuty, deleteGuardDuty, VALIDATION_REJECTED |
| EscortDuty | addEscortDuty, updateEscortDuty, deleteEscortDuty, VALIDATION_REJECTED |
| DayLabor | addDayLabor, deleteDayLabor, VALIDATION_REJECTED |

### Behavior
- Fire-and-forget (errors are logged to console but do not block the primary operation)
- **No raw payload stored** — only metadata columns (date, employeeId, clientId, success, message)
- Optional `payloadHash` (SHA-256) stored for audit traceability without exposing raw data
- `VALIDATION_REJECTED` events logged when cross-duty conflict validation fails (success=false)
- Timestamps in ISO 8601 format
- Each log entry gets a unique `LOG-xxx` ID

---

## 7. Test Scenarios and How to Verify

### Grouped Views

1. **Guard Duty — Grouped by location**
   - Navigate to Guard Duty page
   - Click "Grouped" toggle → table re-renders with group headers based on `notes` field
   - Each group shows collapsible rows with per-group summary
   - Click "Expand All" / "Collapse All" to toggle all groups
   - Switch back to "Flat" → normal paginated table

2. **Escort Duty — Grouped by Client → Vessel (two-level)**
   - Navigate to Escort Duty page
   - Click "Grouped" → Level 1 headers group by `clientName`, Level 2 sub-headers group by `vesselName`
   - L1 summary shows total records, total days, active, ongoing, conveyance per client
   - L2 summary shows records, days, conveyance per vessel within that client

3. **Day Labor — Grouped by client › notes (with shift column)**
   - Navigate to Day Labor page
   - Click "Grouped" → groups by `clientName › notes`
   - Summary shows records, hours, amount per group
   - **Shift column visible** in both flat and grouped views

### Cross-Duty Conflict Validation

4. **Guard → Guard conflict (same date/shift)**
   - Add a Guard Duty record for Employee A on 2025-01-15 Day shift
   - Try adding another Guard Duty for Employee A on 2025-01-15 Day shift
   - Expected: Error toast with conflict message, record NOT created

5. **Guard → Escort conflict**
   - Add an Escort Duty for Employee B from 2025-01-10 to 2025-01-20
   - Try adding a Guard Duty for Employee B on 2025-01-15
   - Expected: Error — employee is on active Escort Duty

6. **Day Labor → Guard conflict (per-shift)**
   - Add a Guard Duty for Employee C on 2025-01-15 Night shift
   - Try adding Day Labor for Employee C on 2025-01-15 **Night** shift
   - Expected: Error — conflict on same date + same shift
   - Try adding Day Labor for Employee C on 2025-01-15 **Day** shift
   - Expected: **Success** — different shift, no conflict

7. **Escort update conflict**
   - Edit an existing Escort Duty to extend its date range
   - If new range overlaps another duty → error
   - If narrowing range → should succeed

8. **Edit self-exclusion**
   - Edit an Escort Duty record without changing dates → should succeed (excludeId prevents self-conflict)

### Payroll Summary

9. **Load payroll summary**
   - Go to Employees page
   - **Type employee name** in the payroll typeahead input (not dropdown)
   - Select employee from suggestions, pick a month (e.g., 2025-01)
   - Click "Load Summary"
   - Expected: Cards showing Guard Duty breakdown, Escort Duty, Day Labor, Loans, and Net Pay
   - Guard Duty: Present/Late/Absent counts, overtime shifts, workingDays = unique (date,shift) pairs
   - Escort: completedPrograms, workingDays (calendar days in month), conveyance
   - Day Labor: totalHours, workingDays (9h=1d), overtimeHours, shiftCount
   - Payroll Totals: salary, daysInMonth, dailyRate = salary/daysInMonth, totalWorkingDays, gross = dailyRate×totalWorkingDays+conveyance, deductions, net = gross−deductions
   - Loans: active loan deductions subtracted

10. **Missing fields**
    - Click "Load Summary" without selecting employee → amber warning message
    - Select employee but no month → amber warning

### Activity Logging

11. **Log creation on add**
    - Add a Guard Duty record → check activityLogs sheet → new row with action=addGuardDuty, module=GuardDuty, success=true, **no payload column**
    - Verify `date`, `employeeId`, `clientId` columns are populated

12. **Log creation on delete**
    - Delete an Escort Duty record → check activityLogs sheet → new row with action=deleteEscortDuty, module=EscortDuty

13. **VALIDATION_REJECTED logging**
    - Attempt to add a conflicting Guard Duty → check activityLogs → new row with action=VALIDATION_REJECTED, success=false, message contains conflict details

14. **Retrieve logs via API** (admin only)
    - Call `getActivityLogs` with `{ module: 'GuardDuty' }` → filtered results
    - Call `getActivityLogs` with `{ limit: 5 }` → max 5 results, newest first

---

## 8. New File

| Path | Purpose |
|---|---|
| `js/group-utils.js` | Shared library for grouped table rendering: grouping logic, collapsible groups, expand/collapse controls |

---

## 9. Database Changes

### Modified Sheet: `dayLabor`

Added column: `shift` (Day/Night) — inserted after `clientName`.

**v3 headers:** `id`, `date`, `employeeId`, `employeeName`, `clientId`, `clientName`, **`shift`**, `hoursWorked`, `rate`, `amount`, `notes`

**Migration:** Run `migrateDatabase()` to add the `shift` column. For existing records with blank shift:
- If your business historically treated all day labor as Day shift, backfill with 'Day' during migration (recommended for consistency).
- Otherwise, treat blank as 'Unspecified' and update validation/payroll logic:
  - For validation: block only if other entry is also 'Unspecified' or explicitly mapped.
  - For payroll: count as 1 shift-day (one shift = one working day).
**Choose and implement one policy consistently.**

### Modified Sheet: `activityLogs`

Removed: `payload` column.  
Added: `date`, `employeeId`, `clientId`, `success`, `message`, `payloadHash`.

**v3 headers:** `id`, `timestamp`, `userId`, `userName`, `role`, `action`, `module`, `recordId`, `summary`, **`date`**, **`employeeId`**, **`clientId`**, **`success`**, **`message`**, **`payloadHash`**

**Migration:** Run `migrateDatabase()` to add new columns. Existing `payload` column data is retained but no longer written to.
