/**
 * Cleanup Old Templates Script
 *
 * This script removes old templates that were created by the deprecated seed-templates.ts
 * and ensures only the new templates from seed-multilingual-templates.ts are present.
 *
 * Run with: npx ts-node -r tsconfig-paths/register prisma/cleanup-old-templates.ts
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { join } from 'path';

// Load .env from apps/api directory
config({ path: join(__dirname, '../.env') });

const prisma = new PrismaClient();

// Old template IDs from seed-templates.ts that need to be cleaned up
const OLD_TEMPLATE_IDS = [
  // Old Cover Letters (format: name-cover-letter)
  'modern-professional-cover-letter',
  'elegant-minimal-cover-letter',
  'tech-modern-cover-letter',
  'executive-classic-cover-letter',
  'harvard-classic-cover-letter',
  // Old Resumes (format: name-resume)
  'modern-professional-resume',
  'elegant-minimal-resume',
  'tech-modern-resume',
  'executive-classic-resume',
  'modern-minimal-two-column-resume',
  'modern-clean-resume',
];

// New template IDs from seed-multilingual-templates.ts
// These use the format: id-resume and id-cover-letter where id matches TEMPLATE_CONFIGS
const NEW_TEMPLATE_IDS = [
  'modern-professional-resume',
  'modern-professional-cover-letter',
  'elegant-minimal-resume',
  'elegant-minimal-cover-letter',
  'tech-modern-resume',
  'tech-modern-cover-letter',
  'executive-classic-resume',
  'executive-classic-cover-letter',
  'harvard-classic-resume',
  'harvard-classic-cover-letter',
  'modern-minimal-two-column-resume',
  'modern-minimal-two-column-cover-letter',
  'modern-clean-resume',
  'modern-clean-cover-letter',
];

async function main() {
  console.log('🧹 Cleaning up templates...\n');

  // 1. Get all current templates
  const allTemplates = await prisma.template.findMany({
    select: { id: true, name: true, type: true },
    orderBy: { id: 'asc' },
  });

  console.log(`📋 Found ${allTemplates.length} templates in database:\n`);
  allTemplates.forEach((t) => {
    console.log(`   - ${t.id} (${t.type}): ${t.name}`);
  });

  // 2. Find templates that are NOT in the new template list
  const templatesToDelete = allTemplates.filter((t) => !NEW_TEMPLATE_IDS.includes(t.id));

  if (templatesToDelete.length === 0) {
    console.log('\n✅ No old templates to clean up. Database is up to date.');
    return;
  }

  console.log(`\n🗑️  Templates to delete (${templatesToDelete.length}):\n`);
  templatesToDelete.forEach((t) => {
    console.log(`   - ${t.id} (${t.type}): ${t.name}`);
  });

  // 3. Delete old templates
  console.log('\n⏳ Deleting old templates...');

  const deleteResult = await prisma.template.deleteMany({
    where: {
      id: { in: templatesToDelete.map((t) => t.id) },
    },
  });

  console.log(`\n✅ Deleted ${deleteResult.count} old templates.`);

  // 4. Verify remaining templates
  const remainingTemplates = await prisma.template.findMany({
    select: { id: true, name: true, type: true },
    orderBy: { id: 'asc' },
  });

  console.log(`\n📋 Remaining templates (${remainingTemplates.length}):\n`);
  remainingTemplates.forEach((t) => {
    console.log(`   - ${t.id} (${t.type}): ${t.name}`);
  });

  console.log('\n🎉 Cleanup complete!');
  console.log('💡 Run "npm run prisma:seed:templates" to re-seed with new templates.');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
