import { defineConfig } from '@prisma/config';

/**
 * Prisma Configuration for Smart Apply API
 * 
 * This configuration file is required for Prisma 7.x
 * - Datasource URL is now defined here instead of in schema.prisma
 * - Environment variables are explicitly loaded via dotenv in development
 * 
 * @see https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/prisma-config-file
 */
export default defineConfig({
  datasource: {
    // PostgreSQL connection string from environment
    // Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smartapply',
  },
});
