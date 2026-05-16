#!/usr/bin/env node
/**
 * Template Creation CLI Helper
 * ============================
 * Creates a new template folder with boilerplate files.
 * 
 * Usage:
 *   pnpm template:create <template-name>
 *   npx ts-node scripts/create-template.ts <template-name>
 * 
 * Example:
 *   pnpm template:create corporate-blue
 *   
 * This will create:
 *   templates/corporate-blue/
 *   ├── config.json      # Template metadata
 *   └── styles.css       # Template-specific styles
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// HELPERS
// =============================================================================

function kebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function titleCase(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getTemplatesDir(): string {
  // Navigate from scripts folder to templates
  return path.join(__dirname, '..', 'src', 'pdf', 'templates');
}

// =============================================================================
// TEMPLATES
// =============================================================================

function generateConfig(id: string, name: string): string {
  return JSON.stringify({
    id,
    name,
    description: `${name} template - customize this description`,
    category: 'Professional',
    isDefault: false,
    isAtsOptimized: true,
    previewColor: '#1e3a5f',
  }, null, 2);
}

function generateCSS(name: string): string {
  return `/* ${name} Template - ATS-Optimized */
/* Customize this template */

:root {
  --primary-color: #1e3a5f;      /* Main accent color */
  --secondary-color: #2c5282;    /* Secondary accent */
  --accent-color: #3182ce;       /* Highlights */
  --text-primary: #1a202c;       /* Main text */
  --text-secondary: #4a5568;     /* Muted text */
  --border-color: #e2e8f0;       /* Borders */
  --background: #ffffff;         /* Page background */
}

body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 10.5pt;
  line-height: 1.5;
  padding: 0.6in 0.7in;
}

/* ============================================
   HEADER - Name & Contact
   ============================================ */
.resume-header,
.header {
  text-align: center;
  padding-bottom: 0.2in;
  margin-bottom: 0.2in;
  border-bottom: 2pt solid var(--primary-color);
}

h1 {
  font-size: 24pt;
  font-weight: 700;
  color: var(--primary-color);
  margin-bottom: 0.1in;
}

.contact-info {
  font-size: 9.5pt;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* ============================================
   SECTION HEADERS
   ============================================ */
h2 {
  font-size: 11pt;
  font-weight: 700;
  color: var(--primary-color);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top: 0.18in;
  margin-bottom: 0.1in;
  padding-bottom: 0.06in;
  border-bottom: 1.5pt solid var(--primary-color);
}

h3 {
  font-size: 11pt;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.02in;
}

/* ============================================
   PROFESSIONAL SUMMARY
   ============================================ */
.summary-section {
  margin-bottom: 0.15in;
}

.summary-section p {
  color: var(--text-secondary);
  font-size: 10pt;
  line-height: 1.6;
}

/* ============================================
   EXPERIENCE & EDUCATION
   ============================================ */
.experience-item,
.education-item,
.project-item {
  margin-bottom: 0.15in;
}

.experience-title,
.project-title {
  font-size: 11pt;
  font-weight: 600;
  color: var(--text-primary);
}

.experience-company {
  font-size: 10pt;
  color: var(--secondary-color);
  font-weight: 500;
  margin-bottom: 0.02in;
}

.experience-date,
.project-date,
.education-date {
  font-size: 9.5pt;
  color: var(--text-secondary);
  font-style: italic;
}

/* ============================================
   LISTS
   ============================================ */
li {
  font-size: 10pt;
  color: var(--text-primary);
}

/* ============================================
   SKILLS
   ============================================ */
.skill-category {
  margin-bottom: 0.08in;
}

.skill-category-title {
  font-weight: 600;
  color: var(--primary-color);
  display: inline;
  font-size: 10pt;
}

.skill-list {
  display: inline;
  color: var(--text-primary);
  font-size: 10pt;
}

/* ============================================
   EDUCATION
   ============================================ */
.education-degree {
  font-size: 11pt;
  font-weight: 600;
  color: var(--text-primary);
}

.education-institution {
  font-size: 10pt;
  color: var(--secondary-color);
}

/* ============================================
   PRINT
   ============================================ */
@media print {
  body {
    padding: 0.5in;
  }
}
`;
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
📝 Template Creation Helper
===========================

Usage:
  pnpm template:create <template-name>

Examples:
  pnpm template:create corporate-blue
  pnpm template:create minimalist-serif
  pnpm template:create tech-gradient

Options:
  --help    Show this help message
`);
    process.exit(0);
  }
  
  if (args[0] === '--help' || args[0] === '-h') {
    console.log(`
📝 Template Creation Helper
===========================

This script creates a new template folder with boilerplate files.

Usage:
  pnpm template:create <template-name>

Arguments:
  template-name    Name of the new template (kebab-case recommended)

Example:
  pnpm template:create corporate-blue

This creates:
  templates/corporate-blue/
  ├── config.json      # Edit to customize name, description, category
  └── styles.css       # CSS styles with CSS variables

After creation:
  1. Edit config.json with your template details
  2. Customize styles.css with your design
  3. Optionally add resume.hbs or cover-letter.hbs for custom layouts
  4. Run: pnpm prisma:seed:templates
`);
    process.exit(0);
  }
  
  const templateName = args[0];
  const templateId = kebabCase(templateName);
  const displayName = titleCase(templateId);
  
  const templatesDir = getTemplatesDir();
  const templateDir = path.join(templatesDir, templateId);
  
  // Check if directory exists
  if (fs.existsSync(templateDir)) {
    console.error(`❌ Template folder already exists: ${templateDir}`);
    process.exit(1);
  }
  
  // Create directory
  fs.mkdirSync(templateDir, { recursive: true });
  console.log(`📁 Created folder: ${templateDir}`);
  
  // Create config.json
  const configPath = path.join(templateDir, 'config.json');
  fs.writeFileSync(configPath, generateConfig(templateId, displayName));
  console.log(`📄 Created: config.json`);
  
  // Create styles.css
  const stylesPath = path.join(templateDir, 'styles.css');
  fs.writeFileSync(stylesPath, generateCSS(displayName));
  console.log(`🎨 Created: styles.css`);
  
  console.log(`
✅ Template "${displayName}" created successfully!

Next steps:
  1. Edit ${configPath}
     - Update description and category
     - Set isAtsOptimized based on your design
  
  2. Customize ${stylesPath}
     - Modify CSS variables for colors
     - Adjust typography and spacing
  
  3. (Optional) Add custom HBS templates:
     - resume.hbs for custom resume layout
     - cover-letter.hbs for custom cover letter layout
  
  4. Seed the database:
     pnpm --filter @smart-apply/api prisma:seed:templates

  5. Test your template in the application!
`);
}

main();
