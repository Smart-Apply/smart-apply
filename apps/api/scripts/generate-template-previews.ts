/**
 * Template Preview Generation Script
 * ===================================
 * Generates preview images for all templates in the database.
 *
 * This script bootstraps the NestJS application to access:
 *   - TemplatesService (for preview generation with Puppeteer)
 *   - StorageService (for uploading preview images)
 *
 * Usage:
 *   pnpm templates:generate-previews
 *
 * Run this after seeding templates:
 *   pnpm prisma:seed:templates && pnpm templates:generate-previews
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { TemplatesService } from '../src/templates/templates.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function generatePreviews() {
  const logger = new Logger('GeneratePreviews');
  logger.log('🖼️  Starting template preview generation...\n');

  // Bootstrap NestJS application (headless)
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const templatesService = app.get(TemplatesService);
  const prisma = app.get(PrismaService);

  try {
    // Get only RESUME templates for previews (one preview per design)
    const allTemplates = await prisma.template.findMany({
      where: { isActive: true, type: 'RESUME' },
      orderBy: { name: 'asc' },
    });

    if (allTemplates.length === 0) {
      logger.warn('No active templates found in database');
      return;
    }

    logger.log(`📋 Found ${allTemplates.length} active templates\n`);

    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (const template of allTemplates) {
      try {
        // Check if preview already exists
        if (template.previewImageKey) {
          logger.log(`   ⏭️  Skipping "${template.name}" (${template.type}) - preview exists`);
          skipped++;
          continue;
        }

        logger.log(`   🎨 Generating preview for "${template.name}" (${template.type})...`);
        await templatesService.generatePreview(template.id);
        logger.log(`   ✅ Generated: ${template.id}`);
        generated++;
      } catch (error) {
        logger.error(`   ❌ Failed: ${template.id} - ${error.message}`);
        failed++;
      }
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Preview generation complete!`);
    console.log(`   • Generated: ${generated}`);
    console.log(`   • Skipped (existing): ${skipped}`);
    console.log(`   • Failed: ${failed}`);
    console.log(`${'='.repeat(60)}`);
  } catch (error) {
    logger.error('Failed to generate previews:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

// Force regeneration flag
async function generatePreviewsForced() {
  const logger = new Logger('GeneratePreviews');
  logger.log('🖼️  Starting FORCED template preview regeneration...\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const templatesService = app.get(TemplatesService);

  try {
    const allTemplates = await templatesService.findAll();

    if (allTemplates.length === 0) {
      logger.warn('No active templates found');
      return;
    }

    logger.log(`📋 Regenerating previews for ${allTemplates.length} templates\n`);

    let generated = 0;
    let failed = 0;

    for (const template of allTemplates) {
      try {
        logger.log(`   🎨 Regenerating preview for "${template.name}"...`);

        // Clear existing preview key to force regeneration
        await templatesService['prisma'].template.update({
          where: { id: template.id },
          data: { previewImageKey: null },
        });

        await templatesService.generatePreview(template.id);
        logger.log(`   ✅ Regenerated: ${template.id}`);
        generated++;
      } catch (error) {
        logger.error(`   ❌ Failed: ${template.id} - ${error.message}`);
        failed++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Forced regeneration complete!`);
    console.log(`   • Generated: ${generated}`);
    console.log(`   • Failed: ${failed}`);
    console.log(`${'='.repeat(60)}`);
  } finally {
    await app.close();
  }
}

// Check for --force flag
const isForced = process.argv.includes('--force') || process.argv.includes('-f');

if (isForced) {
  generatePreviewsForced()
    .then(() => {
      console.log('\n🎉 Forced preview regeneration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
} else {
  generatePreviews()
    .then(() => {
      console.log('\n🎉 Preview generation completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}
