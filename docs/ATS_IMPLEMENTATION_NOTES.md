# ATS Implementation Notes

## Overview

This document provides technical details about the ATS (Applicant Tracking System) optimization implementation in Smart Apply. For user-facing information, see [ATS_OPTIMIZATION.md](./ATS_OPTIMIZATION.md).

## Architecture

### Components

1. **ATS Templates** (`apps/api/src/pdf/templates/`)
   - `resume-ats.hbs` - Simplified resume template
   - `cover-letter-ats.hbs` - Simplified cover letter template
   - Focus: Single-column layout, semantic HTML, no complex elements

2. **ATS Styles** (`apps/api/src/pdf/styles/`)
   - `base-ats.css` - Core ATS-safe styling
   - `resume-ats.css` - Resume-specific ATS styles
   - `cover-letter-ats.css` - Cover letter-specific ATS styles
   - Features: Arial/Helvetica fonts, black text, simple spacing, no backgrounds

3. **PDF Service** (`apps/api/src/pdf/pdf.service.ts`)
   - Enhanced with ATS-optimized generation options
   - Metadata injection using pdf-lib
   - Tagged PDF support for accessibility
   - Configurable margins for ATS vs standard formats

4. **Template Renderer** (`apps/api/src/pdf/template-renderer.service.ts`)
   - Loads ATS templates from filesystem when `atsOptimized=true`
   - Falls back to database templates for standard generation
   - Combines HTML templates with CSS styles

5. **ATS Validator** (`apps/api/src/pdf/ats-validator.service.ts`)
   - Validates PDFs for ATS-friendliness
   - 6 validation checks + scoring algorithm
   - Detailed reports with recommendations

## ATS Validation Checks

### 1. Text-Based Check (Weight: 30 points)
- **Purpose**: Ensure all text is selectable and searchable
- **Method**: Check for text content in PDF pages
- **Pass Criteria**: PDF contains extractable text content

### 2. Complex Layouts Check (Weight: 20 points)
- **Purpose**: Detect tables, form fields, multi-column layouts
- **Method**: Inspect form fields and annotations
- **Pass Criteria**: No form fields or annotations found

### 3. Safe Fonts Check (Weight: 15 points)
- **Purpose**: Verify use of ATS-safe fonts
- **Method**: Heuristic check (assumes safe fonts if we generated PDF)
- **Pass Criteria**: Uses Arial, Helvetica, or similar standard fonts
- **Note**: pdf-lib doesn't provide direct font inspection API

### 4. Metadata Check (Weight: 15 points)
- **Purpose**: Verify PDF has proper metadata
- **Method**: Check for title and author fields
- **Pass Criteria**: Both title and author metadata are set

### 5. Single Column Check (Weight: 10 points)
- **Purpose**: Ensure simple top-to-bottom reading order
- **Method**: Heuristic based on complex layout detection
- **Pass Criteria**: No complex layouts detected

### 6. Selectable Text Check (Weight: 10 points)
- **Purpose**: Same as text-based check
- **Method**: Duplicate of check #1
- **Pass Criteria**: Text is selectable

## Scoring Algorithm

```
Total Score = sum of passed checks * weight
Maximum Score = 100 points

Score Interpretation:
- 90-100: Excellent ATS compatibility
- 75-89:  Good ATS compatibility
- 60-74:  Fair ATS compatibility
- <60:    Poor ATS compatibility (needs improvement)
```

## API Usage

### Generate ATS-Optimized Resume

```typescript
const pdfBuffer = await pdfService.generateResumePDF(
  resumeData,
  undefined, // No custom template (use ATS template)
  {
    atsOptimized: true,
    metadata: {
      title: 'Resume - John Doe',
      author: 'John Doe',
      subject: 'Software Engineer Application',
      keywords: ['JavaScript', 'React', 'Node.js', 'AWS'],
      creator: 'Smart Apply',
    },
  }
);
```

### Validate PDF for ATS Compliance

```typescript
const validation = await atsValidator.validatePdf(pdfBuffer);

console.log(`ATS Score: ${validation.score}/100`);
console.log(`Text-Based: ${validation.isTextBased}`);
console.log(`Safe Fonts: ${validation.usesSafeFonts}`);
console.log(`Warnings: ${validation.warnings.length}`);
```

### Get Detailed Validation Report

```typescript
const report = await atsValidator.getDetailedReport(pdfBuffer);

console.log(`Checks:`);
console.log(`- Text Based: ${report.checks.textBased.passed}`);
console.log(`- Complex Layouts: ${report.checks.complexLayouts.passed}`);
console.log(`- Safe Fonts: ${report.checks.safeFonts.passed}`);
console.log(`- Metadata: ${report.checks.metadata.passed}`);

console.log(`\nRecommendations:`);
report.recommendations.forEach(rec => console.log(`- ${rec}`));
```

## Template Rendering Flow

```
1. User requests PDF generation (via ApplicationsService)
   ↓
2. PdfService.generateResumePDF() or generateCoverLetterPDF()
   ↓
3. If atsOptimized=true:
   - TemplateRendererService loads resume-ats.hbs / cover-letter-ats.hbs
   - Loads base-ats.css + specific ATS CSS
   Else:
   - Loads template from database (custom or default)
   ↓
4. Handlebars compiles template with data
   ↓
5. PdfService.generatePDFFromRenderedHTML()
   - Launches Puppeteer browser
   - Sets HTML content
   - Generates PDF with ATS options (no backgrounds, tagged PDF)
   ↓
6. If metadata provided:
   - PdfService.addMetadata() injects metadata via pdf-lib
   ↓
7. Return PDF buffer
```

## Testing

### Unit Tests (13 tests)

Location: `apps/api/src/pdf/ats-validator.service.spec.ts`

**Coverage:**
- ✅ PDF validation with all checks
- ✅ Missing metadata detection
- ✅ Complex layout detection
- ✅ Score calculation
- ✅ Safe font handling
- ✅ Detailed reports with recommendations
- ✅ Font detection in reports
- ✅ Metadata details in reports
- ✅ Health check
- ✅ High/low score scenarios

**Run Tests:**
```bash
npm test -w apps/api -- --testPathPattern=ats-validator
```

### Integration Tests

Location: `apps/api/src/pdf/pdf-ats.integration.spec.ts`

**Coverage:**
- ATS-optimized resume generation with validation
- ATS-optimized cover letter generation
- Font usage verification
- Layout complexity verification
- Metadata injection verification
- Standard vs ATS comparison
- Detailed validation reports

**Note:** Integration tests require Puppeteer to be installed and Chrome/Chromium available.

**Run Tests:**
```bash
npm test -w apps/api -- --testPathPattern=pdf-ats.integration --testTimeout=40000
```

## File Structure

```
apps/api/src/pdf/
├── ats-validator.service.ts       # ATS validation service
├── ats-validator.service.spec.ts  # Unit tests (13 tests)
├── pdf-ats.integration.spec.ts    # Integration tests
├── pdf.service.ts                 # PDF generation service (updated)
├── template-renderer.service.ts   # Template rendering (updated)
├── pdf.module.ts                  # Module configuration (updated)
├── templates/
│   ├── resume-ats.hbs             # ATS resume template
│   ├── cover-letter-ats.hbs       # ATS cover letter template
│   ├── resume.hbs                 # Standard resume template
│   └── cover-letter.hbs           # Standard cover letter template
└── styles/
    ├── base-ats.css               # ATS base styles
    ├── resume-ats.css             # ATS resume styles
    ├── cover-letter-ats.css       # ATS cover letter styles
    ├── base.css                   # Standard base styles
    ├── resume.css                 # Standard resume styles
    └── cover-letter.css           # Standard cover letter styles
```

## ATS Template Design Principles

### Resume Template (resume-ats.hbs)

**Structure:**
1. Contact information (centered, at top)
2. Professional summary
3. Skills (comma-separated, by category)
4. Professional experience (chronological)
5. Education
6. Projects
7. Certifications

**Key Features:**
- Single-column layout
- Standard HTML elements only (`<h1>`, `<h2>`, `<h3>`, `<p>`, `<ul>`, `<li>`)
- No tables, divs with complex layouts, or flexbox
- All dates in consistent format
- Company names and job titles clearly separated
- Bullet points for achievements

### Cover Letter Template (cover-letter-ats.hbs)

**Structure:**
1. Contact information (centered, at top)
2. Date
3. Recipient information
4. Salutation
5. Body paragraphs
6. Closing
7. Signature

**Key Features:**
- Business letter format
- Simple paragraph structure
- Left-aligned body text
- No decorative elements
- Standard salutation and closing

## CSS Design Principles

### Base ATS Styles (base-ats.css)

- **Font:** Arial, Helvetica, sans-serif (11pt body, 18pt h1, 14pt h2)
- **Colors:** Pure black (#000000) text, white background
- **Spacing:** Consistent margins and padding (0.5in standard)
- **Layout:** No floats, no flexbox, no grid
- **Lists:** Standard disc bullets, left margin 0.25in

### No-Nos in ATS CSS

❌ **Avoid:**
- Background colors or images
- Colored text (except black)
- Custom fonts (@font-face)
- Complex positioning (absolute, fixed)
- Multi-column layouts (columns, flexbox, grid)
- Rotated or transformed text
- Text shadows, gradients
- Borders (except simple 1pt solid black)

## Puppeteer PDF Options

### ATS-Optimized Options

```typescript
{
  format: 'A4' | 'Letter',         // Standard paper sizes
  margin: {
    top: '0.5in',
    right: '0.5in',
    bottom: '0.5in',
    left: '0.5in',
  },
  printBackground: false,          // No backgrounds for ATS
  displayHeaderFooter: false,      // No headers/footers
  preferCSSPageSize: false,        // Use format setting
  tagged: true,                    // UA accessibility (helps ATS)
  outline: true,                   // Document outline
}
```

### Standard Options

```typescript
{
  format: 'A4',
  margin: {
    top: '20mm',
    right: '20mm',
    bottom: '20mm',
    left: '20mm',
  },
  printBackground: true,           // Allow backgrounds/colors
  displayHeaderFooter: false,
  preferCSSPageSize: false,
}
```

## PDF Metadata

### Required Fields

1. **Title** (Critical)
   - Format: "Resume - [Full Name]" or "Cover Letter - [Position]"
   - Example: "Resume - Jane Doe"

2. **Author** (Critical)
   - Candidate's full name
   - Example: "Jane Doe"

3. **Subject** (Recommended)
   - Brief description
   - Example: "Software Engineer Application"

4. **Keywords** (Recommended)
   - Array of relevant skills/technologies
   - Example: ['JavaScript', 'React', 'Node.js', 'AWS']

5. **Creator** (Optional)
   - Application name
   - Example: "Smart Apply"

### Metadata Injection

```typescript
// Load PDF
const pdfDoc = await PDFDocument.load(pdfBuffer);

// Set metadata
pdfDoc.setTitle(metadata.title);
pdfDoc.setAuthor(metadata.author);
pdfDoc.setSubject(metadata.subject);
pdfDoc.setKeywords(metadata.keywords);
pdfDoc.setCreator(metadata.creator || 'Smart Apply');

// Set dates
pdfDoc.setCreationDate(new Date());
pdfDoc.setModificationDate(new Date());

// Save
const pdfBytes = await pdfDoc.save();
```

## Future Enhancements

### Potential Improvements

1. **Text Extraction Validation**
   - Use pdf-parse or pdfjs-dist to extract and verify text
   - Ensure text extraction matches source content

2. **Font Detection**
   - Parse PDF content streams to identify actual fonts used
   - Warn if non-standard fonts are detected

3. **Layout Analysis**
   - Analyze text positioning to detect multi-column layouts
   - Calculate text density and reading order

4. **ATS Template Variations**
   - Multiple ATS-safe templates with different layouts
   - Industry-specific ATS templates (tech, finance, healthcare)

5. **A/B Testing**
   - Track success rates for ATS vs standard formats
   - Optimize templates based on user feedback

6. **Real ATS Testing**
   - Submit PDFs to test ATS systems (Workday, Taleo, Greenhouse)
   - Verify parsing accuracy and field mapping

## Known Limitations

1. **Font Detection**: pdf-lib doesn't provide `getEmbeddedFonts()` API, so font validation is heuristic
2. **Layout Analysis**: Complex layout detection is basic (form fields + annotations only)
3. **Text Extraction**: No actual text extraction/validation (assumes Puppeteer generates correct PDFs)
4. **Puppeteer Dependency**: Requires Chrome/Chromium to be installed
5. **No Real ATS Testing**: Validation is based on best practices, not actual ATS system testing

## Troubleshooting

### PDF Generation Fails

**Symptom:** Error "Puppeteer initialization failed"

**Solutions:**
- Install Chromium: `apt-get install chromium-browser` (Linux)
- Set PUPPETEER_EXECUTABLE_PATH env var
- Use PUPPETEER_SKIP_DOWNLOAD=true for npm install
- Check logs for specific error

### ATS Validation Returns Low Score

**Symptom:** Score < 60 despite using ATS template

**Check:**
1. Metadata is set (title + author required)
2. PDF was generated with `atsOptimized: true`
3. No form fields or complex layouts added
4. Puppeteer generated PDF correctly

### Tests Fail in CI/CD

**Symptom:** Integration tests timeout or fail

**Solutions:**
- Increase test timeout: `--testTimeout=40000`
- Install Chromium in CI environment
- Use headless mode: `headless: 'new'`
- Check browser launch errors in logs

## Support

For questions or issues:
- **Documentation:** [ATS_OPTIMIZATION.md](./ATS_OPTIMIZATION.md)
- **Tests:** See test files for usage examples
- **Code:** Check service implementations for details
- **Issues:** [GitHub Issues](https://github.com/Ar1anit/smart-apply/issues)

---

**Last Updated:** 2025-11-26
**Version:** 1.0.0
