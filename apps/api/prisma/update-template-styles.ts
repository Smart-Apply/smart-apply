/**
 * Update Template Styles Script
 *
 * Updates the cssStyles in the database with the new CSS files from apps/api/src/pdf/styles/
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Mapping from database category to CSS file
const categoryToCssFile: Record<string, string> = {
  Professional: 'modern-professional.css',
  Executive: 'executive-classic.css',
  Minimal: 'elegant-minimal.css',
  Sidebar: 'modern-minimal-two-column.css',
  Technical: 'tech-modern.css',
};

async function main() {
  console.log('🎨 Updating template CSS styles...\n');

  const stylesDir = path.join(__dirname, '../src/pdf/styles');

  for (const [category, cssFile] of Object.entries(categoryToCssFile)) {
    const cssPath = path.join(stylesDir, cssFile);

    if (!fs.existsSync(cssPath)) {
      console.log(`⚠️  CSS file not found: ${cssFile}`);
      continue;
    }

    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    // Update all templates with this category
    const result = await prisma.template.updateMany({
      where: { category },
      data: {
        cssStyles: cssContent,
        previewImageKey: null, // Reset preview so it gets regenerated
      },
    });

    console.log(`✅ Updated ${result.count} templates for category "${category}" with ${cssFile}`);
  }

  console.log('\n🎉 Done! Preview images will be regenerated on next request.');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
