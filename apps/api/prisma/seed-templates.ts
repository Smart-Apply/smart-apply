import { PrismaClient, TemplateType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Helper function to read template files
function readTemplateFile(filename: string): string {
  const filePath = path.join(__dirname, '../src/pdf/templates', filename);
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

  // Read existing template files
  const coverLetterHTML = readTemplateFile('cover-letter.hbs');
  const resumeHTML = readTemplateFile('resume.hbs');
  const baseCoverLetterCSS = readCombinedCSS(['base.css', 'cover-letter.css']);
  const baseResumeCSS = readCombinedCSS(['base.css', 'resume.css']);

  // 1. Professional Cover Letter (Default)
  await prisma.template.upsert({
    where: { id: 'professional-cover-letter' },
    update: {},
    create: {
      id: 'professional-cover-letter',
      name: 'Professional Cover Letter',
      description: 'Classic, formal layout suitable for corporate and traditional industries',
      type: TemplateType.COVER_LETTER,
      category: 'Professional',
      htmlTemplate: coverLetterHTML,
      cssStyles: baseCoverLetterCSS,
      isActive: true,
      isDefault: true,
    },
  });

  // 2. Modern Cover Letter
  await prisma.template.upsert({
    where: { id: 'modern-cover-letter' },
    update: {},
    create: {
      id: 'modern-cover-letter',
      name: 'Modern Cover Letter',
      description: 'Clean, contemporary design with subtle color accents',
      type: TemplateType.COVER_LETTER,
      category: 'Modern',
      htmlTemplate: coverLetterHTML,
      cssStyles: baseCoverLetterCSS.replace(/#0066cc/g, '#10b981'), // Green accent
      isActive: true,
      isDefault: false,
    },
  });

  // 3. Creative Cover Letter
  await prisma.template.upsert({
    where: { id: 'creative-cover-letter' },
    update: {},
    create: {
      id: 'creative-cover-letter',
      name: 'Creative Cover Letter',
      description: 'Bold, distinctive style for creative industries and startups',
      type: TemplateType.COVER_LETTER,
      category: 'Creative',
      htmlTemplate: coverLetterHTML,
      cssStyles: baseCoverLetterCSS.replace(/#0066cc/g, '#8b5cf6'), // Purple accent
      isActive: true,
      isDefault: false,
    },
  });

  console.log('✅ Created 3 cover letter templates');

  // 4. Professional Resume (Default)
  await prisma.template.upsert({
    where: { id: 'professional-resume' },
    update: {},
    create: {
      id: 'professional-resume',
      name: 'Professional Resume',
      description: 'Traditional CV format optimized for ATS and corporate environments',
      type: TemplateType.RESUME,
      category: 'Professional',
      htmlTemplate: resumeHTML,
      cssStyles: baseResumeCSS,
      isActive: true,
      isDefault: true,
    },
  });

  // 5. Modern Resume
  await prisma.template.upsert({
    where: { id: 'modern-resume' },
    update: {},
    create: {
      id: 'modern-resume',
      name: 'Modern Resume',
      description: 'Two-column layout with visual hierarchy and contemporary styling',
      type: TemplateType.RESUME,
      category: 'Modern',
      htmlTemplate: resumeHTML,
      cssStyles: baseResumeCSS.replace(/#0066cc/g, '#10b981'), // Green accent
      isActive: true,
      isDefault: false,
    },
  });

  // 6. Minimal Resume
  await prisma.template.upsert({
    where: { id: 'minimal-resume' },
    update: {},
    create: {
      id: 'minimal-resume',
      name: 'Minimal Resume',
      description: 'Simple, elegant, text-focused design with maximum readability',
      type: TemplateType.RESUME,
      category: 'Minimal',
      htmlTemplate: resumeHTML,
      cssStyles: baseResumeCSS
        .replace(/#0066cc/g, '#1a1a1a') // Black accent
        .replace(/background: #e6f2ff/g, 'background: #f5f5f5')
        .replace(/border-left: 4pt solid #0066cc/g, 'border-left: 2pt solid #1a1a1a'),
      isActive: true,
      isDefault: false,
    },
  });

  // 7. Technical Resume
  await prisma.template.upsert({
    where: { id: 'technical-resume' },
    update: {},
    create: {
      id: 'technical-resume',
      name: 'Technical Resume',
      description: 'Skills-focused layout optimized for software developers and engineers',
      type: TemplateType.RESUME,
      category: 'Technical',
      htmlTemplate: resumeHTML,
      cssStyles: baseResumeCSS.replace(/#0066cc/g, '#0891b2'), // Cyan accent
      isActive: true,
      isDefault: false,
    },
  });

  console.log('✅ Created 4 resume templates');
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
