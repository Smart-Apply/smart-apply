import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';
config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
(async () => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, firstName: true, lastName: true, createdAt: true, subscription: { select: { tier: true } } },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`Found ${users.length} users:`);
  for (const u of users) {
    console.log(`  ${u.email.padEnd(40)} tier=${u.subscription?.tier ?? '(none)'} created=${u.createdAt.toISOString()}`);
  }
  await prisma.$disconnect(); await pool.end();
})();
