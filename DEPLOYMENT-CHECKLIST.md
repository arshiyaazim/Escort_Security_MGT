# Deployment Checklist - Al-Aqsa HRM

## Pre-Deployment Checklist

### 1. Test Backend Changes Locally

Before deploying to production, test all changes in the Apps Script editor:

- [ ] Open Apps Script project at script.google.com
- [ ] Run `setupDatabase()` - verify it detects existing config
- [ ] Run `getStartupStatus()` - verify validation works
- [ ] Run `cleanupExpiredTokens()` - verify token cleanup works
- [ ] Test `health` action returns proper status
- [ ] Test `meta` action returns version info
- [ ] Run `installTokenCleanupTrigger()` to enable daily token cleanup

### 2. Verify Configuration

- [ ] Verify `APP_CONFIG` exists in PropertiesService
  - In Apps Script: File → Project properties → Script properties
- [ ] Note the Spreadsheet ID and Drive Folder ID

### 3. Frontend Version Match

- [ ] Verify `js/config.js` has correct APP_VERSION
- [ ] Verify `js/api.js` has correct BASE_URL

---

## Deployment Steps

### Step 1: Deploy Google Apps Script Backend

1. Go to [script.google.com](https://script.google.com)
2. Open your Al-Aqsa HRM project
3. Click **Deploy** → **New deployment**
4. Click gear icon → Select **Web app**
5. Configure:
   - **Description**: `Al-Aqsa HRM v1.1.0`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
6. Click **Deploy**
7. Copy the new Web App URL

### Step 2: Update Frontend BASE_URL

1. Open `js/api.js` in your project
2. Find `const BASE_URL = '...'`
3. Replace with new Web App URL
4. Save the file

### Step 3: Deploy Frontend to GitHub Pages

1. Commit changes to GitHub:
   ```bash
   git add .
   git commit -m "Update to v1.1.0 - backend fixes"
   git push origin main
   ```
2. GitHub Pages will auto-deploy

---

## Verification Steps

### Verify Backend Deployment

Open browser console and run:

```javascript
// Test health endpoint
fetch('YOUR_DEPLOYMENT_URL', {
  method: 'POST',
  redirect: 'follow',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify({ action: 'health' })
}).then(r => r.json()).then(console.log)
```

Expected response:
```json
{
  "success": true,
  "action": "health",
  "data": {
    "appVersion": "1.1.0",
    "deploymentDate": "2026-02-16",
    "spreadsheetIdMasked": "1vI2YMv...",
    "databaseValid": true,
    "errors": [],
    "timestamp": "2026-02-16T..."
  }
}
```

### Verify Meta Endpoint

```javascript
// Test meta endpoint
fetch('YOUR_DEPLOYMENT_URL', {
  method: 'POST',
  redirect: 'follow',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify({ action: 'meta' })
}).then(r => r.json()).then(console.log)
```

### Verify Login Works

1. Open the frontend app
2. Login with default credentials:
   - Username: `admin`
   - Password: `admin123`
3. Verify login succeeds without errors

### Verify Logout Works

1. Click logout button
2. Verify network request to `logout` action
3. Verify redirected to login page

---

## Avoiding Stale Deployments

### The Problem

Google Apps Script deployments can appear to work but serve old code because:
1. Editor code ≠ deployed code
2. Multiple deployments can exist
3. Version numbers are user-assigned

### The Solution

1. **Always check `/meta` endpoint** - returns exact deployed version
2. **Use health check** - returns database validation status
3. **Increment version** in deployment description each time
4. **Test after every deployment** - verify functionality works

### Quick Version Check

After any deployment, run:
```javascript
// In browser console after logging in
request('meta').then(console.log)
```

Compare returned `appVersion` with expected version.

---

## Troubleshooting

### "SPREADSHEET_ID not configured"
- Run `setupDatabase()` in Apps Script editor
- Check PropertiesService has `APP_CONFIG`

### "Database validation failed"
- Check spreadsheet ID is correct
- Verify spreadsheet is shared with script account
- Check required sheets exist

### "Token cleanup not working"
- Run `installTokenCleanupTrigger()` manually
- Check project triggers: Edit → Current project's triggers

### Frontend shows old version
- Clear browser cache
- Check git push succeeded
- Verify BASE_URL is correct in api.js

### POST requests failing
- Check `redirect: 'follow'` is set in fetch
- Verify `Content-Type: text/plain` header
- Test with health endpoint first
