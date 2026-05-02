import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';
config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
(async () => {
  const app = await prisma.application.findUnique({
    where: { id: 'cmooi04cv0007r0hw0p779riv' },
    select: {
      id: true, status: true, applicationStatus: true,
      coverLetterFileKey: true, resumeFileKey: true,
      coverLetterText: true, resumeText: true,
      errorMessage: true,
    },
  });
  console.log(JSON.stringify({
    ...app,
    coverLetterText: app?.coverLetterText ? `(${app.coverLetterText.length} chars)` : null,
    resumeText: app?.resumeText ? `(${app.resumeText.length} chars)` : null,
  }, null, 2));
  await prisma.$disconnect(); await pool.end();
})();
