import { PrismaClient, TemplateType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

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
  
  // Read CSS files for different styles
  const modernProfessionalCSS = readCSSFile('modern-professional.css');
  const elegantMinimalCSS = readCSSFile('elegant-minimal.css');
  const techModernCSS = readCSSFile('tech-modern.css');
  const executiveClassicCSS = readCSSFile('executive-classic.css');
  
  // Legacy CSS for fallback
  const baseCoverLetterCSS = readCombinedCSS(['base.css', 'cover-letter.css']);
  const baseResumeCSS = readCombinedCSS(['base.css', 'resume.css']);

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

  console.log('✅ Created 4 cover letter templates');

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

  console.log('✅ Created 4 resume templates');

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
