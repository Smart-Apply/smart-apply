/**
 * One-off admin script: mark a user's email as verified.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/admin/verify-email.ts <email>
 */
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';
config();

const TARGET = process.argv[2];
if (!TARGET) { console.error('Usage: ts-node verify-email.ts <email>'); process.exit(1); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

(async () => {
  const updated = await prisma.user.update({
    where: { email: TARGET },
    data: { emailVerified: true, emailVerificationToken: null, emailVerificationExpires: null },
    select: { id: true, email: true, emailVerified: true },
  });
  console.log('✅', updated);
  await prisma.$disconnect(); await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
