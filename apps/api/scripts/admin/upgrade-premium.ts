/**
 * One-off admin script: flip a user to PREMIUM tier on whatever DB
 * apps/api/.env points at (Neon by default after the infra migration).
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/admin/upgrade-premium.ts <email>
 */
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';

config();

const TARGET_EMAIL = process.argv[2];
if (!TARGET_EMAIL) {
  console.error('Usage: ts-node scripts/admin/upgrade-premium.ts <email>');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    include: { subscription: { include: { usage: true } } },
  });

  if (!user) {
    console.error(`❌ User not found: ${TARGET_EMAIL}`);
    process.exit(1);
  }

  console.log('Before:', {
    userId: user.id,
    email: user.email,
    tier: user.subscription?.tier ?? '(no subscription)',
    status: user.subscription?.status ?? null,
  });

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  const updated = await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {
      tier: 'PREMIUM',
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    },
    create: {
      userId: user.id,
      tier: 'PREMIUM',
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      usage: {
        create: { periodStart: now, periodEnd },
      },
    },
    include: { usage: true },
  });

  console.log('After:', {
    tier: updated.tier,
    status: updated.status,
    currentPeriodStart: updated.currentPeriodStart?.toISOString(),
    currentPeriodEnd: updated.currentPeriodEnd?.toISOString(),
    hasUsageRow: !!updated.usage,
  });

  console.log('✅ Upgrade complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
