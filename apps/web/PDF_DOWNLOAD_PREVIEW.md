# PDF Download & Preview Feature

## Overview
This document describes the PDF download and preview functionality implemented for the Smart Apply application.

## Features

### 1. Individual PDF Downloads
- Download Cover Letter as PDF
- Download Resume as PDF
- Custom filenames with company name and job title
- Loading indicators during download
- Error handling with toast notifications

### 2. ZIP Download
- Download both Cover Letter and Resume in a single ZIP file
- Automatic filename generation
- Progress indication
- Error recovery

### 3. PDF Preview
- In-browser PDF preview using react-pdf
- Page navigation (previous/next)
- Zoom controls (zoom in/out, scale display)
- Download from preview modal
- Loading states and error messages

### 4. URL Expiration Handling
- Automatic detection of expired SAS URLs
- Auto-refetch when URLs expire
- User-friendly error messages
- Seamless recovery

## Architecture

### Components

#### PDFPreviewModal (`src/components/pdf/pdf-preview-modal.tsx`)
A modal dialog component that displays PDF documents with controls.

**Props:**
- `isOpen: boolean` - Whether the modal is open
- `onClose: () => void` - Callback when modal closes
- `url: string` - PDF file URL (SAS URL from Azure Blob)
- `filename: string` - Suggested filename for download
- `title: string` - Modal title
- `onExpired?: () => void` - Callback when URL is expired

**Features:**
- PDF rendering with react-pdf
- Page navigation
- Zoom controls (50% to 200%)
- Download button
- Loading and error states

#### Enhanced Application Detail Page
The application detail page (`src/app/(dashboard)/applications/[id]/page.tsx`) has been enhanced with:
- Download buttons for each document
- Preview buttons for each document
- "Download Both as ZIP" button
- URL expiration display
- Loading states per download action

### Utilities

#### PDF Utils (`src/lib/pdf-utils.ts`)
Reusable utility functions for PDF handling.

**Functions:**

##### `downloadFile(url: string, filename: string): Promise<void>`
Downloads a single file from a URL with a custom filename.

##### `downloadAsZip(files: Array<{url, filename}>, zipFilename: string): Promise<void>`
Downloads multiple files as a ZIP archive using jszip.

##### `isUrlExpired(expiresAt: string): boolean`
Checks if a URL has expired based on the expiresAt timestamp.

##### `generateFilename(type: 'cover-letter' | 'resume', company?: string, title?: string): string`
Generates a safe, meaningful filename for downloads.

Format: `YYYY-MM-DD-[company]-[title]-[type].pdf`

Example: `2024-01-15-acme-corp-senior-developer-cover-letter.pdf`

##### `handleDownload(url: string, filename: string, onExpired?: () => void): Promise<void>`
Downloads a file with error handling and toast notifications.

##### `handleZipDownload(files: Array<{url, filename}>, zipFilename: string, onExpired?: () => void): Promise<void>`
Downloads multiple files as ZIP with error handling and toast notifications.

### Types

#### ApplicationFile (`src/types/index.ts`)
```typescript
interface ApplicationFile {
  key: string;         // Storage key (e.g., "applications/app-123-cover-letter.pdf")
  filename: string;    // Suggested filename (e.g., "app-123-cover-letter.pdf")
  mimeType: string;    // MIME type (e.g., "application/pdf")
  url: string;         // Download URL (Azure SAS URL)
  expiresAt: string;   // ISO timestamp when URL expires
}
```

#### ApplicationFilesResponse
```typescript
interface ApplicationFilesResponse {
  applicationId: string;
  coverLetter?: ApplicationFile;
  resume?: ApplicationFile;
}
```

## User Flow

### Viewing Application Details
1. User navigates to application detail page
2. If application status is "READY", files section appears
3. Each document card shows:
   - Document icon and type
   - URL expiration time
   - Preview button
   - Download button

### Downloading Individual Files
1. User clicks "Download" button on a document
2. Button shows loading spinner
3. Toast notification: "Download wird vorbereitet..."
4. File downloads with meaningful filename
5. Toast notification: "Download erfolgreich!"
6. Button returns to normal state

### Downloading as ZIP
1. User clicks "Beide als ZIP" button in header
2. Button shows loading spinner
3. Toast notification: "ZIP-Archiv wird erstellt..."
4. Both PDFs are fetched in parallel
5. ZIP file is created in browser
6. ZIP downloads with company name in filename
7. Toast notification: "ZIP-Download erfolgreich!"

### Previewing PDF
1. User clicks "Vorschau" button
2. Modal opens with PDF rendered
3. User can:
   - Navigate pages with arrow buttons
   - Zoom in/out
   - Download from modal
   - Close modal

### Handling Expired URLs
1. System detects 403 error during download/preview
2. Toast notification: "Download-Link ist abgelaufen. Wird neu geladen..."
3. Files are automatically refetched from API
4. New SAS URLs are retrieved (1 hour expiration)
5. Download/preview operation is retried
6. User can try again

## Error Handling

### Network Errors
- Display user-friendly error message
- Log error to console
- Allow retry

### Expired URLs
- Detect 403 status code
- Trigger automatic refetch
- Notify user of refresh

### Invalid PDF
- Display error in preview modal
- Suggest URL might be expired
- Provide download option

## Dependencies

- **react-pdf**: PDF rendering in browser
- **pdfjs-dist**: PDF.js library for parsing PDFs
- **jszip**: Creating ZIP archives in browser
- **@types/jszip**: TypeScript types for jszip
- **sonner**: Toast notifications

## Performance Considerations

### Lazy Loading
- JSZip is dynamically imported only when needed
- PDF.js worker is loaded from CDN

### Parallel Downloads
- Multiple files are downloaded in parallel for ZIP creation
- Improves ZIP creation speed

### Blob Management
- Blob URLs are properly cleaned up after use
- Prevents memory leaks

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Requires JavaScript enabled
- Works offline after initial load (files cached by service worker)

## Security

### SAS URLs
- Time-limited (1 hour expiration)
- Read-only access
- Automatically refetched when expired

### Download Safety
- Files downloaded directly from Azure Blob Storage
- No proxy or intermediate storage
- Original filenames are sanitized

### CORS
- Backend configured to allow CORS for SAS URLs
- Azure Blob Storage CORS rules configured

## Testing

### Manual Testing Checklist
- [ ] Download cover letter PDF
- [ ] Download resume PDF
- [ ] Download both as ZIP
- [ ] Preview cover letter
- [ ] Preview resume
- [ ] Navigate pages in preview
- [ ] Zoom in/out in preview
- [ ] Download from preview modal
- [ ] Test with expired URL (wait 1 hour)
- [ ] Test error handling (disconnect network)
- [ ] Test on mobile device
- [ ] Test on different browsers

### E2E Testing (TODO)
- Automated tests using Playwright/Cypress
- Mock backend responses
- Test all user flows
- Test error scenarios

## Future Enhancements

### Planned Features
- [ ] Edit cover letter/resume before download
- [ ] Compare versions
- [ ] Annotation support
- [ ] Email documents directly
- [ ] Cloud storage integration (Google Drive, Dropbox)
- [ ] Print preview
- [ ] Thumbnail previews in list view

### Performance Improvements
- [ ] Prefetch PDFs in background when status becomes "READY"
- [ ] Cache PDFs in IndexedDB
- [ ] Progressive loading for large PDFs
- [ ] Server-side rendering for first page

## Troubleshooting

### PDF Won't Load
1. Check browser console for errors
2. Verify URL is not expired (check expiresAt timestamp)
3. Check network connectivity
4. Try refreshing the page
5. Check if Azure Blob Storage is accessible

### Download Fails
1. Check if popup blocker is blocking download
2. Verify sufficient disk space
3. Check browser download settings
4. Try different browser

### ZIP Creation Fails
1. Check if both PDFs are accessible
2. Verify enough memory available
3. Try downloading files individually
4. Check browser console for detailed error

## Support

For issues or questions:
1. Check browser console for detailed errors
2. Review error messages in toast notifications
3. Check application logs
4. Contact support with application ID

## Related Files

### Frontend
- `apps/web/src/components/pdf/pdf-preview-modal.tsx`
- `apps/web/src/lib/pdf-utils.ts`
- `apps/web/src/app/(dashboard)/applications/[id]/page.tsx`
- `apps/web/src/types/index.ts`
- `apps/web/src/lib/api-client.ts`

### Backend
- `apps/api/src/applications/applications.controller.ts`
- `apps/api/src/applications/applications.service.ts`
- `apps/api/src/applications/dto/application-files-response.dto.ts`
- `apps/api/src/storage/storage.service.ts`

## License

Part of Smart Apply MVP - Internal documentation
