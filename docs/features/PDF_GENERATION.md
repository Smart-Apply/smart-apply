# Professional PDF Generation Guide

This document describes the enhanced PDF generation system for Smart Apply, which creates professional, HR-ready resumes and cover letters.

## Overview

The PDF generation system uses:

- **Puppeteer** for HTML to PDF conversion
- **Handlebars** for template rendering
- **Professional CSS** with Azure blue accent colors
- **Structured data formats** for precise control

## Architecture

```text
LLM Service
    ↓
Structured Data (JSON/HTML)
    ↓
Template Renderer Service
    ↓
HTML with embedded CSS
    ↓
PDF Service (Puppeteer)
    ↓
Professional PDF
```

## Usage

### Cover Letter Generation

```typescript
import { PdfService } from './pdf/pdf.service';

const coverLetterData = {
  candidateName: 'Jane Smith',
  email: 'jane@example.com',
  phone: '+1 555-0123',
  linkedin: 'https://linkedin.com/in/janesmith',
  github: 'https://github.com/janesmith',
  location: 'San Francisco, CA',
  companyName: 'Tech Company Inc.',
  recipientName: 'Hiring Manager',
  content: `
    <p>Opening paragraph expressing interest...</p>

    <div class="key-qualifications">
      <h3>Why I'm an Excellent Fit</h3>
      <ul>
        <li class="achievement">Built microservices serving <span class="metric">1M+ users</span></li>
        <li class="metric">Improved performance by <span class="metric">40%</span></li>
      </ul>
    </div>

    <div class="motivation-section">
      <p>Why I want to work at this company...</p>
    </div>

    <p>Closing paragraph...</p>
  `,
  closingPhrase: 'Sincerely,', // Optional, defaults to "Sincerely,"
};

const pdf = await pdfService.generateCoverLetterPDF(coverLetterData);
```

### Resume Generation

```typescript
const resumeData = {
  candidateName: 'John Developer',
  email: 'john@example.com',
  phone: '+1 555-9876',
  linkedin: 'https://linkedin.com/in/johndev',
  github: 'https://github.com/johndev',
  location: 'San Francisco, CA',

  summary: 'Senior engineer with 8+ years experience...',

  skillCategories: [
    {
      type: 'Languages', // Will show 💻 icon
      skills: ['TypeScript', 'Python', 'Go'],
    },
    {
      type: 'Frameworks', // Will show ⚙️ icon
      skills: ['NestJS', 'React', 'FastAPI'],
    },
    {
      type: 'Cloud', // Will show ☁️ icon
      skills: ['Azure', 'AWS', 'Docker'],
    },
    {
      type: 'Databases', // Will show 🗄️ icon
      skills: ['PostgreSQL', 'MongoDB', 'Redis'],
    },
    {
      type: 'Tools', // Will show 🔧 icon
      skills: ['Git', 'CI/CD', 'Kubernetes'],
    },
  ],

  experiences: [
    {
      title: 'Senior Software Engineer',
      company: 'Tech Corp',
      location: 'San Francisco, CA',
      dateRange: 'Jan 2020 - Present',
      achievements: [
        'Led development serving <span class="metric">1M+ users</span>',
        'Improved performance by <span class="metric">40%</span>',
        'Mentored team of 5 developers',
      ],
    },
  ],

  projects: [
    {
      name: 'Cool Project',
      description: 'Brief description',
      date: '2025',
      highlights: [
        'Built feature X',
        'Achieved Y improvement',
      ],
    },
  ],

  education: [
    {
      degree: 'Bachelor of Science in Computer Science',
      institution: 'Stanford University',
      year: '2017',
    },
  ],

  certifications: [
    {
      name: 'Azure Solutions Architect Expert',
      issuer: 'Microsoft',
      date: '2024',
    },
  ],
};

const pdf = await pdfService.generateResumePDF(resumeData);
```

## CSS Classes and Styling

### Cover Letter Classes

| Class                 | Purpose                            | Visual Effect                     |
| --------------------- | ---------------------------------- | --------------------------------- |
| `.key-qualifications` | Highlight important qualifications | Gray background, blue left border |
| `.achievement`        | Mark achievement-focused items     | 🎯 icon before text               |
| `.metric`             | Highlight data-driven points       | 📊 icon before text               |
| `.motivation-section` | Emphasize motivation paragraph     | Gray left border                  |

### Resume Classes

| Class                              | Purpose               | Icon |
| ---------------------------------- | --------------------- | ---- |
| `.skill-category-title.languages`  | Programming languages | 💻   |
| `.skill-category-title.frameworks` | Frameworks/libraries  | ⚙️   |
| `.skill-category-title.cloud`      | Cloud technologies    | ☁️   |
| `.skill-category-title.databases`  | Database systems      | 🗄️   |
| `.skill-category-title.tools`      | Development tools     | 🔧   |
| `.skill-category-title.other`      | Other skills          | 📦   |

### Metric Highlighting

Wrap numbers in `<span class="metric">` tags to highlight them:

```html
Improved performance by <span class="metric">40%</span> Serving
<span class="metric">1M+ users</span> Reduced costs by <span class="metric">$50K/year</span>
```

## LLM Prompt Integration

### Cover Letter Prompt

The LLM should generate HTML content with proper semantic structure:

```html
<p>Opening paragraph...</p>

<div class="key-qualifications">
  <h3>Why I'm an Excellent Fit</h3>
  <ul>
    <li class="achievement">Achievement with impact</li>
    <li class="metric">
      Data-driven accomplishment with <span class="metric">42%</span> improvement
    </li>
  </ul>
</div>

<div class="motivation-section">
  <p>Motivation paragraph...</p>
</div>

<p>Closing paragraph...</p>
```

### Resume Prompt

The LLM should generate structured JSON:

```json
{
  "summary": "2-3 sentence professional summary",
  "skillCategories": [
    { "type": "Languages", "skills": ["TypeScript", "Python"] },
    { "type": "Cloud", "skills": ["Azure", "AWS"] }
  ],
  "experiences": [
    {
      "title": "Senior Engineer",
      "company": "Tech Corp",
      "dateRange": "Jan 2020 - Present",
      "achievements": [
        "Led project serving <span class='metric'>1M+ users</span>",
        "Improved performance by <span class='metric'>40%</span>"
      ]
    }
  ]
}
```

## Design Principles

### Typography

- **Primary Font**: System fonts (similar to Calibri/Open Sans)
- **H1**: 26-28pt for names
- **H2**: 16pt for section titles
- **Body**: 11pt for readable text
- **Small**: 9-10pt for metadata

### Colors

- **Primary Accent**: Azure Blue (#0066cc)
- **Text**: Dark Gray (#2c3e50)
- **Muted**: Medium Gray (#6c757d)
- **Background Accents**: Light Gray/Blue (#f7fafc)

### Spacing

- **Section Margins**: 16-20pt between sections
- **Line Height**: 1.5-1.6 for body text
- **List Items**: 4-6pt spacing
- **Page Margins**:
  - Cover Letter: 20-25mm
  - Resume: 15-20mm

### Visual Hierarchy

1. **Name** (largest, bold, centered)
2. **Section Titles** (uppercase, blue, border-bottom)
3. **Experience Titles** (bold, 12pt)
4. **Body Text** (regular, 11pt)
5. **Metadata** (small, gray, 9-10pt)

## Best Practices

### Cover Letters

- ✅ Keep to 1 page (300-400 words)
- ✅ Use 3-5 bullet points in key qualifications
- ✅ Highlight 2-3 key metrics
- ✅ Professional yet personable tone
- ✅ Clear visual hierarchy

### Resumes

- ✅ Max 2 pages
- ✅ Most recent experience first
- ✅ Quantify achievements with metrics
- ✅ Use strong action verbs
- ✅ Categorize skills logically
- ✅ Consistent formatting

### Metrics

- ✅ Use percentages (40% improvement)
- ✅ Include scale (1M+ users)
- ✅ Show time savings (2hrs → 15min)
- ✅ Mention team size (led 5 engineers)
- ✅ Include monetary impact ($50K saved)

## Backward Compatibility

The legacy `generatePDF(html, options)` method still works:

```typescript
// Legacy method (still supported)
const html = `<html>...</html>`;
const pdf = await pdfService.generatePDF(html, {
  template: 'cover-letter' // or 'resume'
});
```

## Files and Structure

```text
apps/api/src/pdf/
├── pdf.service.ts              # Main PDF generation service
├── pdf.module.ts               # Module configuration
├── template-renderer.service.ts # Handlebars rendering
├── templates/
│   ├── cover-letter.hbs        # Cover letter HTML template
│   └── resume.hbs              # Resume HTML template
└── styles/
    ├── base.css                # Shared base styles
    ├── cover-letter.css        # Cover letter specific styles
    └── resume.css              # Resume specific styles
```

## Testing

```typescript
// Unit tests
npm test -- template-renderer.service.spec.ts

// Integration tests (requires Puppeteer)
npm test -- pdf.integration.spec.ts
```

## Troubleshooting

### Puppeteer Issues

If Puppeteer fails to initialize:

1. Check `PUPPETEER_EXECUTABLE_PATH` environment variable
2. Ensure Chromium is installed in production
3. Use `--no-sandbox` flag in containerized environments

### Template Not Found

Ensure templates are included in the build:

1. Check `nest-cli.json` for asset compilation
2. Verify template files are in `dist/` after build
3. Check file paths are correct for your environment

### Styling Issues

- Ensure CSS is properly embedded in HTML
- Check for conflicting styles
- Verify Puppeteer `printBackground: true` is set
- Test with different page sizes (A4 vs Letter)

## Performance

- **Cold Start**: 2-5 seconds (browser initialization)
- **Subsequent Renders**: 500ms-1s per PDF
- **Memory**: ~100-200MB per browser instance
- **Optimization**: Reuse browser instance across requests

## Future Enhancements

- [ ] Multiple template styles (Modern, Classic, Minimal)
- [ ] Configurable color schemes
- [ ] Two-column resume layout
- [ ] QR code support for LinkedIn/Portfolio
- [ ] Template preview API endpoint
- [ ] PDF optimization/compression
