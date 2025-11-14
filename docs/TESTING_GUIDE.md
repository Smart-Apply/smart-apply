# Testing Guide - PDF Download & Preview Feature

## Manual Testing

### Prerequisites
1. Backend running on `http://localhost:3000`
2. Frontend running on `http://localhost:3001`
3. Test user account with demo data
4. At least one application with "READY" status

### Test Data Setup

#### Using Demo Account
```bash
# Credentials
Email: demo@smartapply.com
Password: Demo123!

# This account should have:
- Complete profile
- At least one job posting
- At least one application in "READY" status
```

#### Creating Test Application
1. Login to the application
2. Navigate to "Job Postings"
3. Create a new job posting (paste text or URL)
4. Navigate to "Applications"
5. Click "Create Application"
6. Select the job posting
7. Wait for status to change to "READY" (may take 1-2 minutes)

### Test Cases

#### TC-01: View Application Detail
**Steps:**
1. Navigate to Applications page
2. Click on an application with "READY" status
3. Scroll to "Bewerbungsunterlagen" section

**Expected:**
- [ ] Two document cards are visible
- [ ] Each card shows document type (Anschreiben/Lebenslauf)
- [ ] Each card shows "PDF-Dokument"
- [ ] Each card shows expiration time
- [ ] Each card has "Vorschau" and "Download" buttons
- [ ] "Beide als ZIP" button is visible in header

#### TC-02: Download Cover Letter
**Steps:**
1. In application detail, locate cover letter card
2. Click "Download" button

**Expected:**
- [ ] Button shows loading spinner
- [ ] Toast notification: "Download wird vorbereitet..."
- [ ] File downloads to browser's download folder
- [ ] Filename format: `YYYY-MM-DD-[company]-[title]-cover-letter.pdf`
- [ ] Toast notification: "Download erfolgreich!"
- [ ] Button returns to normal state

#### TC-03: Download Resume
**Steps:**
1. In application detail, locate resume card
2. Click "Download" button

**Expected:**
- [ ] Button shows loading spinner
- [ ] Toast notification: "Download wird vorbereitet..."
- [ ] File downloads to browser's download folder
- [ ] Filename format: `YYYY-MM-DD-[company]-[title]-resume.pdf`
- [ ] Toast notification: "Download erfolgreich!"
- [ ] Button returns to normal state

#### TC-04: Download Both as ZIP
**Steps:**
1. In application detail header
2. Click "Beide als ZIP" button

**Expected:**
- [ ] Button shows loading spinner
- [ ] Toast notification: "ZIP-Archiv wird erstellt..."
- [ ] ZIP file downloads
- [ ] ZIP filename format: `[company]-bewerbung.zip`
- [ ] ZIP contains both PDFs with correct names
- [ ] Toast notification: "ZIP-Download erfolgreich!"
- [ ] Button returns to normal state

#### TC-05: Preview Cover Letter
**Steps:**
1. In application detail, locate cover letter card
2. Click "Vorschau" button

**Expected:**
- [ ] Modal opens immediately
- [ ] Modal title shows "Anschreiben"
- [ ] PDF starts loading (spinner visible)
- [ ] PDF renders correctly
- [ ] Navigation shows "Seite 1 von [N]"
- [ ] Previous button is disabled on first page
- [ ] Zoom controls are visible
- [ ] Download button is visible in modal

#### TC-06: Navigate PDF Pages
**Prerequisites:** Open PDF preview with multiple pages

**Steps:**
1. Open cover letter or resume preview
2. Click "Next" arrow button
3. Click "Previous" arrow button

**Expected:**
- [ ] Page number updates correctly
- [ ] PDF content changes to show next/previous page
- [ ] Previous button disabled on page 1
- [ ] Next button disabled on last page
- [ ] Page indicator shows current/total pages

#### TC-07: Zoom PDF
**Prerequisites:** PDF preview is open

**Steps:**
1. Click zoom in button (🔍+)
2. Verify zoom increases
3. Click zoom out button (🔍-)
4. Verify zoom decreases

**Expected:**
- [ ] Zoom percentage displays (50% - 200%)
- [ ] PDF scales correctly
- [ ] Zoom in max is 200%
- [ ] Zoom out min is 50%
- [ ] Buttons disable at min/max

#### TC-08: Download from Preview
**Prerequisites:** PDF preview is open

**Steps:**
1. Click "Download" button in modal toolbar

**Expected:**
- [ ] Same behavior as direct download
- [ ] Modal remains open
- [ ] File downloads with correct filename

#### TC-09: Close Preview Modal
**Prerequisites:** PDF preview is open

**Steps:**
1. Click X button in top-right
2. OR press Escape key
3. OR click outside modal (backdrop)

**Expected:**
- [ ] Modal closes smoothly
- [ ] Returns to application detail page
- [ ] No errors in console

#### TC-10: Expired URL Handling
**Prerequisites:** Wait for URLs to expire (1 hour after fetch)

**Steps:**
1. Wait 1+ hours after opening application detail
2. Try to download or preview a document

**Expected:**
- [ ] Error detected (403 status)
- [ ] Toast: "Download-Link ist abgelaufen. Wird neu geladen..."
- [ ] Files are automatically refetched
- [ ] New SAS URLs obtained
- [ ] Download/preview succeeds after refetch

**Note:** To test without waiting, you can modify the backend to use shorter expiration (e.g., 60 seconds).

#### TC-11: Network Error Handling
**Steps:**
1. Disconnect from network
2. Try to download a document

**Expected:**
- [ ] Error is caught
- [ ] Toast: "Download fehlgeschlagen. Bitte versuche es erneut."
- [ ] Button returns to normal state
- [ ] User can retry after reconnecting

#### TC-12: Mobile Responsiveness
**Steps:**
1. Open application detail on mobile device (or use DevTools device emulation)
2. Test all download/preview features

**Expected:**
- [ ] Documents stack vertically
- [ ] Buttons are touch-friendly (min 44x44px)
- [ ] Preview modal is full-screen
- [ ] Zoom controls work with touch
- [ ] All features work on mobile

### Browser Compatibility Testing

Test on the following browsers:

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

### Performance Testing

#### TC-P1: Large PDF Files
**Steps:**
1. Create application with large PDFs (>5MB)
2. Test download and preview

**Expected:**
- [ ] Downloads complete successfully
- [ ] Preview renders without freezing
- [ ] No browser crashes
- [ ] Memory usage reasonable

#### TC-P2: Multiple Concurrent Downloads
**Steps:**
1. Open multiple applications in different tabs
2. Download from multiple tabs simultaneously

**Expected:**
- [ ] All downloads succeed
- [ ] No race conditions
- [ ] Browser handles multiple downloads

#### TC-P3: ZIP Creation Performance
**Steps:**
1. Create ZIP with both documents
2. Monitor creation time

**Expected:**
- [ ] ZIP creates in < 5 seconds
- [ ] No UI freezing during creation
- [ ] Toast notifications update correctly

## Automated Testing (Future)

### Unit Tests

#### PDF Utils Tests
```typescript
// Example test cases
describe('generateFilename', () => {
  it('generates filename with date prefix');
  it('includes company name when provided');
  it('includes job title when provided');
  it('sanitizes special characters');
  it('truncates long titles');
});

describe('isUrlExpired', () => {
  it('returns true for past dates');
  it('returns false for future dates');
});

describe('downloadFile', () => {
  it('creates download link with correct filename');
  it('cleans up blob URL after download');
});
```

### Integration Tests

#### Application Detail Page Tests
```typescript
describe('Application Detail - Documents Section', () => {
  it('shows documents when status is READY');
  it('hides documents when status is not READY');
  it('displays expiration time correctly');
  it('handles missing cover letter gracefully');
  it('handles missing resume gracefully');
});
```

### E2E Tests (Playwright/Cypress)

```typescript
// Example E2E test
test('User can download and preview application documents', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3001/login');
  await page.fill('[name=email]', 'demo@smartapply.com');
  await page.fill('[name=password]', 'Demo123!');
  await page.click('button[type=submit]');
  
  // Navigate to application
  await page.goto('http://localhost:3001/applications');
  await page.click('a[href*="/applications/"]');
  
  // Wait for documents section
  await page.waitForSelector('text=Bewerbungsunterlagen');
  
  // Test preview
  await page.click('button:has-text("Vorschau")');
  await page.waitForSelector('[role="dialog"]');
  expect(await page.isVisible('text=Anschreiben')).toBe(true);
  
  // Close modal
  await page.keyboard.press('Escape');
  
  // Test download (mock file system)
  const downloadPromise = page.waitForEvent('download');
  await page.click('button:has-text("Download")');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/cover-letter\.pdf$/);
});
```

## Test Report Template

### Test Session Information
- **Date:** YYYY-MM-DD
- **Tester:** Name
- **Environment:** Development / Staging / Production
- **Browser:** Chrome 120.0.0
- **OS:** Windows 11 / macOS 14 / Ubuntu 22.04

### Test Results Summary
- **Total Test Cases:** 12
- **Passed:** X
- **Failed:** Y
- **Blocked:** Z
- **Pass Rate:** XX%

### Failed Test Cases
| TC ID | Description | Status | Notes |
|-------|-------------|--------|-------|
| TC-05 | Preview Cover Letter | FAIL | PDF didn't load on Safari |

### Issues Found
| Issue ID | Severity | Description | Steps to Reproduce |
|----------|----------|-------------|-------------------|
| ISS-001 | Medium | PDF preview slow on large files | See TC-P1 |

### Browser Compatibility Matrix
| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Download PDF | ✅ | ✅ | ✅ | ✅ |
| Preview PDF | ✅ | ✅ | ⚠️ | ✅ |
| ZIP Download | ✅ | ✅ | ✅ | ✅ |

### Performance Metrics
- **Average Download Time:** 1.2s
- **Average Preview Load Time:** 2.5s
- **ZIP Creation Time:** 3.1s
- **Memory Usage:** 120MB peak

### Recommendations
1. Optimize PDF preview loading for Safari
2. Add progressive loading for large PDFs
3. Consider caching PDFs in IndexedDB
4. Add retry mechanism for failed downloads

## Debugging Tips

### Common Issues

#### PDF Won't Preview
**Check:**
1. Browser console for errors
2. Network tab for failed requests
3. SAS URL expiration
4. CORS configuration
5. PDF.js worker loading

**Solution:**
```bash
# Check worker path
console.log(pdfjs.GlobalWorkerOptions.workerSrc);

# Should be: //unpkg.com/pdfjs-dist@X.X.X/build/pdf.worker.min.mjs
```

#### Download Doesn't Start
**Check:**
1. Browser popup blocker
2. Console errors
3. Network connectivity
4. File permissions

**Solution:**
```javascript
// Test download manually in console
const blob = new Blob(['test'], { type: 'text/plain' });
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = 'test.txt';
link.click();
```

#### ZIP Creation Fails
**Check:**
1. JSZip loaded correctly
2. Both file URLs accessible
3. Browser memory available

**Solution:**
```javascript
// Test JSZip
import JSZip from 'jszip';
const zip = new JSZip();
zip.file('test.txt', 'Hello World');
const blob = await zip.generateAsync({ type: 'blob' });
console.log('JSZip works!', blob);
```

## Test Data Cleanup

After testing, clean up:

```sql
-- Delete test applications
DELETE FROM "Application" WHERE userId = 'test-user-id';

-- Delete test job postings
DELETE FROM "JobPosting" WHERE userId = 'test-user-id';
```

Or use the UI:
1. Navigate to Applications page
2. Delete test applications
3. Navigate to Job Postings page
4. Delete test job postings
