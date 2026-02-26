# Al-Aqsa HRM Backend - Google Apps Script Deployment

## Overview

This folder contains the Google Apps Script backend that replaces the mock API with a real backend using:
- **Google Sheets** as the database
- **Google Drive** for file uploads
- **Google Apps Script** as the serverless backend

## Files

| File | Description |
|------|-------------|
| `Code.gs` | Main entry point - doPost/doGet handlers, action routing, configuration |
| `Utilities.gs` | Helper functions - database setup, CRUD operations, date/ID utilities |
| `Auth.gs` | Authentication - login, token validation, session management |
| `Employees.gs` | Employee management handlers |
| `Clients.gs` | Client management handlers |
| `GuardDuty.gs` | Guard duty tracking + Dashboard stats |
| `DayLabor.gs` | Day labor tracking handlers |
| `EscortDuty.gs` | Escort duty tracking handlers |
| `LoanAdvance.gs` | Loan/advance tracking handlers |
| `Salary.gs` | Salary ledger and salary generation |
| `Invoices.gs` | Invoice generation and management |
| `Files.gs` | File upload to Google Drive |
| `JobPosts.gs` | Job circular management (PUBLIC endpoints) |
| `JobApplications.gs` | Job application management (PUBLIC endpoints) |
| `UserManagement.gs` | User administration (Admin only) |

## Deployment Steps

### Step 1: Create Google Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. Click **New Project**
3. Name it: `Al-Aqsa-HRM-Backend`

### Step 2: Add Script Files

1. In the Apps Script editor, you'll see a default `Code.gs` file
2. Copy the contents of each `.gs` file from this folder into the project:
   - For `Code.gs`, replace the default content
   - For other files, click **+** next to Files → **Script** and name each file accordingly
3. Add all 15 files listed above

### Step 3: Setup Database

1. In the Apps Script editor, select **Code.gs**
2. In the function dropdown (next to **Run**), select `setupDatabase`
3. Click **Run**
4. **Authorize** the script when prompted (grant access to Spreadsheets and Drive)
5. Check the **Execution Log** (View → Execution Log) for output:
   ```
   SPREADSHEET_ID: "your-spreadsheet-id"
   DRIVE_FOLDER_ID: "your-folder-id"
   ```
6. Copy these IDs

### Step 4: Configure Script

1. Open `Code.gs`
2. Update the `CONFIG` object with the IDs from Step 3:
   ```javascript
   const CONFIG = {
     SPREADSHEET_ID: 'your-spreadsheet-id-here',
     DRIVE_FOLDER_ID: 'your-folder-id-here',
     DEFAULT_DAILY_RATE: 500
   };
   ```
3. **Save** the file (Ctrl+S)

### Step 5: Deploy as Web App

1. Click **Deploy** → **New deployment**
2. Click the gear icon ⚙️ next to **Type** → Select **Web app**
3. Configure:
   - **Description**: `Al-Aqsa HRM Backend v1`
   - **Execute as**: `Me (your-email@gmail.com)`
   - **Who has access**: `Anyone`
4. Click **Deploy**
5. **Authorize** if prompted
6. Copy the **Web App URL** (looks like: `https://script.google.com/macros/s/XXXXXX/exec`)

### Step 6: Update Frontend

1. Open `js/api.js` in your frontend project
2. Find the `BASE_URL` constant (around line 1)
3. Replace the mock URL with your deployed Web App URL:
   ```javascript
   const BASE_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
   ```
4. **Save** the file

### Step 7: Test

1. Open the frontend application
2. Login with default credentials:
   - **Username**: `admin`
   - **Password**: `admin123`
3. Test CRUD operations on Employees, Clients, etc.
4. Verify data appears in the Google Sheet

## Data Schema (Google Sheets)

The `setupDatabase()` function creates a spreadsheet with these sheets:

| Sheet | Columns |
|-------|---------|
| `users` | id, username, passwordHash, role, status, createdAt |
| `employees` | id, name, nid, phone, address, bank, joiningDate, contractType, dailyRate, status |
| `clients` | id, companyName, contactPerson, phone, email, address, status |
| `guardDuty` | id, date, employeeId, employeeName, clientId, clientName, shift, status, remarks |
| `escortDuty` | id, startDate, endDate, employeeId, employeeName, clientId, clientName, totalDays, conveyance, status, notes |
| `dayLabor` | id, date, employeeId, employeeName, clientId, clientName, hoursWorked, notes |
| `loanAdvance` | id, employeeId, employeeName, type, amount, issueDate, status, notes |
| `salaryLedger` | id, employeeId, employeeName, sourceModule, sourceId, date, shiftOrHours, earnedAmount, deductedAmount, netChange, runningBalance, month, createdAt |
| `processedEvents` | eventKey, processedAt |
| `invoices` | id, invoiceNumber, clientId, clientName, periodStart, periodEnd, totalEscortDays, escortAmount, totalGuardDays, guardAmount, totalLaborHours, laborAmount, subtotal, vatPercent, vatAmount, totalAmount, status, createdAt |
| `fileUploads` | id, module, recordId, fileName, fileType, fileSize, driveFileId, driveUrl, uploadedAt, uploadedBy |
| `jobPosts` | id, title, description, requirements, location, salary, status, openDate, closeDate, createdAt |
| `jobApplications` | id, jobId, applicantName, phone, email, experience, education, skills, resumeUrl, status, appliedAt, notes |
| `permissions` | role, module, canView, canAdd, canEdit, canDelete |

## Permission Model

| Role | Employees | Clients | GuardDuty | Salary | Invoices | UserMgmt |
|------|-----------|---------|-----------|--------|----------|----------|
| **Admin** | Full CRUD | Full CRUD | Full CRUD | Full CRUD | Full CRUD | Full CRUD |
| **Supervisor** | View/Add/Edit | View/Add/Edit | View/Add/Edit | View/Add | View/Add | None |
| **Viewer** | View Only | View Only | View Only | View Only | View Only | None |

## Public Endpoints (No Auth Required)

- `getJobPosts` with `status='Open'` - For public job board
- `addJobApplication` - For submitting applications
- `getJobApplication` - For applicants to check status

## Troubleshooting

### "SPREADSHEET_ID not configured"
- Run `setupDatabase()` first and update CONFIG

### "Permission denied"
- Check user role has required permission
- Verify token is being sent with requests

### "Authentication required"
- Ensure token is included in request body
- Token may have expired (24 hours)

### CORS Issues
- Apps Script Web Apps handle CORS automatically
- Ensure using POST requests with JSON body

### Slow Performance
- Google Sheets has limits; consider pagination for large datasets
- Avoid making many requests in quick succession

## Updating the Deployment

After making changes to the script:

1. Click **Deploy** → **Manage deployments**
2. Click the pencil icon ✏️ next to your deployment
3. Update **Version** to a new version
4. Click **Deploy**

Note: The URL remains the same; only the version changes.

## Security Notes

⚠️ **Important Security Considerations:**

1. **Password Storage**: Passwords are stored as plain text for simplicity. In production, use proper hashing (e.g., add a hash library).

2. **Token Storage**: Tokens are stored in Script Properties with 24-hour expiry. Consider using CacheService for better performance.

3. **Rate Limiting**: No rate limiting is implemented. Consider adding for production use.

4. **Input Validation**: Basic validation is implemented. Add more thorough validation for production.

5. **Backup**: Regularly backup your Google Sheet data.

## Contact

For issues or questions, contact the development team.
