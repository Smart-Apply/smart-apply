const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting combined database seed...');
  console.log('📍 Current directory:', __dirname);
  
  try {
    // 1. Seed demo data
    console.log('\n📦 Step 1: Seeding demo data...');
    require('./seed.js');
    
    // 2. Seed templates - use npx to run the TypeScript version
    console.log('\n📦 Step 2: Seeding templates (using npx tsx)...');
    execSync('npx tsx prisma/seed-multilingual-templates.ts', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      env: process.env
    });
    
    console.log('\n✅ Combined seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed script error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
