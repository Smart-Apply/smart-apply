import { PrismaClient, TemplateType } from '../src/generated/prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Prisma 7: Empty object for CLI-based seeds
const prisma = new PrismaClient({} as any);

// =============================================================================
// DYNAMIC TEMPLATE DISCOVERY
// =============================================================================
// This seed script automatically discovers available templates and CSS files.
// To add a new template:
// 1. Create CSS file in src/pdf/styles/<name>.css
// 2. Optionally create custom HBS in src/pdf/templates/<name>.hbs
// 3. Add entry to TEMPLATE_CONFIGS below
// =============================================================================

interface TemplateConfig {
  id: string; // Unique identifier (e.g., 'modern-professional')
  name: string; // Display name
  description: string; // Description for users
  category: string; // Category (Professional, Minimal, etc.)
  cssFile: string; // CSS filename (e.g., 'modern-professional.css')
  resumeHbs?: string; // Optional: Custom resume HBS (defaults to 'resume-ats.hbs')
  coverLetterHbs?: string; // Optional: Custom cover letter HBS (defaults to 'cover-letter-ats.hbs')
  isDefault?: boolean; // Is this the default template?
  isAtsOptimized?: boolean; // ATS-friendly design (default: true)
}

// Template configurations - add new templates here
const TEMPLATE_CONFIGS: TemplateConfig[] = [
  {
    id: 'modern-professional',
    name: 'Modern Professional',
    description: 'Clean design with navy blue accents. ATS-optimized for corporate roles.',
    category: 'Professional',
    cssFile: 'modern-professional.css',
    isDefault: true,
    isAtsOptimized: true,
  },
  {
    id: 'elegant-minimal',
    name: 'Elegant Minimal',
    description: 'Sophisticated, understated design with elegant typography.',
    category: 'Minimal',
    cssFile: 'elegant-minimal.css',
    isAtsOptimized: true,
  },
  {
    id: 'tech-modern',
    name: 'Tech Modern',
    description: 'Developer-focused design with subtle tech aesthetics.',
    category: 'Technical',
    cssFile: 'tech-modern.css',
    isAtsOptimized: true,
  },
  {
    id: 'executive-classic',
    name: 'Executive Classic',
    description: 'Traditional serif design for senior and executive positions.',
    category: 'Executive',
    cssFile: 'executive-classic.css',
    isAtsOptimized: true,
  },
  {
    id: 'harvard-classic',
    name: 'Harvard Classic',
    description: 'Academic style with Times New Roman, inspired by Ivy League formats.',
    category: 'Academic',
    cssFile: 'harvard-classic.css',
    isAtsOptimized: true,
  },
  {
    id: 'modern-minimal-two-column',
    name: 'Modern Minimal Two-Column',
    description: 'Creative two-column layout with sidebar. Not ATS-optimized.',
    category: 'Creative',
    cssFile: 'modern-minimal-two-column.css',
    resumeHbs: 'resume-two-column.hbs',
    coverLetterHbs: 'cover-letter-modern-minimal.hbs',
    isAtsOptimized: false,
  },
  {
    id: 'modern-clean',
    name: 'Modern Clean',
    description: 'German-style clean design with multilingual support.',
    category: 'Professional',
    cssFile: 'modern-clean.css',
    resumeHbs: 'resume-modern-clean.hbs',
    isAtsOptimized: true,
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getBasePath(): string {
  let basePath = __dirname;
  if (basePath.endsWith('dist')) {
    basePath = path.join(basePath, '..');
  }
  return basePath;
}

function getTemplatesDir(): string {
  return path.join(getBasePath(), '..', 'src', 'pdf', 'templates');
}

function getStylesDir(): string {
  return path.join(getBasePath(), '..', 'src', 'pdf', 'styles');
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function readFileIfExists(filePath: string): string | null {
  if (fileExists(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return null;
}

function readFileOrThrow(filePath: string, description: string): string {
  if (!fileExists(filePath)) {
    throw new Error(`Required file not found: ${filePath} (${description})`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

// =============================================================================
// DYNAMIC TEMPLATE SEEDING
// =============================================================================

async function seedDynamicTemplates() {
  console.log('🎨 Seeding templates dynamically...\n');

  const templatesDir = getTemplatesDir();
  const stylesDir = getStylesDir();

  console.log(`📁 Templates directory: ${templatesDir}`);
  console.log(`📁 Styles directory: ${stylesDir}\n`);

  // Default HBS templates (fallbacks)
  const defaultResumeHbs = 'resume-ats.hbs';
  const defaultCoverLetterHbs = 'cover-letter-ats.hbs';

  // Read default templates
  const defaultResumeHTML = readFileOrThrow(
    path.join(templatesDir, defaultResumeHbs),
    'Default resume template',
  );
  const defaultCoverLetterHTML = readFileOrThrow(
    path.join(templatesDir, defaultCoverLetterHbs),
    'Default cover letter template',
  );

  let totalCreated = 0;
  let skipped = 0;

  for (const config of TEMPLATE_CONFIGS) {
    const cssPath = path.join(stylesDir, config.cssFile);

    // Check if CSS file exists
    if (!fileExists(cssPath)) {
      console.log(`⚠️  Skipping "${config.name}": CSS file not found (${config.cssFile})`);
      skipped++;
      continue;
    }

    const cssStyles = fs.readFileSync(cssPath, 'utf-8');

    // Get resume HTML (custom or default)
    let resumeHTML = defaultResumeHTML;
    if (config.resumeHbs) {
      const customResumePath = path.join(templatesDir, config.resumeHbs);
      const customResumeHTML = readFileIfExists(customResumePath);
      if (customResumeHTML) {
        resumeHTML = customResumeHTML;
        console.log(`   📄 Using custom resume HBS: ${config.resumeHbs}`);
      } else {
        console.log(`   ⚠️  Custom resume HBS not found (${config.resumeHbs}), using default`);
      }
    }

    // Get cover letter HTML (custom or default)
    let coverLetterHTML = defaultCoverLetterHTML;
    if (config.coverLetterHbs) {
      const customCoverLetterPath = path.join(templatesDir, config.coverLetterHbs);
      const customCoverLetterHTML = readFileIfExists(customCoverLetterPath);
      if (customCoverLetterHTML) {
        coverLetterHTML = customCoverLetterHTML;
        console.log(`   📄 Using custom cover letter HBS: ${config.coverLetterHbs}`);
      } else {
        console.log(
          `   ⚠️  Custom cover letter HBS not found (${config.coverLetterHbs}), using default`,
        );
      }
    }

    // Generate unique base IDs for this design
    const coverLetterBaseId = uuidv4();
    const resumeBaseId = uuidv4();

    console.log(`\n✨ Creating "${config.name}" (${config.category}):`);

    // 1. Create Resume Template
    const resumeId = `${config.id}-resume`;
    await prisma.template.upsert({
      where: { id: resumeId },
      update: {
        htmlTemplate: resumeHTML,
        cssStyles: cssStyles,
        name: config.name,
        description: config.description,
        category: config.category,
        baseTemplateId: resumeBaseId,
        isActive: true,
        isDefault: config.isDefault ?? false,
      },
      create: {
        id: resumeId,
        name: config.name,
        description: config.description,
        type: TemplateType.RESUME,
        category: config.category,
        baseTemplateId: resumeBaseId,
        htmlTemplate: resumeHTML,
        cssStyles: cssStyles,
        isActive: true,
        isDefault: config.isDefault ?? false,
      },
    });
    console.log(`   ✓ Resume: ${resumeId}`);
    totalCreated++;

    // 2. Create Cover Letter Template
    const coverLetterId = `${config.id}-cover-letter`;
    await prisma.template.upsert({
      where: { id: coverLetterId },
      update: {
        htmlTemplate: coverLetterHTML,
        cssStyles: cssStyles,
        name: config.name,
        description: config.description,
        category: config.category,
        baseTemplateId: coverLetterBaseId,
        isActive: true,
        isDefault: config.isDefault ?? false,
      },
      create: {
        id: coverLetterId,
        name: config.name,
        description: config.description,
        type: TemplateType.COVER_LETTER,
        category: config.category,
        baseTemplateId: coverLetterBaseId,
        htmlTemplate: coverLetterHTML,
        cssStyles: cssStyles,
        isActive: true,
        isDefault: config.isDefault ?? false,
      },
    });
    console.log(`   ✓ Cover Letter: ${coverLetterId}`);
    totalCreated++;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Created: ${totalCreated} templates (${totalCreated / 2} designs × 2 types)`);
  if (skipped > 0) {
    console.log(`⚠️  Skipped: ${skipped} templates (missing CSS files)`);
  }
  console.log(`${'='.repeat(60)}`);
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

seedDynamicTemplates()
  .then(() => {
    console.log('\n🎉 Template seeding completed!');
  })
  .catch((error) => {
    console.error('❌ Error seeding templates:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
