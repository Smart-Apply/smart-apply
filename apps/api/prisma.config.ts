import { defineConfig } from '@prisma/config';
import { config } from 'dotenv';

// Load .env file for Prisma CLI commands
config();

/**
 * Prisma Configuration for Smart Apply API
 *
 * This configuration file is required for Prisma 7.x
 * - Datasource URL is now defined here instead of in schema.prisma
 * - Environment variables are explicitly loaded via dotenv in development
 *
 * Connection-string strategy
 * --------------------------
 * Prisma CLI commands (migrate, db push, db seed, studio) MUST run against
 * a *direct* (non-pooled) Postgres connection. Transaction-mode poolers like
 * Neon's pgbouncer or Supabase's Supavisor strip prepared statements and
 * advisory locks, which Prisma Migrate relies on.
 *
 * Therefore:
 *   - DIRECT_URL  → preferred for the CLI (Neon's unpooled hostname)
 *   - DATABASE_URL → fallback (works for plain Postgres without a pooler,
 *                    e.g. local Docker)
 *
 * The runtime PrismaClient (apps/api/src/prisma/prisma.service.ts) keeps
 * using DATABASE_URL via the PrismaPg adapter so app traffic still benefits
 * from the pooled connection.
 *
 * @see https://www.prisma.io/docs/orm/reference/prisma-config-reference
 * @see https://neon.tech/docs/guides/prisma#connect-from-prisma-migrate
 */
export default defineConfig({
  datasource: {
    url:
      process.env.DIRECT_URL ||
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/smartapply',
  },
});
