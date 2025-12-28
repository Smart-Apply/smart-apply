/**
 * Auto-Discovery Template Seed Script
 * ====================================
 * Automatically discovers and seeds templates from the folder structure.
 * 
 * Template folder structure:
 *   templates/
 *   ├── _base/                    # Base files (not a template)
 *   │   ├── base.css              # Common styles inherited by all
 *   │   ├── resume.hbs            # Default resume template
 *   │   └── cover-letter.hbs      # Default cover letter template
 *   ├── modern-professional/      # Template folder
 *   │   ├── config.json           # Template metadata
 *   │   ├── styles.css            # Template-specific styles
 *   │   ├── resume.hbs            # Optional custom resume
 *   │   └── cover-letter.hbs      # Optional custom cover letter
 *   └── ...
 * 
 * config.json schema:
 *   {
 *     "id": "template-id",
 *     "name": "Display Name",
 *     "description": "Template description",
 *     "category": "Professional|Minimal|Technical|Executive|Academic|Creative",
 *     "isDefault": false,
 *     "isAtsOptimized": true,
 *     "previewColor": "#hex",
 *     "customTemplates": {
 *       "resume": "resume.hbs",
 *       "coverLetter": "cover-letter.hbs"
 *     }
 *   }
 * 
 * Usage:
 *   npm run prisma:seed:templates
 */

import { PrismaClient, TemplateType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// =============================================================================
// TYPES
// =============================================================================

interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  isDefault?: boolean;
  isAtsOptimized?: boolean;
  previewColor?: string;
  customTemplates?: {
    resume?: string;
    coverLetter?: string;
  };
}

interface DiscoveredTemplate {
  folderName: string;
  folderPath: string;
  config: TemplateConfig;
  hasCustomResume: boolean;
  hasCustomCoverLetter: boolean;
}

// =============================================================================
// PATH HELPERS
// =============================================================================

function getBasePath(): string {
  let basePath = __dirname;
  // Handle both development (src) and compiled (dist) modes
  if (basePath.includes('/dist/')) {
    // In compiled mode, go back to project root
    basePath = path.join(basePath, '../../..');
  }
  return basePath;
}

function getTemplatesDir(): string {
  const basePath = getBasePath();
  // Try multiple possible locations
  const possiblePaths = [
    path.join(basePath, 'src/pdf/templates'),
    path.join(basePath, '../src/pdf/templates'),
    path.join(basePath, '../../apps/api/src/pdf/templates'),
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  
  // Default fallback
  return path.join(basePath, 'src/pdf/templates');
}

// =============================================================================
// TEMPLATE DISCOVERY
// =============================================================================

function discoverTemplates(templatesDir: string): DiscoveredTemplate[] {
  const discovered: DiscoveredTemplate[] = [];
  
  if (!fs.existsSync(templatesDir)) {
    console.error(`❌ Templates directory not found: ${templatesDir}`);
    return discovered;
  }
  
  const entries = fs.readdirSync(templatesDir, { withFileTypes: true });
  
  for (const entry of entries) {
    // Skip non-directories and special folders
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) {
      continue;
    }
    
    const folderPath = path.join(templatesDir, entry.name);
    const configPath = path.join(folderPath, 'config.json');
    const stylesPath = path.join(folderPath, 'styles.css');
    
    // Must have config.json
    if (!fs.existsSync(configPath)) {
      console.log(`⚠️  Skipping "${entry.name}": No config.json found`);
      continue;
    }
    
    // Must have styles.css
    if (!fs.existsSync(stylesPath)) {
      console.log(`⚠️  Skipping "${entry.name}": No styles.css found`);
      continue;
    }
    
    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config: TemplateConfig = JSON.parse(configContent);
      
      // Validate required fields
      if (!config.id || !config.name || !config.category) {
        console.log(`⚠️  Skipping "${entry.name}": Invalid config (missing id, name, or category)`);
        continue;
      }

      // Check for custom templates
      const hasCustomResume: boolean =
        fs.existsSync(path.join(folderPath, 'resume.hbs')) ||
        (config.customTemplates?.resume
          ? fs.existsSync(path.join(folderPath, config.customTemplates.resume))
          : false);
      const hasCustomCoverLetter: boolean =
        fs.existsSync(path.join(folderPath, 'cover-letter.hbs')) ||
        (config.customTemplates?.coverLetter
          ? fs.existsSync(path.join(folderPath, config.customTemplates.coverLetter))
          : false);

      discovered.push({
        folderName: entry.name,
        folderPath,
        config,
        hasCustomResume,
        hasCustomCoverLetter,
      });
    } catch (error) {
      console.log(`⚠️  Skipping "${entry.name}": Failed to parse config.json - ${error.message}`);
    }
  }

  return discovered;
}

// =============================================================================
// FILE READING
// =============================================================================

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

function readBaseCSS(templatesDir: string): string {
  const baseCssPath = path.join(templatesDir, '_base', 'base.css');
  if (fs.existsSync(baseCssPath)) {
    return readFile(baseCssPath);
  }
  console.log('⚠️  No _base/base.css found, skipping base styles');
  return '';
}

function readDefaultTemplate(templatesDir: string, type: 'resume' | 'cover-letter'): string {
  const defaultPath = path.join(templatesDir, '_base', `${type}.hbs`);
  if (fs.existsSync(defaultPath)) {
    return readFile(defaultPath);
  }
  throw new Error(`Default ${type} template not found at ${defaultPath}`);
}

// =============================================================================
// SEEDING
// =============================================================================

async function seedTemplates() {
  console.log('🎨 Auto-discovering and seeding templates...\n');
  
  const templatesDir = getTemplatesDir();
  console.log(`📁 Templates directory: ${templatesDir}\n`);
  
  // Discover templates
  const templates = discoverTemplates(templatesDir);
  
  if (templates.length === 0) {
    console.log('❌ No templates discovered. Check your folder structure.');
    return;
  }

  console.log(`📦 Discovered ${templates.length} templates:\n`);
  templates.forEach((t) => {
    const flags = [
      t.config.isDefault ? '⭐ default' : '',
      t.config.isAtsOptimized !== false ? '✓ ATS' : '⚠️ non-ATS',
      t.hasCustomResume ? '📄 custom resume' : '',
      t.hasCustomCoverLetter ? '✉️ custom cover' : '',
    ]
      .filter(Boolean)
      .join(', ');
    console.log(`   • ${t.config.name} (${t.config.category}) [${flags}]`);
  });
  console.log();
  
  // Read base CSS and default templates
  const baseCSS = readBaseCSS(templatesDir);
  const defaultResumeHBS = readDefaultTemplate(templatesDir, 'resume');
  const defaultCoverLetterHBS = readDefaultTemplate(templatesDir, 'cover-letter');
  
  let totalCreated = 0;
  let totalUpdated = 0;
  for (const template of templates) {
    console.log(`\n✨ Processing "${template.config.name}"...`);

    // Read template-specific CSS
    const templateCSS = readFile(path.join(template.folderPath, 'styles.css'));

    // Combine base + template CSS
    const combinedCSS = baseCSS
      ? `${baseCSS}\n\n/* Template: ${template.config.name} */\n${templateCSS}`
      : templateCSS;

    // Get resume HBS
    let resumeHBS = defaultResumeHBS;
    if (template.hasCustomResume) {
      const customPath = template.config.customTemplates?.resume || 'resume.hbs';
      resumeHBS = readFile(path.join(template.folderPath, customPath));
      console.log(`   📄 Using custom resume template`);
    }

    // Get cover letter HBS
    let coverLetterHBS = defaultCoverLetterHBS;
    if (template.hasCustomCoverLetter) {
      const customPath = template.config.customTemplates?.coverLetter || 'cover-letter.hbs';
      coverLetterHBS = readFile(path.join(template.folderPath, customPath));
      console.log(`   ✉️  Using custom cover letter template`);
    }
    
    // Upsert Resume Template
    const resumeId = `${template.config.id}-resume`;
    const existingResume = await prisma.template.findUnique({ where: { id: resumeId } });
    
    await prisma.template.upsert({
      where: { id: resumeId },
      update: {
        name: template.config.name,
        description: template.config.description,
        category: template.config.category,
        htmlTemplate: resumeHBS,
        cssStyles: combinedCSS,
        isActive: true,
        isDefault: template.config.isDefault ?? false,
      },
      create: {
        id: resumeId,
        name: template.config.name,
        description: template.config.description,
        type: TemplateType.RESUME,
        category: template.config.category,
        htmlTemplate: resumeHBS,
        cssStyles: combinedCSS,
        isActive: true,
        isDefault: template.config.isDefault ?? false,
      },
    });
    
    if (existingResume) {
      console.log(`   ↻ Updated: ${resumeId}`);
      totalUpdated++;
    } else {
      console.log(`   ✓ Created: ${resumeId}`);
      totalCreated++;
    }
    
    // Upsert Cover Letter Template
    const coverLetterId = `${template.config.id}-cover-letter`;
    const existingCoverLetter = await prisma.template.findUnique({ where: { id: coverLetterId } });
    
    await prisma.template.upsert({
      where: { id: coverLetterId },
      update: {
        name: template.config.name,
        description: template.config.description,
        category: template.config.category,
        htmlTemplate: coverLetterHBS,
        cssStyles: combinedCSS,
        isActive: true,
        isDefault: template.config.isDefault ?? false,
      },
      create: {
        id: coverLetterId,
        name: template.config.name,
        description: template.config.description,
        type: TemplateType.COVER_LETTER,
        category: template.config.category,
        htmlTemplate: coverLetterHBS,
        cssStyles: combinedCSS,
        isActive: true,
        isDefault: template.config.isDefault ?? false,
      },
    });
    if (existingCoverLetter) {
      console.log(`   ↻ Updated: ${coverLetterId}`);
      totalUpdated++;
    } else {
      console.log(`   ✓ Created: ${coverLetterId}`);
      totalCreated++;
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Seeding complete!`);
  console.log(`   • Created: ${totalCreated} templates`);
  console.log(`   • Updated: ${totalUpdated} templates`);
  console.log(
    `   • Total: ${totalCreated + totalUpdated} templates (${templates.length} designs × 2 types)`,
  );
  console.log(`${'='.repeat(60)}`);
}

// =============================================================================
// MAIN
// =============================================================================

seedTemplates()
  .then(() => {
    console.log('\n🎉 Template seeding completed successfully!');
  })
  .catch((error) => {
    console.error('\n❌ Error seeding templates:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
