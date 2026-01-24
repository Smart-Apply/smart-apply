import { PrismaClient, TemplateType } from '../src/generated/prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load .env from apps/api directory (one level up from prisma/seed-templates.ts)
config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

// Helper function to read template files
function readTemplateFile(filename: string): string {
  const filePath = path.join(__dirname, '../src/pdf/templates', filename);
  return fs.readFileSync(filePath, 'utf-8');
}

// Helper function to read a single CSS file
function readCSSFile(filename: string): string {
  const filePath = path.join(__dirname, '../src/pdf/styles', filename);
  return fs.readFileSync(filePath, 'utf-8');
}

// Helper function to read CSS files and combine them
function readCombinedCSS(files: string[]): string {
  const cssDir = path.join(__dirname, '../src/pdf/styles');
  return files
    .map((file) => {
      const filePath = path.join(cssDir, file);
      return fs.readFileSync(filePath, 'utf-8');
    })
    .join('\n\n');
}

async function seedTemplates() {
  console.log('🎨 Seeding templates...');

  // Read existing template files (ATS-optimized)
  const coverLetterHTML = readTemplateFile('cover-letter-ats.hbs');
  const resumeHTML = readTemplateFile('resume-ats.hbs');
  
  // Read two-column template files (Creative/Design focused)
  const coverLetterModernMinimalHTML = readTemplateFile('cover-letter-modern-minimal.hbs');
  const resumeTwoColumnHTML = readTemplateFile('resume-two-column.hbs');
  
  // Read Modern Clean multilingual template (German-style)
  const resumeModernCleanHTML = readTemplateFile('resume-modern-clean.hbs');
  
  // Read CSS files for different styles
  const modernProfessionalCSS = readCSSFile('modern-professional.css');
  const elegantMinimalCSS = readCSSFile('elegant-minimal.css');
  const techModernCSS = readCSSFile('tech-modern.css');
  const executiveClassicCSS = readCSSFile('executive-classic.css');
  const harvardClassicCSS = readCSSFile('harvard-classic.css');
  const modernMinimalTwoColumnCSS = readCSSFile('modern-minimal-two-column.css');
  const modernCleanCSS = readCSSFile('modern-clean.css');

  // ==================================================
  // COVER LETTER TEMPLATES
  // ==================================================

  // 1. Modern Professional Cover Letter (Default)
  await prisma.template.upsert({
    where: { id: 'modern-professional-cover-letter' },
    update: {
      htmlTemplate: coverLetterHTML,
      cssStyles: modernProfessionalCSS,
    },
    create: {
      id: 'modern-professional-cover-letter',
      name: 'Modern Professional',
      description: 'Clean design with navy blue accents. Perfect for corporate and professional roles.',
      type: TemplateType.COVER_LETTER,
      category: 'Professional',
      htmlTemplate: coverLetterHTML,
      cssStyles: modernProfessionalCSS,
      isActive: true,
      isDefault: true,
    },
  });

  // 2. Elegant Minimal Cover Letter
  await prisma.template.upsert({
    where: { id: 'elegant-minimal-cover-letter' },
    update: {
      htmlTemplate: coverLetterHTML,
      cssStyles: elegantMinimalCSS,
    },
    create: {
      id: 'elegant-minimal-cover-letter',
      name: 'Elegant Minimal',
      description: 'Sophisticated, understated design with elegant typography and whitespace.',
      type: TemplateType.COVER_LETTER,
      category: 'Minimal',
      htmlTemplate: coverLetterHTML,
      cssStyles: elegantMinimalCSS,
      isActive: true,
      isDefault: false,
    },
  });

  // 3. Tech Modern Cover Letter
  await prisma.template.upsert({
    where: { id: 'tech-modern-cover-letter' },
    update: {
      htmlTemplate: coverLetterHTML,
      cssStyles: techModernCSS,
    },
    create: {
      id: 'tech-modern-cover-letter',
      name: 'Tech Modern',
      description: 'Developer-focused design with subtle tech aesthetics. Great for software roles.',
      type: TemplateType.COVER_LETTER,
      category: 'Technical',
      htmlTemplate: coverLetterHTML,
      cssStyles: techModernCSS,
      isActive: true,
      isDefault: false,
    },
  });

  // 4. Executive Classic Cover Letter
  await prisma.template.upsert({
    where: { id: 'executive-classic-cover-letter' },
    update: {
      htmlTemplate: coverLetterHTML,
      cssStyles: executiveClassicCSS,
    },
    create: {
      id: 'executive-classic-cover-letter',
      name: 'Executive Classic',
      description: 'Traditional, authoritative design for senior and executive positions.',
      type: TemplateType.COVER_LETTER,
      category: 'Executive',
      htmlTemplate: coverLetterHTML,
      cssStyles: executiveClassicCSS,
      isActive: true,
      isDefault: false,
    },
  });

  // 5. Harvard Classic Cover Letter
  await prisma.template.upsert({
    where: { id: 'harvard-classic-cover-letter' },
    update: {
      htmlTemplate: coverLetterHTML,
      cssStyles: harvardClassicCSS,
    },
    create: {
      id: 'harvard-classic-cover-letter',
      name: 'Harvard Classic',
      description: 'Traditional academic design with serif typography. Perfect for academia, research, and consulting roles.',
      type: TemplateType.COVER_LETTER,
      category: 'Academic',
      htmlTemplate: coverLetterHTML,
      cssStyles: harvardClassicCSS,
      isActive: true,
      isDefault: false,
    },
  });

  console.log('✅ Created 5 cover letter templates');

  // ==================================================
  // RESUME TEMPLATES
  // ==================================================

  // 5. Modern Professional Resume (Default)
  await prisma.template.upsert({
    where: { id: 'modern-professional-resume' },
    update: {
      htmlTemplate: resumeHTML,
      cssStyles: modernProfessionalCSS,
    },
    create: {
      id: 'modern-professional-resume',
      name: 'Modern Professional',
      description: 'Clean, ATS-optimized design with navy blue accents. Corporate and versatile.',
      type: TemplateType.RESUME,
      category: 'Professional',
      htmlTemplate: resumeHTML,
      cssStyles: modernProfessionalCSS,
      isActive: true,
      isDefault: true,
    },
  });

  // 6. Elegant Minimal Resume
  await prisma.template.upsert({
    where: { id: 'elegant-minimal-resume' },
    update: {
      htmlTemplate: resumeHTML,
      cssStyles: elegantMinimalCSS,
    },
    create: {
      id: 'elegant-minimal-resume',
      name: 'Elegant Minimal',
      description: 'Sophisticated design with refined typography. Perfect for creative professionals.',
      type: TemplateType.RESUME,
      category: 'Minimal',
      htmlTemplate: resumeHTML,
      cssStyles: elegantMinimalCSS,
      isActive: true,
      isDefault: false,
    },
  });

  // 7. Tech Modern Resume
  await prisma.template.upsert({
    where: { id: 'tech-modern-resume' },
    update: {
      htmlTemplate: resumeHTML,
      cssStyles: techModernCSS,
    },
    create: {
      id: 'tech-modern-resume',
      name: 'Tech Modern',
      description: 'Developer-focused with monospace elements. Ideal for software engineers.',
      type: TemplateType.RESUME,
      category: 'Technical',
      htmlTemplate: resumeHTML,
      cssStyles: techModernCSS,
      isActive: true,
      isDefault: false,
    },
  });

  // 8. Executive Classic Resume
  await prisma.template.upsert({
    where: { id: 'executive-classic-resume' },
    update: {
      htmlTemplate: resumeHTML,
      cssStyles: executiveClassicCSS,
    },
    create: {
      id: 'executive-classic-resume',
      name: 'Executive Classic',
      description: 'Traditional, authoritative design for senior leaders and executives.',
      type: TemplateType.RESUME,
      category: 'Executive',
      htmlTemplate: resumeHTML,
      cssStyles: executiveClassicCSS,
      isActive: true,
      isDefault: false,
    },
  });

  // 9. Harvard Classic Resume
  await prisma.template.upsert({
    where: { id: 'harvard-classic-resume' },
    update: {
      htmlTemplate: resumeHTML,
      cssStyles: harvardClassicCSS,
    },
    create: {
      id: 'harvard-classic-resume',
      name: 'Harvard Classic',
      description: 'Traditional academic design with Times New Roman. Ideal for academia, research, law, and consulting.',
      type: TemplateType.RESUME,
      category: 'Academic',
      htmlTemplate: resumeHTML,
      cssStyles: harvardClassicCSS,
      isActive: true,
      isDefault: false,
    },
  });

  console.log('✅ Created 5 resume templates');

  // ==================================================
  // TWO-COLUMN TEMPLATES (Creative/Design Industries)
  // WARNING: Not ATS-compatible - for direct submissions only
  // ==================================================

  // Modern Minimal Two-Column Cover Letter
  await prisma.template.upsert({
    where: { id: 'modern-minimal-two-column-cover-letter' },
    update: {
      htmlTemplate: coverLetterModernMinimalHTML,
      cssStyles: modernMinimalTwoColumnCSS,
    },
    create: {
      id: 'modern-minimal-two-column-cover-letter',
      name: 'Modern Minimal',
      description: '⚠️ NOT ATS-COMPATIBLE. Clean, modern design for creative industries. Use only for direct submissions.',
      type: TemplateType.COVER_LETTER,
      category: 'Creative',
      htmlTemplate: coverLetterModernMinimalHTML,
      cssStyles: modernMinimalTwoColumnCSS,
      isActive: true,
      isDefault: false,
    },
  });

  // Modern Minimal Two-Column Resume
  await prisma.template.upsert({
    where: { id: 'modern-minimal-two-column-resume' },
    update: {
      htmlTemplate: resumeTwoColumnHTML,
      cssStyles: modernMinimalTwoColumnCSS,
    },
    create: {
      id: 'modern-minimal-two-column-resume',
      name: 'Modern Minimal Two-Column',
      description: '⚠️ NOT ATS-COMPATIBLE. Stylish two-column layout for designers, creatives, and direct submissions.',
      type: TemplateType.RESUME,
      category: 'Creative',
      htmlTemplate: resumeTwoColumnHTML,
      cssStyles: modernMinimalTwoColumnCSS,
      isActive: true,
      isDefault: false,
    },
  });

  console.log('✅ Created 2 two-column templates (Creative)');

  // ==================================================
  // MULTILINGUAL TEMPLATES (German-style)
  // ==================================================

  // Modern Clean Resume (Multilingual - German Style)
  await prisma.template.upsert({
    where: { id: 'modern-clean-resume' },
    update: {
      htmlTemplate: resumeModernCleanHTML,
      cssStyles: modernCleanCSS,
    },
    create: {
      id: 'modern-clean-resume',
      name: 'Modern Clean',
      description: 'Clean single-column design inspired by German resume aesthetics. Supports multilingual content with translations object.',
      type: TemplateType.RESUME,
      category: 'Professional',
      htmlTemplate: resumeModernCleanHTML,
      cssStyles: modernCleanCSS,
      isActive: true,
      isDefault: false,
    },
  });

  // Modern Clean Cover Letter (uses standard ATS template with Modern Clean styling)
  await prisma.template.upsert({
    where: { id: 'modern-clean-cover-letter' },
    update: {
      htmlTemplate: coverLetterHTML,
      cssStyles: modernCleanCSS,
    },
    create: {
      id: 'modern-clean-cover-letter',
      name: 'Modern Clean',
      description: 'Clean, minimalist cover letter design. Pairs well with Modern Clean Resume template.',
      type: TemplateType.COVER_LETTER,
      category: 'Professional',
      htmlTemplate: coverLetterHTML,
      cssStyles: modernCleanCSS,
      isActive: true,
      isDefault: false,
    },
  });

  console.log('✅ Created 2 Modern Clean templates (Multilingual)');

  // Delete old templates that are no longer needed
  await prisma.template.deleteMany({
    where: {
      id: {
        in: [
          'professional-cover-letter',
          'modern-cover-letter',
          'creative-cover-letter',
          'professional-resume',
          'modern-resume',
          'minimal-resume',
          'technical-resume',
        ],
      },
    },
  });
  console.log('🗑️ Cleaned up old templates');
  console.log('🎉 Template seed completed successfully!');
}

seedTemplates()
  .catch((e) => {
    console.error('❌ Template seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
