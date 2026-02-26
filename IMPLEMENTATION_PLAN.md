# Al-Aqsa HRM v3 — Implementation Plan (Rev 2)
## Grouped List Views · Cross-Duty Validation · Employee Payroll Summary · Activity Logging

**Date**: 2026-02-25 (Rev 2)  
**Status**: PLAN ONLY — no code changes  
**Supersedes**: Rev 1 (same date)

---

## Table of Contents
1. [Scope & Goals](#1-scope--goals)
2. [Hard Business Rules](#2-hard-business-rules-enforcement-requirements)
3. [Data Requirements & Confirmed Schemas](#3-data-requirements--confirmed-schemas)
4. [Feature 1: Grouped List Views](#4-feature-1-grouped-list-views)
   - 4.1 Guard Duty — Client → Location
   - 4.2 Escort Duty — Client → Vessel
   - 4.3 Day Labor — Client → TBD
5. [Cross-Duty Conflict Validation](#5-cross-duty-conflict-validation)
6. [Feature 2: Employee Payroll Summary](#6-feature-2-employee-payroll-summary)
7. [Feature 3: Activity Logging (Audit Trail)](#7-feature-3-activity-logging-audit-trail)
8. [Feature 4: Reusable Grouped Rendering Framework](#8-feature-4-reusable-grouped-rendering-framework)
9. [Performance Considerations](#9-performance-considerations)
10. [Security & Permissions](#10-security--permissions)
11. [Migration Needs](#11-migration-needs)
12. [Test Plan](#12-test-plan)
13. [Exact Code Change Map](#13-exact-code-change-map)
14. [Phased Rollout](#14-phased-rollout)
15. [Clarifying Questions (MUST ANSWER BEFORE CODING)](#15-clarifying-questions-must-answer-before-coding)

---

## 1. Scope & Goals

| Goal | Outcome |
|------|---------|
| **Grouped list views** | Replace flat paginated tables on Guard Duty, Escort Duty, and Day Labor pages with two-level collapsible group views (Client → sub-group). Shared `group-utils.js`. |
| **Cross-duty validation** | Server-side enforcement of business rules: no same-date+shift duplicates across modules; escort duty exclusivity during deployment period. |
| **Payroll summary** | On Employees page, add typeahead employee lookup + month picker → show computed net payment panel with per-module breakdown + overtime. |
| **Activity logging** | Server-side audit trail for all CUD operations + VALIDATION_REJECTED events. Future admin viewer page. |

**Non-goals (explicit):**
- No changes to form UI layout (add/edit/delete modals stay as-is).
- No changes to authentication flow.
- No schema-breaking migrations (additive columns only).
- Frontend pre-validation of conflicts is optional; backend is authoritative.

---

---

## 2. Hard Business Rules (Enforcement Requirements)

These rules are **MUST-enforce** at the backend (Apps Script). Frontend may pre-check optionally.

### Rule 1: One Shift = One Working Day
Each shift (Day or Night) in a calendar day counts as **one working day**. An employee may work both Day+Night shifts on the same date (= 2 working days) but not the same shift twice.

### Rule 2: No Same-Date + Same-Shift Duplicate Across Modules
If employee has a Guard Duty record for `2026-02-20 / Day shift`, they **cannot** also have a Day Labor or another Guard Duty record for that same date+shift. Cross-module collision must be rejected.

### Rule 3: Escort Duty Exclusivity
If an employee is deployed in Escort Duty from `startDate` to `endDate`, then **any Guard Duty or Day Labor record overlapping that date range must be rejected** (regardless of shift). The escort is deemed to fully occupy the employee for the entire period.

After escort duty ends (record has an `endDate` and date has passed), employee may work other duties again.

### Rule 4: Escort Working Days Calculation
- Each calendar date in the escort period [startDate, endDate] = 1 working day maximum.
- Even if the escort record has `startShift`/`endShift`, the per-day count is always 1 (not 0.5 per shift).
- Escort has `startShift` and `endShift` fields in the schema, but these represent the shift at deployment start/end, NOT per-day shifts. **Treat escort as fully occupying all shifts during its range.**
- **Escort endDate inclusivity**: see [Clarifying Question #7](#15-clarifying-questions-must-answer-before-coding).

### Rule 5: Day Labor Working Day + Overtime
- A standard Day Labor working day = 9 hours.
- Overtime = max(0, hoursWorked - 9) per record.
- Day Labor hours are stored in `hoursWorked` (numeric field). No start/end time fields exist.
- Same-date + same-shift duplicates are not allowed (per Rule 2).
- **Note**: Day Labor schema has no `shift` field. See [Clarifying Question #8](#15-clarifying-questions-must-answer-before-coding) on how to determine shift for conflict checking.

### Rule 6: Data Integrity
- Validation runs **server-side** in each add/update handler.
- Invalid submissions are rejected with clear error messages.
- Existing (historic) invalid data is not retroactively cleaned; new entries are blocked only.

---

## 3. Data Requirements & Confirmed Schemas

### 3.1 Guard Duty Sheet — `guardDuty`
| Column | Type | Notes |
|--------|------|-------|
| `id` | string | PK, format `GD-{timestamp}` |
| `date` | string (YYYY-MM-DD) | Filtered in current UI |
| `employeeId` | string | |
| `employeeName` | string | |
| `clientId` | string | **Group Level 1 key** |
| `clientName` | string | **Group Level 1 display** |
| `shift` | string | `"Day"` or `"Night"` |
| `status` | string | `Present` / `Absent` / `Late` |
| `checkIn` | string | |
| `checkOut` | string | |
| `notes` | string | **Group Level 2 = "location"** |

> Confirmed: column is `notes` (NOT `remarks`). The sheet header row created by `setupDatabase()` uses `notes`.

### 3.2 Escort Duty Sheet — `escortDuty`
| Column | Type | Notes |
|--------|------|-------|
| `id` | string | PK |
| `employeeId` | string | |
| `employeeName` | string | |
| `clientId` | string | **Group Level 1 key** |
| `clientName` | string | **Group Level 1 display** |
| `vesselName` | string | **Group Level 2 key & display** |
| `lighterName` | string | |
| `startDate` | string (YYYY-MM-DD) | |
| `endDate` | string (YYYY-MM-DD) | nullable (ongoing) |
| `startShift` | string | |
| `endShift` | string | |
| `releasePoint` | string | |
| `totalDays` | number | |
| `conveyance` | number | Per-escort conveyance (NOT employee monthly conveyance) |
| `status` | string | Active / Inactive |
| `notes` | string | |

### 3.3 Day Labor Sheet — `dayLabor`
| Column | Type | Notes |
|--------|------|-------|
| `id` | string | PK |
| `date` | string (YYYY-MM-DD) | Filtered in current UI |
| `employeeId` | string | |
| `employeeName` | string | |
| `clientId` | string | **Group Level 1 key** |
| `clientName` | string | **Group Level 1 display** |
| `hoursWorked` | number | |
| `rate` | number | |
| `amount` | number | |
| `notes` | string | |

> **Day Labor has NO dedicated location/site field.** Only `clientId`/`clientName` and `notes`. See [Clarifying Question #2](#15-clarifying-questions) for grouping proposal.

### 3.4 Employees Sheet — `employees`
| Column | Type | Notes |
|--------|------|-------|
| `id` | string | PK |
| `name` | string | |
| `phone` | string | |
| `nid` | string | National ID |
| `role` | string | Security Guard, Escort, etc. |
| `salary` | number | **Monthly salary — field name is `salary`** |
| `deployedAt` | string | Current deployment location |
| `joinDate` | string | |
| `guardianName` | string | |
| `guardianPhone` | string | |
| `address` | string | |
| `status` | string | Active / Inactive |

> **Notable**: Column is `salary` (not `monthlySalary`). There is **NO `conveyance` column** on the Employees sheet. Conveyance exists only per-escort-record on the Escort Duty sheet. See [Clarifying Question #3](#15-clarifying-questions).

### 3.5 Loan/Advance Sheet — `loanAdvance`
| Column | Type | Notes |
|--------|------|-------|
| `id` | string | PK |
| `employeeId` | string | |
| `employeeName` | string | |
| `type` | string | Loan / Advance |
| `amount` | number | |
| `issueDate` | string (YYYY-MM-DD) | |
| `paymentMethod` | string | |
| `remarks` | string | |
| `repaymentType` | string | |
| `monthlyDeduct` | number | |
| `status` | string | Active / Paid / ... |
| `createdAt` | string | |

> Salary generation currently processes loans with status = `'active'` (case-insensitive). See [Clarifying Question #4](#15-clarifying-questions).

### 3.6 Salary Ledger Sheet — `salaryLedger`
| Column | Type | Notes |
|--------|------|-------|
| `id` | string | PK |
| `employeeId` | string | |
| `employeeName` | string | |
| `sourceModule` | string | Guard / DayLabor / Escort / LoanAdvance |
| `sourceId` | string | FK to source record |
| `date` | string | |
| `shiftOrHours` | string | |
| `earnedAmount` | number | |
| `deductedAmount` | number | |
| `netChange` | number | |
| `runningBalance` | number | |
| `month` | string (YYYY-MM) | |
| `createdAt` | string | |

---

## 4. Feature 1: Grouped List Views

### 4.1 Guard Duty — Grouped by Client → Location (notes)

#### UX Behavior
| Aspect | Decision |
|--------|----------|
| **Level 1 header** | Client name (from `clientName`; fallback to `clientId`; fallback "Unknown Client") — sorted **alphabetically** |
| **Level 2 header** | Location (from `notes` field; empty/null → "General" group) — sorted **alphabetically** within client |
| **Records under L2** | Sorted by `employeeName` ASC then `shift` ASC |
| **Collapse/expand** | Both levels collapsible. **Default: expanded** (user typically reviews all for a single date). Toggle icon ▸/▾ on headers. |
| **Record count badges** | L1 header: `(N records · D day / N night · P present / A absent)` L2 header: `(N records)` |
| **Metric cards** | **Unchanged** — the 6 summary cards (Total, Day, Night, Present, Absent, Late) still compute from the full `dutyRecords` array for the selected date, **not** per group. |
| **Pagination** | **Remove global pagination**; use collapsible groups instead. Justification: Guard duty is per-date, typical volume is 10–50 records — collapsible groups handle this well without pagination complexity. If a single date exceeds ~200 records, add a "Show first N / Show all" toggle per client group (future enhancement). |
| **Search/filter** | Existing date picker remains. Add an optional client filter dropdown (populated from distinct `clientName` values in current data) that scrolls-to / isolates a single client group. |

#### DOM Structure (planned)
```
<div id="dutyGroupedContainer">
  <!-- Repeats per client -->
  <div class="group-client" data-client-id="C001">
    <div class="group-header-l1" onclick="toggleGroup(this)">
      ▾ <strong>ABC Shipping Co.</strong>
      <span class="badge">12 records · 8 day / 4 night · 10 present / 1 absent / 1 late</span>
    </div>
    <div class="group-body-l1">
      <!-- Repeats per location -->
      <div class="group-location" data-location="Berth 5">
        <div class="group-header-l2" onclick="toggleGroup(this)">
          ▾ Berth 5 <span class="badge">4 records</span>
        </div>
        <div class="group-body-l2">
          <table> ... standard rows ... </table>
        </div>
      </div>
      <!-- /location -->
    </div>
  </div>
  <!-- /client -->
</div>
```

#### Frontend Changes — `js/guard-duty.js`
| Change | Detail |
|--------|--------|
| New function: `renderGroupedDutyTable(records)` | Replaces `renderPaginatedDutyTable()` call path. Groups data using shared `groupBy()` helper. |
| Remove: pagination state/calls | Remove `dutyPaginationState`, `dutyFilteredData`, `renderPaginatedDutyTable()`. Keep `dutyRecords` as single source of truth. |
| Modify: `renderDutyTable(data)` | Calls `renderGroupedDutyTable(data)` instead of setting `dutyFilteredData` and paginating. |
| Modify: `updateDutySummary(data)` | No change needed — already computes from full `data` array. |
| Add: collapse/expand toggling | `toggleGroup(headerEl)` toggles `.group-body` sibling visibility. |
| Add: optional client filter | Small `<select>` or search input above table — filters to show only one client group. |

#### Backend Changes
**None** — `handleGetGuardDuty` already returns all records for a given date. Grouping is purely frontend.

---

### 4.2 Escort Duty — Grouped by Client → Vessel Name

#### UX Behavior
| Aspect | Decision |
|--------|----------|
| **Level 1 header** | Client name (from `clientName`; fallback `clientId`; fallback "Unknown Client") — sorted **alphabetically** |
| **Level 2 header** | Vessel name (from `vesselName`; empty → "No Vessel" group) — sorted **alphabetically** |
| **Records under L2** | Sorted by `startDate` DESC (most recent first) |
| **Collapse/expand** | Both levels collapsible. **Default: expanded**. |
| **Record count badges** | L1: `(N records · D total days · A active / O ongoing)` L2: `(N records · D total days)` |
| **Metric cards** | **5 existing cards unchanged** — compute from full `escortRecords` array. |
| **Pagination** | **Remove global pagination**. Escort duty date-range queries typically return moderate volume. Same "Show first N" safety valve. |
| **Search/filter** | Date range picker stays. Optional: add vessel name text filter or client dropdown. |

#### Frontend Changes — `js/escort-duty.js`
| Change | Detail |
|--------|--------|
| New: `renderGroupedEscortTable(records)` | Two-level grouping by `clientName` → `vesselName`. |
| Remove: `escortPaginationState`, `escortFilteredData`, `renderPaginatedEscortTable()`. |
| Modify: `renderEscortTable(data)` → calls grouped renderer. |
| Existing: `updateEscortSummary(data)` — **no change**. |

#### Backend Changes
**None.**

---

### 4.3 Day Labor — Grouped by Client → (TBD: notes or single-level)

#### Schema Analysis
Day Labor has: `clientId`, `clientName`, `notes`. There is **no** dedicated location/site/workType column.

#### **Proposal** (requires confirmation)
| Option | Grouping | Pro | Con |
|--------|----------|-----|-----|
| **A (recommended)** | Client → `notes` (treat notes as site/description) | Consistent with guard-duty pattern; no schema change | `notes` may contain free-text, inconsistent values |
| **B** | Client only (single level) | Simple; no ambiguous field | Less detail |
| **C** | Add a new `site` column to dayLabor schema | Clean dedicated field | Requires migration; existing records have no value |

**Default recommendation**: **Option A** — group by Client → notes (with "General" fallback for blank). If notes content is too inconsistent, fall back to Option B. See [Clarifying Question #2](#15-clarifying-questions-must-answer-before-coding).

#### UX Behavior (assuming Option A)
| Aspect | Decision |
|--------|----------|
| **Level 1** | Client name — alphabetical |
| **Level 2** | notes value — alphabetical (blank → "General") |
| **Records** | Sorted by `employeeName` ASC |
| **Metrics** | 3 existing cards (Total Records, Total Hours, Total Amount) — unchanged |
| **Pagination** | Remove. Day labor is per-date, low volume. |

#### Frontend Changes — `js/day-labor.js`
Same pattern as guard-duty: `renderGroupedLaborTable(records)`, remove pagination state.

#### Backend Changes
**None** (unless Option C is chosen → requires `migrateDatabase()` update to add `site` column).

---

## 5. Cross-Duty Conflict Validation

### 5.1 Overview

Before any duty record is created or updated, the backend **must** verify that the employee is not already assigned to a conflicting duty on the same date/shift. This prevents double-booking and ensures data integrity for payroll.

### 5.2 Validation Logic — `validateEmployeeDutyConflict()`

New utility function in `Utilities.gs` (or a new `Validation.gs` file):

```
function validateEmployeeDutyConflict(employeeId, date, shift, excludeRecordId) {
  // Returns { valid: boolean, conflicts: Array<{module, id, date, shift, detail}> }
  
  // Step 1: Check Escort Duty overlap
  //   - Load all escort records for this employee
  //   - If any escort has startDate <= date AND (endDate >= date OR endDate is empty)
  //     → CONFLICT: employee is on escort duty for that period
  //   - Escort blocks ALL shifts on overlapping dates
  
  // Step 2: Check Guard Duty same-date+same-shift
  //   - Load guard records for employee on that date
  //   - If any record with same shift exists (and id ≠ excludeRecordId)
  //     → CONFLICT: duplicate guard duty shift
  
  // Step 3: Check Day Labor same-date
  //   - Day Labor has no shift field — see Clarifying Question #8
  //   - If a day labor record exists for same date (and id ≠ excludeRecordId)
  //     → CONFLICT: day labor already recorded
  //   - NOTE: Depends on Q8 answer whether this blocks same-shift or full-day

  return { valid: true/false, conflicts: [...] };
}
```

### 5.3 Where Validation Is Enforced

| Handler | File | Enforcement |
|---------|------|-------------|
| `handleAddGuardDuty` | `GuardDuty.gs` | Call `validateEmployeeDutyConflict(employeeId, date, shift)` BEFORE `addRecord()`. If invalid → return error + log `VALIDATION_REJECTED`. |
| `handleAddDayLabor` | `DayLabor.gs` | Call `validateEmployeeDutyConflict(employeeId, date, null)` BEFORE `addRecord()`. |
| `handleAddEscortDuty` | `EscortDuty.gs` | For each date in [startDate, endDate] range, check for conflicts. If any → reject. |
| `handleUpdateEscortDuty` | `EscortDuty.gs` | Same as add, but pass `excludeRecordId` to skip self. |

### 5.4 Error Response Format

```json
{
  "success": false,
  "error": "Duty conflict: Mohammad Ali is already assigned to Escort Duty (ED-1740000) from 2026-02-20 to 2026-02-25. Cannot add Guard Duty on 2026-02-22.",
  "conflicts": [
    {
      "module": "EscortDuty",
      "id": "ED-1740000",
      "date": "2026-02-20 to 2026-02-25",
      "detail": "Active escort deployment"
    }
  ]
}
```

### 5.5 Activity Logging for Rejected Validations

When a conflict is detected and the operation is rejected:
```javascript
logActivity(sessionUser, 'addGuardDuty', 'GuardDuty', '',
  'VALIDATION_REJECTED: Conflict for ' + employeeName + ' on ' + date + ' - ' + conflictDetail,
  false, 'Duty conflict detected');
```

The `VALIDATION_REJECTED` prefix in the summary field allows filtering these events in the activity log viewer.

### 5.6 Escort Overlap Algorithm

For escort duty, the overlap check is more complex because it spans a date range:

```
function hasEscortOverlap(employeeId, startDate, endDate, excludeRecordId) {
  // Load all escort records for employee
  // For each escort record (excluding excludeRecordId):
  //   if escortRecord.endDate is empty → treat as ongoing (endDate = today or far future)
  //   if ranges overlap: max(start1, start2) <= min(end1, end2) → CONFLICT
  // Return list of overlapping escort records
}
```

### 5.7 Frontend Pre-Check (Optional Enhancement)

Before submitting a new duty form, the frontend can call a lightweight `checkDutyConflict` action to warn the user immediately (non-blocking — the backend remains authoritative). This is a Phase 2+ enhancement.

---

## 6. Feature 2: Employee Payroll Summary

### 6.1 UX Behavior — `employees.html`

#### New UI Components
1. **Payroll Summary Section** — new section below (or beside) the employee table:
   - **Employee typeahead input** — reuses `employee-lookup.js` pattern (`initEmployeeLookup`).
   - **Month picker** — `<input type="month">` defaulting to current month (`YYYY-MM`).
   - **"Calculate" button** — fetches payroll summary from backend.
   - **Result panel** — card/table showing breakdown:

```
┌──────────────────────────────────────────────────────┐
│  Payroll Summary: Mohammad Ali (EMP-001)             │
│  Month: 2026-02                                      │
├──────────────────────────────────────────────────────┤
│  Monthly Salary (from profile)        ৳ 15,000       │
│  Total Days in Month                  28             │
│  ── Guard Duty ──                                    │
│  Working Days (Present+Late shifts)   22             │
│  Pro-rated Salary (15000/28 × 22)     ৳ 11,786       │
│  ── Escort Duty ──                                   │
│  Escort Calendar Days                 3              │
│  Escort Earnings (3 × dailyRate)      ৳ 1,607        │
│  Escort Conveyance                    ৳ 500          │
│  ── Day Labor ──                                     │
│  Day Labor Records                    2              │
│  Standard Hours                       18             │
│  Overtime Hours                       3              │
│  Day Labor Earnings                   ৳ 750          │
│  ──────────────────────────────────────              │
│  Gross Earnings                       ৳ 14,643       │
│  Loan/Advance Deductions              ৳ -2,000       │
│  ──────────────────────────────────────              │
│  Net Payment                          ৳ 12,643       │
└──────────────────────────────────────────────────────┘
```

### 6.2 Computation Formula (Updated with Overtime & Conflict-Aware Rules)

```
# ─── Guard Duty Working Days ───
guardWorkingDays = count of Guard Duty records where
                   employeeId matches AND
                   date falls in selected month AND
                   status IN ('Present', 'Late')
# NOTE: Each record = 1 shift = 1 working day (per Rule 1)
# An employee with Day+Night on same date = 2 working days

# ─── Escort Duty Days ───
escortDays       = For each escort record where employeeId matches AND
                   date range overlaps selected month AND status = 'Active':
                   count calendar dates within [startDate, endDate] ∩ [monthStart, monthEnd]
                   (Each calendar date = 1 working day, per Rule 4)
# If endDate is null (ongoing), use last day of selected month as endDate
# See Clarifying Question #7: is endDate inclusive?

escortConveyance = sum of conveyance from same escort records
                   (pro-rated if escort partially overlaps the month — see Q7)

# ─── Day Labor ───
dayLaborHours    = sum of hoursWorked from Day Labor where
                   employeeId matches AND date falls in selected month
dayLaborStdDays  = sum of min(hoursWorked, 9) / 9 for each day labor record
                   (i.e., standard days equivalent)
dayLaborOvertime = sum of max(0, hoursWorked - 9) for each day labor record
                   (overtime hours beyond 9-hour standard, per Rule 5)
dayLaborAmount   = sum of amount from same records (hoursWorked × rate, already computed)

# ─── Salary Computation ───
dailyRate        = employee.salary / daysInMonth
proratedSalary   = dailyRate × guardWorkingDays
escortEarnings   = dailyRate × escortDays + escortConveyance
# Day labor earnings use their own rate (not dailyRate), already in `amount`

grossEarnings    = proratedSalary + escortEarnings + dayLaborAmount

# ─── Deductions ───
loanDeductions   = sum of monthlyDeduct from Loan/Advance where
                   employeeId matches AND
                   status = 'Active' (case-insensitive) AND
                   issueDate <= last day of selected month
                   (see Clarifying Question #4)

netPayment       = grossEarnings - loanDeductions
```

> **Conflict awareness**: The payroll summary does NOT re-validate conflicts. It reports what's in the data. If historic conflicts exist (before validation was added), they will show in the summary as-is. See [Clarifying Question #10](#15-clarifying-questions) on how to handle this.

### 6.3 Data Sources
| Data Point | Source Sheet | Column(s) | Filter |
|------------|-------------|-----------|--------|
| Monthly salary | `employees` | `salary` | `id = employeeId` |
| Guard working days | `guardDuty` | `date`, `status` | `employeeId`, month match, status=Present/Late |
| Escort days + conveyance | `escortDuty` | `totalDays`, `conveyance`, `startDate` | `employeeId`, month match, completed+Active |
| Day labor earnings | `dayLabor` | `amount`, `date` | `employeeId`, month match |
| Loan deductions | `loanAdvance` | `amount`, `issueDate`, `status` | `employeeId`, status=Active |

### 6.4 Backend Changes — `Salary.gs` (new action)

#### New Action: `getEmployeePayrollSummary`

```
Request:
  action: 'getEmployeePayrollSummary'
  payload: { employeeId: string, month: string (YYYY-MM) }

Response:
  {
    success: true,
    action: 'getEmployeePayrollSummary',
    data: {
      employeeId, employeeName, month,
      monthlySalary, dailyRate, daysInMonth,
      // Guard Duty
      guardWorkingDays,
      proratedSalary,
      // Escort Duty
      escortDays,
      escortEarnings,
      escortConveyance,
      escortDetails: [{ id, clientName, vesselName, startDate, endDate, daysInMonth, conveyance }],
      // Day Labor
      dayLaborRecords,
      dayLaborStdHours,
      dayLaborOvertimeHours,
      dayLaborAmount,
      // Totals
      grossEarnings,
      loanDeductions,
      loanDetails: [{ id, type, amount, monthlyDeduct, issueDate }],
      netPayment
    }
  }
```

**Why server-side?** Computing across 4 sheets is expensive on the client (4 separate API calls). A single backend action reads sheets in one process, reducing latency from ~4s to ~1s.

#### Code.gs Router Addition
```
case 'getEmployeePayrollSummary':
  return handleGetEmployeePayrollSummary(payload, sessionUser);
```

#### ACTION_PERMISSIONS Addition
```
getEmployeePayrollSummary: { module: 'Salary', permission: 'canView' }
```

#### Validation
- `employeeId` required, must exist in Employees sheet.
- `month` required, must match `YYYY-MM` pattern.
- Month must not be in the future.

### 6.5 Frontend Changes — `employees.html` + `js/employees.js`

| Change | Detail |
|--------|--------|
| HTML: new section `#payrollSummarySection` | Employee typeahead, month picker, Calculate button, result panel (`#payrollResult`). |
| JS: `initPayrollLookup()` | Wire `initEmployeeLookup()` for the payroll input. Include `employee-lookup.js` in employees.html (currently not loaded). |
| JS: `calculatePayrollSummary()` | Read selected employee + month → `request('getEmployeePayrollSummary', {...})` → render result panel. |
| JS: `renderPayrollResult(data)` | Build formatted card with breakdown rows. Use `Intl.NumberFormat` for currency. |
| JS: loading/error states | Show spinner during calculation; show toast on error. |

---

## 7. Feature 3: Activity Logging (Audit Trail)

### 7.1 New Sheet: `activityLogs`

#### Columns
| Column | Type | Description |
|--------|------|-------------|
| `id` | string | `ALOG-{timestamp}` |
| `timestamp` | string (ISO) | Server-side `new Date().toISOString()` |
| `userLogin` | string | `sessionUser.userId` (username) |
| `role` | string | `sessionUser.role` |
| `action` | string | The action name (e.g. `addGuardDuty`, `deleteEmployee`) |
| `entityType` | string | Module name (e.g. `GuardDuty`, `Employees`, `Clients`) |
| `entityId` | string | The record ID affected |
| `summary` | string | Human-readable summary, max 200 chars (e.g. "Added guard duty for Mohammad Ali at ABC Shipping on 2026-02-25") |
| `page` | string | Optional — could be inferred from action, or passed from frontend |
| `success` | boolean | `true` / `false` |
| `errorMessage` | string | Error message if `success=false`, empty otherwise |
| `ipAddress` | string | Not available in GAS — will store `'N/A'` |

#### Privacy Rules
- **NO full payload stored** — only `entityId` + computed `summary`.
- Summary includes: action verb, entity type, employee/client name (already public within the app), date if applicable.
- No passwords, tokens, or PII beyond names that are already visible to the user.

### 7.2 Where Logging Happens

**Inside backend handlers (authoritative), AFTER the operation succeeds/fails.**

Pattern:
```javascript
function handleAddGuardDuty(payload, sessionUser) {
  // ... existing logic ...
  try {
    // ... add record ...
    logActivity(sessionUser, 'addGuardDuty', 'GuardDuty', recordData.id,
      'Added guard duty: ' + recordData.employeeName + ' at ' + recordData.clientName);
    return { success: true, ... };
  } catch (error) {
    logActivity(sessionUser, 'addGuardDuty', 'GuardDuty', payload.id || '',
      'Failed: ' + error.message, false, error.message);
    return sanitizedError(...);
  }
}
```

#### New Utility Function — `Utilities.gs`
```javascript
function logActivity(sessionUser, action, entityType, entityId, summary, success, errorMessage) {
  // Defensive: never let logging failure break the main operation
  try {
    addRecord(SHEETS.ACTIVITY_LOGS, {
      id: generateId('ALOG'),
      timestamp: new Date().toISOString(),
      userLogin: sessionUser ? sessionUser.userId : 'system',
      role: sessionUser ? sessionUser.role : 'system',
      action: action,
      entityType: entityType,
      entityId: String(entityId || ''),
      summary: String(summary || '').substring(0, 200),
      page: '',
      success: success !== false,
      errorMessage: String(errorMessage || ''),
      ipAddress: 'N/A'
    });
  } catch (e) {
    Logger.log('Activity logging failed: ' + e.toString());
  }
}
```

### 7.3 Modules to Instrument (by phase)

| Phase | Module | Actions to Log |
|-------|--------|---------------|
| Phase 1 | Guard Duty | `addGuardDuty`, `deleteGuardDuty` |
| Phase 1 | Cross-Duty Validation | `VALIDATION_REJECTED` — logged when a duty creation is blocked by conflict detection (success=false, summary prefixed with "VALIDATION_REJECTED:") |
| Phase 2 | Escort Duty | `addEscortDuty`, `updateEscortDuty`, `deleteEscortDuty` |
| Phase 2 | Day Labor | `addDayLabor`, `deleteDayLabor` |
| Phase 2 | Employees | `addOrUpdateEmployee`, `deleteEmployee` |
| Phase 3 | Clients | `addOrUpdateClient`, `deleteClient` |
| Phase 3 | Loan/Advance | `addLoanAdvance`, `deleteLoanAdvance` |
| Phase 3 | Invoices | `generateInvoice`, `finalizeInvoice`, `markInvoicePaid`, `deleteInvoice` |
| Phase 3 | Salary | `generateSalary`, `getEmployeePayrollSummary` |
| Phase 3 | User Management | `addUser`, `updateUser`, `resetPassword`, `deleteUser` |
| Phase 3 | Login/Logout | `login` (success/fail), `logout` |

> **VALIDATION_REJECTED events**: When `validateEmployeeDutyConflict()` rejects a submission, the handler logs with `success: false` and the summary begins with `VALIDATION_REJECTED:`. This allows admins to filter the activity log for rejected validations to detect systematic issues or training needs.

### 7.4 Retention & Archival
- **Default**: Keep 90 days of logs in active sheet.
- **Archival**: Monthly scheduled trigger (GAS time-based trigger) moves rows older than 90 days to an `activityLogsArchive` sheet or deletes them.
- **Export**: Phase 3 admin page will offer CSV download.

### 7.5 Admin Activity Logs Page (Phase 3)

New page: `activity-logs.html`
- **Filters**: Date range, user, action type, entity type, success/fail.
- **Table**: Timestamp, User, Action, Entity, Summary, Status.
- **Export**: CSV download button.
- **Permission**: Admin only (`ActivityLogs/canView`).

New backend actions:
- `getActivityLogs` — paginated query with filters.
- New `BACKEND_PERMISSIONS` entry for `ActivityLogs` module.

---

## 8. Feature 4: Reusable Grouped Rendering Framework

### 8.1 New File: `js/group-utils.js`

Shared utilities loaded on Guard Duty, Escort Duty, Day Labor pages.

#### Functions

```javascript
/**
 * Group records into ordered groups.
 * @param {Array} records
 * @param {Function} keyFn - (record) => groupKey
 * @param {Function} [sortFn] - optional comparator for group keys
 * @returns {Array<{key: string, records: Array}>}
 */
function groupBy(records, keyFn, sortFn) { ... }

/**
 * Two-level grouping.
 * @param {Array} records
 * @param {Function} l1KeyFn - Level 1 key extractor
 * @param {Function} l2KeyFn - Level 2 key extractor
 * @param {Object} [options] - { l1Sort, l2Sort, recordSort }
 * @returns {Array<{key, displayName, records: Array<{key, displayName, records}>}>}
 */
function groupByTwoLevel(records, l1KeyFn, l2KeyFn, options) { ... }

/**
 * Normalize empty/null/undefined group keys to a fallback.
 * @param {string} key
 * @param {string} [fallback='Unknown']
 * @returns {string}
 */
function normalizeGroupKey(key, fallback) { ... }

/**
 * Render a group header bar (Level 1 or Level 2).
 * @param {Object} options - { level, displayName, badgeHtml, recordCount, isExpanded }
 * @returns {string} HTML string
 */
function renderGroupHeader(options) { ... }

/**
 * Toggle group collapse/expand.
 * @param {HTMLElement} headerEl
 */
function toggleGroup(headerEl) { ... }

/**
 * Collapse all / Expand all groups in a container.
 * @param {string} containerId
 * @param {boolean} collapse
 */
function toggleAllGroups(containerId, collapse) { ... }
```

### 8.2 Collapse/Expand State
- Stored in **memory** (module-scoped object `groupCollapseState = {}`).
- Key = `clientId + '|' + locationKey`.
- On data refresh, state persists within the same page session.
- **Not** persisted to localStorage (groups change per date, so persistence has little value).

### 8.3 CSS
- Add group header styles inline in `group-utils.js` IIFE (same pattern as `pagination-utils.js`).
- L1 header: blue-gray background, bold, left-aligned, with expand/collapse icon.
- L2 header: lighter background, indented, with icon.
- Transition: `max-height` CSS transition for smooth collapse.

### 8.4 Pagination Decision — JUSTIFIED

**Decision: REMOVE global pagination, use collapsible groups.**

| Factor | Analysis |
|--------|----------|
| **Volume per page load** | Guard/Day Labor: single date → typically 10-50 records. Escort: date range → 20-100 records. Well within DOM performance limits. |
| **UX benefit** | Users need to see all records for a date at once (for verification). Collapsing client groups provides the same "focus" benefit as pagination. |
| **Complexity** | Per-group pagination requires tracking N pagination states simultaneously — significantly more complex with minimal benefit at these volumes. |
| **Safety valve** | If a date has >200 records, add a "Show first 50 / Show all" toggle per L1 group (deferred to future iteration). |

---

## 9. Performance Considerations

| Concern | Mitigation |
|---------|-----------|
| **DOM size** | Typical max ~200 rows across all groups. No performance issue. For safety, if >500 records, show warning + "Load all" confirmation. |
| **Grouping computation** | O(n) grouping + O(n log n) sort. Negligible for <1000 records. |
| **Backend calls** | No change — same number of API calls. Payroll summary is 1 call (consolidated backend). |
| **Activity logging overhead** | `logActivity()` adds 1 `addRecord()` call per CUD operation (~50ms). Acceptable. Wrapped in try-catch to never break main operations. |
| **Sheet size for activity logs** | At ~100 operations/day = ~3000/month. 90-day retention = ~9000 rows. Well within Sheets performance limits (50K+). |
| **Employee payroll computation** | Reads 4 sheets server-side in one execution. GAS cold start may add latency. Mitigate with loading spinner + timeout handling on frontend. |

---

## 10. Security & Permissions

| Area | Approach |
|------|----------|
| **Grouped views** | No permission changes. Uses existing `canView` permissions for each module. Grouping is client-side presentation only. |
| **Payroll summary** | New action `getEmployeePayrollSummary` → requires `Salary/canView`. Already restricted to Admin + Supervisor in `BACKEND_PERMISSIONS`. |
| **Activity logs** | `logActivity()` runs server-side with no frontend exposure. Phase 3 viewer requires new `ActivityLogs/canView` permission (Admin only). |
| **Audit log data** | No sensitive data logged. Summaries contain names already visible to the user. No tokens/passwords. |
| **XSS** | All group headers/names rendered via `escapeHtml()`. No raw HTML injection from sheet data. |

---

## 11. Migration Needs

| Change | Type | Risk |
|--------|------|------|
| Add `activityLogs` sheet | **New sheet** via `setupDatabase()` update + `migrateDatabase()` additive migration | Zero risk — additive only |
| Add `ACTIVITY_LOGS` to `SHEETS` constant | Code change in `Code.gs` | Backward compatible |
| Add `ActivityLogs` module to `BACKEND_PERMISSIONS` (Phase 3) | Code change in `Code.gs` | Backward compatible — existing roles unaffected |
| (Optional) Add `site` column to `dayLabor` sheet (if Option C chosen) | Additive column via `migrateDatabase()` | Zero risk — existing data untouched |
| No existing schema changes | — | — |

### Migration Script Addition (`Utilities.gs → migrateDatabase()`)
Add to existing `v3Schema` object:
```javascript
[SHEETS.ACTIVITY_LOGS]: ['id', 'timestamp', 'userLogin', 'role', 'action', 
  'entityType', 'entityId', 'summary', 'page', 'success', 'errorMessage', 'ipAddress']
```

And in `setupDatabase()`:
```javascript
createSheet(ss, SHEETS.ACTIVITY_LOGS, [...columns...]);
```

---

## 12. Test Plan

### 12.1 Grouped List Views

| Test | Steps | Expected |
|------|-------|----------|
| Guard Duty grouping | Load guard-duty page for a date with records from 3+ clients | Records grouped by client → notes(location), alphabetical order |
| Empty notes grouping | Add records with empty notes field | Grouped under "General" location |
| Collapse/expand L1 | Click client group header | Group body toggles visibility |
| Collapse/expand L2 | Click location group header | Location records toggle |
| Metric cards accuracy | Verify Total/Day/Night/Present/Absent/Late counts | Match full dataset (not per-group) |
| No records | Select a date with no records | Show empty state message |
| Single client | All records belong to one client | Single L1 group, no visual oddness |
| Escort grouping | Load escort page with multi-client, multi-vessel data | Grouped correctly by client → vessel |
| Day Labor grouping | Load day-labor page | Grouped by client → notes (or single-level per decision) |

### 12.2 Employee Payroll Summary

| Test | Steps | Expected |
|------|-------|----------|
| Lookup + calculate | Select employee via typeahead, pick month, click Calculate | Summary panel shows with all fields |
| No guard duty | Employee has no guard records for month | guardWorkingDays = 0, prorated = 0 |
| Escort conveyance | Employee has escort records with conveyance | Escort days + conveyance reflected |
| Loan deduction | Employee has active loan | Deducted from gross |
| Invalid employee | Type non-existent name | Toast error or no result |
| Future month | Select month in the future | Backend rejects with validation error |
| Permission | Viewer role attempts payroll summary | Reject (Salary/canView = false for Viewer) |

### 12.3 Activity Logging

| Test | Steps | Expected |
|------|-------|----------|
| Add guard duty | Add a guard duty record | New row in `activityLogs` sheet with correct details |
| Delete employee | Delete an employee | Log entry with action=deleteEmployee, success=true |
| Failed operation | Attempt to add record with missing required fields | Log entry with success=false, errorMessage populated |
| Logging doesn't break ops | Simulate sheet write error in logActivity (e.g., wrong sheet name) | Main operation still succeeds, error silently logged |
| Admin log viewer (Phase 3) | Navigate to activity-logs page, apply filters | Filtered results displayed correctly |

### 12.4 Cross-Duty Conflict Validation

| Test | Steps | Expected |
|------|-------|----------|
| Guard blocks duplicate shift | Add Guard Duty for employee A, date D, Day shift. Try to add another Guard Duty for same employee/date/shift. | Second add rejected with conflict error |
| Guard allows different shift | Add Guard Duty for employee A, date D, Day shift. Add Guard Duty for same employee/date, Night shift. | Both succeed (= 2 working days) |
| Escort blocks guard | Add Escort Duty for employee A, 2026-02-20 to 2026-02-25. Try to add Guard Duty for same employee on 2026-02-22. | Guard rejected — employee on escort |
| Escort blocks day labor | Same escort as above. Try to add Day Labor for same employee on 2026-02-23. | Day labor rejected |
| Escort allows after end | Same escort (ends 2026-02-25). Add Guard Duty for 2026-02-26. | Guard succeeds |
| Ongoing escort blocks | Add Escort Duty with no endDate. Try Guard Duty for any future date. | Rejected — ongoing escort |
| Day labor blocks guard | Add Day Labor for employee A, date D. Try Guard Duty same employee/date. | See Q8 — depends on shift handling for day labor |
| VALIDATION_REJECTED logged | Trigger any conflict rejection. | Activity log contains row with summary starting "VALIDATION_REJECTED:" |
| Escort overlap check | Add Escort A (Feb 20-25). Try Escort B for same employee (Feb 23-28). | Escort B rejected — overlapping escort |
| Update escort excludes self | Update Escort A's endDate. | Passes validation (excludes own record ID) |

### 12.5 Payroll Overtime

| Test | Steps | Expected |
|------|-------|----------|
| Day labor overtime | Employee has day labor record with hoursWorked=12 | Summary shows: stdHours=9, overtimeHours=3 |
| No overtime | Day labor with hoursWorked=7 | stdHours=7, overtimeHours=0 |
| Multiple day labor | 3 records: 9h, 12h, 6h | stdHours=24, overtimeHours=3, total amounts correct |
| Escort calendar days | Escort Feb 20-25 in Feb report | escortDays = 6 (inclusive) or 5 (exclusive — per Q7) |

---

## 13. Exact Code Change Map

### 13.1 Backend — Google Apps Script

| File | Function/Location | Change Type | Description |
|------|-------------------|-------------|-------------|
| `Code.gs` | `SHEETS` constant (~line 93) | **Add** | Add `ACTIVITY_LOGS: 'activityLogs'` |
| `Code.gs` | `ACTION_PERMISSIONS` (~line 184) | **Add** | Add `getEmployeePayrollSummary: { module: 'Salary', permission: 'canView' }` |
| `Code.gs` | `ACTION_PERMISSIONS` (~line 184) | **Add** | Add `validateEmployeeDutyConflict: { module: 'GuardDuty', permission: 'canCreate' }` (Phase 2 optional pre-check action) |
| `Code.gs` | `routeAction()` switch (~line 590) | **Add** | Add `case 'getEmployeePayrollSummary'` routing to `Salary.gs` |
| `Utilities.gs` | `setupDatabase()` (~line 1) | **Modify** | Add `createSheet()` call for `activityLogs` with 12 columns |
| `Utilities.gs` | `migrateDatabase()` (~line 105) | **Modify** | Add `activityLogs` to `v3Schema` |
| `Utilities.gs` | *New function* | **Add** | `logActivity(sessionUser, action, entityType, entityId, summary, success, errorMessage)` |
| `Utilities.gs` | *New function* | **Add** | `validateEmployeeDutyConflict(employeeId, date, shift, excludeRecordId)` |
| `Utilities.gs` | *New function* | **Add** | `hasEscortOverlap(employeeId, startDate, endDate, excludeRecordId)` |
| `GuardDuty.gs` | `handleAddGuardDuty()` (~line 50) | **Modify** | Add conflict validation call before `addRecord()`. Add `logActivity()` after success/failure. |
| `GuardDuty.gs` | `handleDeleteGuardDuty()` (~line 120) | **Modify** | Add `logActivity()` after success/failure. |
| `EscortDuty.gs` | `handleAddEscortDuty()` (~line 50) | **Modify** | Add escort overlap + conflict validation. Add `logActivity()`. |
| `EscortDuty.gs` | `handleUpdateEscortDuty()` (~line 120) | **Modify** | Add escort overlap validation (exclude self). Add `logActivity()`. |
| `EscortDuty.gs` | `handleDeleteEscortDuty()` (~line 180) | **Modify** | Add `logActivity()`. |
| `DayLabor.gs` | `handleAddDayLabor()` (~line 30) | **Modify** | Add conflict validation. Add `logActivity()`. |
| `DayLabor.gs` | `handleDeleteDayLabor()` (~line 90) | **Modify** | Add `logActivity()`. |
| `Salary.gs` | *New function* | **Add** | `handleGetEmployeePayrollSummary(payload, sessionUser)` — computes payroll across 4 sheets |
| `Employees.gs` | `handleAddOrUpdateEmployee()` | **Modify** (Phase 2) | Add `logActivity()`. |
| `Employees.gs` | `handleDeleteEmployee()` | **Modify** (Phase 2) | Add `logActivity()`. |

### 13.2 Frontend — JavaScript

| File | Function/Location | Change Type | Description |
|------|-------------------|-------------|-------------|
| `js/group-utils.js` | *Entire file* | **Create** | New shared utility: `groupBy()`, `groupByTwoLevel()`, `normalizeGroupKey()`, `renderGroupHeader()`, `toggleGroup()`, `toggleAllGroups()`, inline CSS injection |
| `js/guard-duty.js` | `renderDutyTable()` | **Modify** | Call `renderGroupedDutyTable()` instead of setting filtered data + paginating |
| `js/guard-duty.js` | *Remove* | **Remove** | `dutyPaginationState`, `dutyFilteredData`, `renderPaginatedDutyTable()` |
| `js/guard-duty.js` | *New function* | **Add** | `renderGroupedDutyTable(records)` — two-level grouping by client → notes |
| `js/escort-duty.js` | `renderEscortTable()` | **Modify** | Call `renderGroupedEscortTable()` instead of pagination |
| `js/escort-duty.js` | *Remove* | **Remove** | `escortPaginationState`, `escortFilteredData`, `renderPaginatedEscortTable()` |
| `js/escort-duty.js` | *New function* | **Add** | `renderGroupedEscortTable(records)` — two-level by client → vessel |
| `js/day-labor.js` | `renderLaborTable()` | **Modify** | Call `renderGroupedLaborTable()` instead of pagination |
| `js/day-labor.js` | *Remove* | **Remove** | `laborPaginationState`, `laborFilteredData`, `renderPaginatedLaborTable()` |
| `js/day-labor.js` | *New function* | **Add** | `renderGroupedLaborTable(records)` |
| `js/employees.js` | *New functions* | **Add** | `initPayrollLookup()`, `calculatePayrollSummary()`, `renderPayrollResult(data)` |

### 13.3 Frontend — HTML

| File | Location | Change Type | Description |
|------|----------|-------------|-------------|
| `guard-duty.html` | `<script>` tags | **Add** | Load `js/group-utils.js` before `js/guard-duty.js` |
| `guard-duty.html` | `#dutyTableBody` container | **Modify** | Replace `<table>` + pagination div with `<div id="dutyGroupedContainer">` |
| `escort-duty.html` | `<script>` tags | **Add** | Load `js/group-utils.js` |
| `escort-duty.html` | `#escortTableBody` container | **Modify** | Replace table + pagination with grouped container |
| `day-labor.html` | `<script>` tags | **Add** | Load `js/group-utils.js` |
| `day-labor.html` | `#laborTableBody` container | **Modify** | Replace table + pagination with grouped container |
| `employees.html` | `<script>` tags | **Add** | Load `js/employee-lookup.js` (currently not loaded) |
| `employees.html` | After employee table section | **Add** | New `#payrollSummarySection` with typeahead, month picker, Calculate button, result panel |

### 13.4 Phase 3 Files (Not in initial scope)

| File | Change Type | Description |
|------|-------------|-------------|
| `activity-logs.html` | **Create** | New admin page for viewing activity logs |
| `js/activity-logs.js` | **Create** | Frontend logic for log viewer with filters |
| `google-apps-script/ActivityLogs.gs` | **Create** | Backend handler for `getActivityLogs` with pagination/filters |
| `Code.gs` `BACKEND_PERMISSIONS` | **Modify** | Add `ActivityLogs` module permissions |

---

## 14. Phased Rollout

### Phase 1 — Core Grouping + Minimal Logging + Guard Duty Validation
**Estimated effort**: 4-5 days

| Step | Task |
|------|------|
| 1.1 | Create `js/group-utils.js` with `groupBy`, `groupByTwoLevel`, `normalizeGroupKey`, `renderGroupHeader`, `toggleGroup`, `toggleAllGroups`. |
| 1.2 | **Guard Duty grouping**: Refactor `guard-duty.js` — replace paginated render with grouped render. Update `guard-duty.html` to load `group-utils.js`. |
| 1.3 | Test guard duty grouping with real data. |
| 1.4 | Add `activityLogs` sheet to `setupDatabase()` + `migrateDatabase()` + `SHEETS` constant. |
| 1.5 | Create `logActivity()` utility in `Utilities.gs`. |
| 1.6 | Create `validateEmployeeDutyConflict()` and `hasEscortOverlap()` in `Utilities.gs`. |
| 1.7 | Instrument `handleAddGuardDuty` with conflict validation + activity logging. |
| 1.8 | Instrument `handleDeleteGuardDuty` with activity logging. |
| 1.9 | Test: conflict validation rejects duplicates; logging writes correct rows. |

### Phase 2 — Remaining Grouping + Payroll + Full Validation
**Estimated effort**: 5-6 days

| Step | Task |
|------|------|
| 2.1 | **Escort Duty grouping**: Refactor `escort-duty.js` with grouped render (client → vessel). |
| 2.2 | **Day Labor grouping**: Refactor `day-labor.js` (pending Clarifying Question #2 answer). |
| 2.3 | Instrument `handleAddEscortDuty` + `handleUpdateEscortDuty` with escort overlap + conflict validation + logging. |
| 2.4 | Instrument `handleAddDayLabor` with conflict validation + logging. |
| 2.5 | Instrument `handleDeleteEscortDuty`, `handleDeleteDayLabor` with logging. |
| 2.6 | **Payroll summary backend**: Add `handleGetEmployeePayrollSummary()` in `Salary.gs` (with overtime computation), add route + permission in `Code.gs`. |
| 2.7 | **Payroll summary frontend**: Add section to `employees.html`, add `employee-lookup.js` to page, implement `calculatePayrollSummary()` and `renderPayrollResult()` in `employees.js`. |
| 2.8 | Instrument Employees module with activity logging. |
| 2.9 | Test all grouped views + payroll summary + cross-duty validation for all 3 modules. |

### Phase 3 — Full Audit Coverage + Admin Viewer
**Estimated effort**: 3-4 days

| Step | Task |
|------|------|
| 3.1 | Instrument all remaining modules (Clients, Loans, Invoices, Salary, Users, Auth). |
| 3.2 | Create `activity-logs.html` page — Admin-only. |
| 3.3 | Add `getActivityLogs` backend action with pagination + filters. |
| 3.4 | Add `ActivityLogs` module to `BACKEND_PERMISSIONS` (Admin: canView+canDelete; others: none). |
| 3.5 | Add retention trigger — scheduled GAS trigger to archive/purge logs >90 days. |
| 3.6 | CSV export on admin page. |
| 3.7 | Full regression test. |

---

## 15. Clarifying Questions — RESOLVED

All questions answered. Decisions recorded below.

### Q1: Guard Duty location grouping field ✅ RESOLVED
> **Decision**: Use `notes` as the location grouping field. No schema change.

### Q2: Day Labor grouping field ✅ RESOLVED
> **Decision**: Option A — Group by Client → `notes` (blank → "General"). Matches guard-duty pattern.

### Q3: Employee conveyance for payroll ✅ RESOLVED
> **Decision**: Option A — Sum conveyance from Escort Duty records for the month.

### Q4: Loan/Advance deduction statuses ✅ RESOLVED
> **Decision**: `Active` only. Matches existing salary generator behavior.

### Q5: Working days source for prorated salary ✅ RESOLVED
> **Decision**: Option A — Guard Duty only (Present + Late = working day). Escort and Day Labor as separate additive line items.

### Q6: Default group collapse state ✅ RESOLVED
> **Decision**: Option A — All expanded by default.

### Q7: Escort endDate inclusivity ✅ RESOLVED
> **Decision**: Option A — Inclusive. `endDate` is the last working day. Calendar days = endDate - startDate + 1.

### Q8: Day Labor shift for conflict checking ✅ RESOLVED
> **Decision**: Option A — Day Labor blocks the ENTIRE day (both shifts). An employee with a day labor record cannot have any Guard Duty on that date.

### Q9: Guard Duty "Late" status in payroll ✅ RESOLVED
> **Decision**: Option A — "Late" counts as a working day. Employee showed up.

### Q10: Historic conflicting data ✅ RESOLVED
> **Decision**: Option A — Forward only. Leave existing records untouched. Only validate new submissions. Payroll reports historic data as-is.

---

*End of Implementation Plan — Rev 2 — All decisions finalized*
