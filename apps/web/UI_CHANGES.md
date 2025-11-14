# UI Changes - PDF Download & Preview Feature

## Application Detail Page - Enhanced Documents Section

### Before
```
┌─────────────────────────────────────────────────────────────┐
│ 📄 Bewerbungsunterlagen                                     │
│ Deine generierten Bewerbungsunterlagen sind bereit...      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐         │
│  │ 📄 Anschreiben      │  │ 📄 Lebenslauf       │         │
│  │ PDF-Dokument    ⬇️  │  │ PDF-Dokument    ⬇️  │         │
│  └─────────────────────┘  └─────────────────────┘         │
│  (Simple links with download icon)                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### After (New Enhanced UI)
```
┌─────────────────────────────────────────────────────────────────────────┐
│ 📄 Bewerbungsunterlagen              📦 Beide als ZIP                  │
│ Deine generierten Bewerbungsunterlagen sind bereit...                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────┐│
│  │ 📄 Anschreiben                   │  │ 📄 Lebenslauf                ││
│  │ PDF-Dokument                     │  │ PDF-Dokument                 ││
│  │ Link läuft ab: 15:30:00          │  │ Link läuft ab: 15:30:00      ││
│  │                                  │  │                              ││
│  │ ┌──────────┐ ┌──────────────┐   │  │ ┌──────────┐ ┌──────────────┐││
│  │ │👁️ Vorschau│ │⬇️ Download   │   │  │ │👁️ Vorschau│ │⬇️ Download   │││
│  │ └──────────┘ └──────────────┘   │  │ └──────────┘ └──────────────┘││
│  └──────────────────────────────────┘  └──────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## PDF Preview Modal

### Modal Layout
```
┌─────────────────────────────────────────────────────────────────────────┐
│ Anschreiben                                                         ✕   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ◀️ Seite 1 von 2 ▶️      🔍- 100% 🔍+          ⬇️ Download            │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │                                                                     │ │
│ │                    PDF PREVIEW AREA                                │ │
│ │                                                                     │ │
│ │              [Cover Letter Document Content]                       │ │
│ │                                                                     │ │
│ │              - Interactive PDF rendering                           │ │
│ │              - Zoomable (50% - 200%)                               │ │
│ │              - Page navigation                                     │ │
│ │              - Scrollable for overflow                             │ │
│ │                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Download States

### Individual Download Button States

#### Normal State
```
┌──────────────┐
│ ⬇️ Download  │
└──────────────┘
```

#### Loading State
```
┌──────────────┐
│ ⏳ Lädt...   │  (spinning icon)
└──────────────┘
```

#### Success (Toast Notification)
```
┌────────────────────────────────┐
│ ✅ Download erfolgreich!       │
└────────────────────────────────┘
```

#### Error - Expired URL (Toast)
```
┌────────────────────────────────────────────────────┐
│ ⚠️ Download-Link ist abgelaufen.                  │
│    Wird neu geladen...                            │
└────────────────────────────────────────────────────┘
```

## Download Both as ZIP

### Button in Header
```
┌─────────────────────────────────────────────────────────────┐
│ 📄 Bewerbungsunterlagen              ┌──────────────────┐   │
│ Deine generierten...                 │ 📦 Beide als ZIP │   │
│                                      └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Loading State
```
┌──────────────────┐
│ ⏳ Lädt...       │  (spinning icon)
└──────────────────┘
```

### Success
```
┌────────────────────────────────────────┐
│ ✅ ZIP-Download erfolgreich!          │
└────────────────────────────────────────┘
```

## Responsive Design

### Desktop (≥768px)
- Two-column grid for documents
- Full-width preview modal
- All controls visible

### Mobile (<768px)
- Single-column stack for documents
- Full-screen preview modal
- Touch-friendly buttons
- Responsive zoom controls

## Color Scheme

### Document Cards
- Border: Gray (border color)
- Background: White
- Icon: Blue (#2563eb)
- Text: Gray-900 (dark)
- Subtext: Gray-500 (medium)
- Expiry time: Gray-400 (light)

### Buttons
- Primary (Download): Blue background, white text
- Secondary (Preview): White background, gray border
- ZIP Button: White background, gray border
- Hover: Slight opacity change

### Loading Indicators
- Spinner: Matching button context (white on blue, gray on white)
- Animation: Smooth rotation

### Toast Notifications
- Success: Green accent
- Error: Red accent
- Loading: Blue accent
- Background: White with shadow

## Interactions

### Hover Effects
- Download buttons: Slight background darkening
- Preview buttons: Slight border darkening
- Document cards: No hover effect (not clickable)

### Focus States
- All interactive elements have visible focus rings
- Tab-navigation friendly
- WCAG 2.1 AA compliant

### Loading States
- Immediate visual feedback on click
- Spinning animation
- Button stays disabled during operation
- Toast notification appears

### Error Recovery
- Automatic retry on expired URLs
- Clear error messages
- Manual retry option
- Maintains context (doesn't lose user's place)

## Accessibility Features

### Screen Reader Support
- Proper ARIA labels on all buttons
- Status announcements for loading/success/error
- Meaningful alt text for icons
- Semantic HTML structure

### Keyboard Navigation
- Tab order follows logical flow
- Escape closes modal
- Arrow keys navigate PDF pages
- All actions accessible via keyboard

### Visual Accessibility
- High contrast text
- Clear button labels
- Icons supplement text (not replace)
- Loading states clearly indicated

## File Naming

### Individual Downloads
Format: `YYYY-MM-DD-[company]-[title]-[type].pdf`

Examples:
- `2024-01-15-acme-corp-senior-developer-cover-letter.pdf`
- `2024-01-15-acme-corp-senior-developer-resume.pdf`

### ZIP Downloads
Format: `[company]-bewerbung.zip`

Example:
- `acme-corp-bewerbung.zip`

Contents:
```
acme-corp-bewerbung.zip/
  ├── 2024-01-15-acme-corp-senior-developer-cover-letter.pdf
  └── 2024-01-15-acme-corp-senior-developer-resume.pdf
```

## Performance

### Optimization Techniques
- Lazy loading of JSZip library
- PDF.js worker loaded from CDN
- Blob URLs cleaned up after use
- Parallel downloads for ZIP creation
- React Query caching for file metadata

### Load Times
- Preview opens instantly (modal display)
- PDF renders in 1-2 seconds (depends on size)
- Individual downloads: < 1 second
- ZIP creation: 2-3 seconds for 2 files
- URL refresh: < 500ms

## Testing Checklist

### Visual Testing
- [ ] Desktop layout (1920x1080)
- [ ] Tablet layout (768x1024)
- [ ] Mobile layout (375x667)
- [ ] Dark mode compatibility (future)

### Functional Testing
- [ ] Download cover letter
- [ ] Download resume
- [ ] Download both as ZIP
- [ ] Preview cover letter
- [ ] Preview resume
- [ ] Page navigation in preview
- [ ] Zoom controls in preview
- [ ] Close preview modal
- [ ] Download from preview modal

### Error Handling
- [ ] Expired URL handling
- [ ] Network error handling
- [ ] Invalid PDF handling
- [ ] Browser compatibility

### Performance Testing
- [ ] Large PDF files (>5MB)
- [ ] Multiple concurrent downloads
- [ ] ZIP with multiple files
- [ ] Memory leaks check
