/**
 * Template Cleanup Script
 * =======================
 * Removes deprecated template files after migration to new folder structure.
 * 
 * WHAT THIS DOES:
 * 1. Deletes old CSS files in src/pdf/styles/ (now in template folders)
 * 2. Deletes old HBS files in src/pdf/templates/ root (now in _base/ or template folders)
 * 3. Optionally removes legacy seed scripts
 * 
 * PREREQUISITES:
 * - Run `pnpm prisma:seed:templates` first to populate DB from new structure
 * - Test that application works correctly with new templates
 * 
 * Usage:
 *   pnpm templates:cleanup           # Dry run (shows what would be deleted)
 *   pnpm templates:cleanup -- --force   # Actually delete files
 */

import * as fs from 'fs';
import * as path from 'path';

const FORCE = process.argv.includes('--force') || process.argv.includes('-f');

// Files/folders to delete
const LEGACY_STYLE_FILES = [
  'src/pdf/styles/elegant-minimal.css',
  'src/pdf/styles/executive-classic.css',
  'src/pdf/styles/harvard-classic.css',
  'src/pdf/styles/modern-clean.css',
  'src/pdf/styles/modern-minimal-two-column.css',
  'src/pdf/styles/modern-professional.css',
  'src/pdf/styles/tech-modern.css',
];

const LEGACY_TEMPLATE_FILES = [
  'src/pdf/templates/cover-letter-ats.hbs',
  'src/pdf/templates/cover-letter-modern-minimal.hbs',
  'src/pdf/templates/resume-ats.hbs',
  'src/pdf/templates/resume-modern-clean.hbs',
  'src/pdf/templates/resume-two-column.hbs',
];

const LEGACY_SEED_SCRIPTS = [
  'prisma/seed-templates.ts',
  'prisma/seed-multilingual-templates.ts',
];

// Optional: Delete entire styles folder if empty after cleanup
const OPTIONAL_CLEANUP = [
  'src/pdf/styles', // Delete folder if empty
];

function getBasePath(): string {
  return path.resolve(__dirname, '..');
}

function deleteFile(relativePath: string): boolean {
  const fullPath = path.join(getBasePath(), relativePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`   ⏭️  Already deleted: ${relativePath}`);
    return false;
  }
  
  if (FORCE) {
    try {
      fs.unlinkSync(fullPath);
      console.log(`   🗑️  Deleted: ${relativePath}`);
      return true;
    } catch (error) {
      console.error(`   ❌ Failed to delete: ${relativePath} - ${error.message}`);
      return false;
    }
  } else {
    console.log(`   📋 Would delete: ${relativePath}`);
    return true;
  }
}

function deleteEmptyFolder(relativePath: string): boolean {
  const fullPath = path.join(getBasePath(), relativePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`   ⏭️  Folder already gone: ${relativePath}`);
    return false;
  }
  
  const contents = fs.readdirSync(fullPath);
  if (contents.length > 0) {
    console.log(`   ⚠️  Folder not empty (${contents.length} items): ${relativePath}`);
    return false;
  }
  
  if (FORCE) {
    try {
      fs.rmdirSync(fullPath);
      console.log(`   🗑️  Deleted empty folder: ${relativePath}`);
      return true;
    } catch (error) {
      console.error(`   ❌ Failed to delete folder: ${relativePath} - ${error.message}`);
      return false;
    }
  } else {
    console.log(`   📋 Would delete empty folder: ${relativePath}`);
    return true;
  }
}

function main() {
  console.log('🧹 Template Cleanup Script');
  console.log('='.repeat(60));
  
  if (!FORCE) {
    console.log('⚠️  DRY RUN MODE - No files will be deleted');
    console.log('   Run with --force to actually delete files\n');
  } else {
    console.log('🚨 FORCE MODE - Files will be permanently deleted!\n');
  }
  
  let totalFound = 0;
  let totalDeleted = 0;
  
  // 1. Legacy CSS files
  console.log('\n📁 Legacy CSS files (now in template folders):');
  for (const file of LEGACY_STYLE_FILES) {
    totalFound++;
    if (deleteFile(file)) totalDeleted++;
  }
  
  // 2. Legacy HBS files
  console.log('\n📁 Legacy HBS files (now in _base/ and template folders):');
  for (const file of LEGACY_TEMPLATE_FILES) {
    totalFound++;
    if (deleteFile(file)) totalDeleted++;
  }
  
  // 3. Legacy seed scripts (optional - comment out if you want to keep them)
  console.log('\n📁 Legacy seed scripts (replaced by auto-discover):');
  for (const file of LEGACY_SEED_SCRIPTS) {
    totalFound++;
    if (deleteFile(file)) totalDeleted++;
  }
  
  // 4. Optional: Delete empty folders
  console.log('\n📁 Empty folders cleanup:');
  for (const folder of OPTIONAL_CLEANUP) {
    deleteEmptyFolder(folder);
  }
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  if (FORCE) {
    console.log(`✅ Cleanup complete! Deleted ${totalDeleted}/${totalFound} files`);
  } else {
    console.log(`📋 Dry run complete. ${totalDeleted}/${totalFound} files would be deleted`);
    console.log(`\n   Run with --force to actually delete these files:`);
    console.log(`   pnpm templates:cleanup -- --force`);
  }
  console.log('='.repeat(60));
}

main();
