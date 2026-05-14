/**
 * Snapshot CLI for Phase 1 (rearchitecture).
 *
 * Renders the same sample resume + cover letter through BOTH renderers
 * (puppeteer and react-pdf) for the `classic-ats` template family and writes
 * both PDFs to disk for visual comparison.
 *
 * Usage (from apps/api):
 *   npx ts-node -r tsconfig-paths/register scripts/snapshot-pdf-renderers.ts
 *
 * Output (gitignored, written under /tmp by default):
 *   /tmp/smart-apply-pdf-snapshots/<timestamp>/{puppeteer,react-pdf}/{resume,cover-letter}.pdf
 *
 * Requires a running database with at least one classic-ats template seeded
 * (run `npm run prisma:seed:templates` first). The script picks the first
 * English classic-ats template it finds.
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PdfService } from '../src/pdf/pdf.service';
import { ReactPdfRendererService } from '../src/pdf-v2/react-pdf-renderer.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type {
  CoverLetterTemplateData,
  ResumeTemplateData,
} from '../src/pdf/template-renderer.service';

const SAMPLE_RESUME: ResumeTemplateData = {
  candidateName: 'Jane Doe',
  targetJobTitle: 'Senior Software Engineer',
  email: 'jane.doe@example.com',
  phone: '+1 555-0123',
  fullAddress: '123 Main Street, 94102 San Francisco, USA',
  linkedin: 'https://linkedin.com/in/janedoe',
  github: 'https://github.com/janedoe',
  language: 'en',
  summary:
    '<p>Experienced software engineer with 8+ years building distributed systems. Led teams of 5–10 across AWS and Azure deployments.</p>',
  skillCategories: [
    { type: 'Languages', skills: ['TypeScript', 'Python', 'Go', 'Rust'] },
    { type: 'Frameworks', skills: ['NestJS', 'Next.js', 'FastAPI'] },
    { type: 'Cloud', skills: ['AWS', 'Azure', 'Docker', 'Kubernetes'] },
  ],
  experiences: [
    {
      title: 'Senior Software Engineer',
      company: 'Tech Corp',
      location: 'San Francisco, CA',
      dateRange: 'Jan 2021 – Present',
      achievements: [
        'Led migration of monolith to microservices serving 1M+ DAU.',
        'Reduced p99 latency by 42% via async batching.',
        'Mentored 4 junior engineers; grew 2 to mid-level.',
      ],
    },
    {
      title: 'Software Engineer',
      company: 'Startup Inc',
      location: 'Palo Alto, CA',
      dateRange: 'Jun 2018 – Dec 2020',
      achievements: [
        'Built RESTful APIs (Node.js, Express) consumed by mobile + web.',
        'Implemented CI/CD pipeline reducing deploy time by 60%.',
      ],
    },
  ],
  education: [
    {
      degree: 'B.Sc.',
      institution: 'Stanford University',
      year: '2018',
      fieldOfStudy: 'Computer Science',
      gpa: '3.8',
    },
  ],
  projects: [
    {
      name: 'OSS contributor',
      description: 'Active contributor to React and TypeScript ecosystems.',
      date: '2019 – Present',
      highlights: ['50+ merged PRs across 12 repos', 'Doc improvements adopted upstream'],
    },
  ],
  certifications: [
    { name: 'AWS Solutions Architect — Professional', issuer: 'Amazon Web Services', date: '2022' },
  ],
  languages: [
    { name: 'English', level: 'Native' },
    { name: 'German', level: 'B2' },
  ],
};

const SAMPLE_COVER_LETTER: CoverLetterTemplateData = {
  candidateName: 'Jane Doe',
  targetJobTitle: 'Senior Software Engineer',
  email: 'jane.doe@example.com',
  phone: '+1 555-0123',
  fullAddress: '123 Main Street, 94102 San Francisco, USA',
  linkedin: 'https://linkedin.com/in/janedoe',
  language: 'en',
  date: 'May 11, 2026',
  companyName: 'Acme Corporation',
  closingPhrase: 'Best regards,',
  content: `<p>Dear Hiring Manager,</p>
<p>I'm excited to apply for the <strong>Senior Software Engineer</strong> role at Acme. With 8+ years of distributed-systems experience and a track record of shipping at scale, I believe I'd be a strong fit.</p>
<p>Three highlights from my recent work that map directly to your requirements:</p>
<ul>
<li>Led the migration of a Node.js monolith to a microservices architecture serving 1M+ daily active users.</li>
<li>Reduced p99 API latency by 42% through asynchronous batching and Redis-based caching.</li>
<li>Mentored a team of four junior engineers, two of whom were promoted to mid-level within 12 months.</li>
</ul>
<p>I'd welcome the opportunity to discuss how my background aligns with what you're building.</p>`,
};

async function main() {
  const logger = new Logger('SnapshotPdf');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const prisma = app.get(PrismaService);
  const pdfService = app.get(PdfService);
  const reactPdfRenderer = app.get(ReactPdfRendererService);

  const [resumeTemplate, coverLetterTemplate] = await Promise.all([
    prisma.template.findFirst({
      where: {
        isActive: true,
        type: 'RESUME',
        name: { contains: 'Classic ATS', mode: 'insensitive' },
        language: 'en',
      },
      orderBy: { isDefault: 'desc' },
    }),
    prisma.template.findFirst({
      where: {
        isActive: true,
        type: 'COVER_LETTER',
        name: { contains: 'Classic ATS', mode: 'insensitive' },
        language: 'en',
      },
      orderBy: { isDefault: 'desc' },
    }),
  ]);

  if (!resumeTemplate || !coverLetterTemplate) {
    logger.error(
      `Missing "Classic ATS" template(s) in DB (resume=${!!resumeTemplate}, coverLetter=${!!coverLetterTemplate}). Run \`npm run prisma:seed:templates\` first.`,
    );
    await app.close();
    process.exit(1);
  }

  logger.log(
    `Using resume template ${resumeTemplate.id} (${resumeTemplate.name}, lang=${resumeTemplate.language})`,
  );
  logger.log(
    `Using cover-letter template ${coverLetterTemplate.id} (${coverLetterTemplate.name}, lang=${coverLetterTemplate.language})`,
  );

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join('/tmp', 'smart-apply-pdf-snapshots', stamp);
  await fs.mkdir(path.join(outDir, 'puppeteer'), { recursive: true });
  await fs.mkdir(path.join(outDir, 'react-pdf'), { recursive: true });

  // ---- puppeteer (legacy) ----
  logger.log('Rendering via puppeteer...');
  const pupResume = await pdfService.generateResumePDF(SAMPLE_RESUME, resumeTemplate.id, {
    atsOptimized: false,
  });
  await fs.writeFile(path.join(outDir, 'puppeteer', 'resume.pdf'), pupResume);
  logger.log(`  resume.pdf  ${pupResume.length} bytes`);

  const pupCl = await pdfService.generateCoverLetterPDF(
    SAMPLE_COVER_LETTER,
    coverLetterTemplate.id,
    { atsOptimized: false },
  );
  await fs.writeFile(path.join(outDir, 'puppeteer', 'cover-letter.pdf'), pupCl);
  logger.log(`  cover-letter.pdf  ${pupCl.length} bytes`);

  // ---- react-pdf (new) ----
  logger.log('Rendering via react-pdf...');
  const rpResume = await reactPdfRenderer.renderResume(SAMPLE_RESUME, resumeTemplate.id, {
    atsOptimized: false,
  });
  if (!rpResume) {
    logger.error(
      `react-pdf returned undefined for template ${resumeTemplate.id} — registry miss. Check template-registry.ts.`,
    );
    await app.close();
    process.exit(1);
  }
  await fs.writeFile(path.join(outDir, 'react-pdf', 'resume.pdf'), rpResume);
  logger.log(`  resume.pdf  ${rpResume.length} bytes`);

  const rpCl = await reactPdfRenderer.renderCoverLetter(
    SAMPLE_COVER_LETTER,
    coverLetterTemplate.id,
    { atsOptimized: false },
  );
  if (!rpCl) {
    logger.error(`react-pdf returned undefined for cover letter — registry miss.`);
    await app.close();
    process.exit(1);
  }
  await fs.writeFile(path.join(outDir, 'react-pdf', 'cover-letter.pdf'), rpCl);
  logger.log(`  cover-letter.pdf  ${rpCl.length} bytes`);

  logger.log(`\nSnapshot written to: ${outDir}`);
  logger.log(`Open both folders in Preview / a PDF viewer to compare.`);

  await app.close();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
