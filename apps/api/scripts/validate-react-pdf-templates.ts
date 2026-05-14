/**
 * Lightweight standalone validator for react-pdf templates.
 *
 * Skips Nest bootstrap, Prisma, and Puppeteer entirely — calls the registered
 * factories directly with sample data and writes PDF buffers to disk. Catches
 * runtime errors in the templates without the heavy DB+browser pool startup
 * that the full snapshot script needs.
 *
 * Usage (from apps/api):
 *   npx ts-node -r tsconfig-paths/register scripts/validate-react-pdf-templates.ts
 *
 * Output: /tmp/smart-apply-pdf-validate/<key>/{resume,cover-letter}.pdf
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { createElement } from 'react';
import { loadReactPdf } from '../src/pdf-v2/react-pdf-loader';
import { ClassicAtsFactory } from '../src/pdf-v2/templates/classic-ats';
import { HarvardClassicFactory } from '../src/pdf-v2/templates/harvard-classic';
import { ElegantSidebarFactory } from '../src/pdf-v2/templates/elegant-sidebar';
import type { ReactPdfTemplateFactory, ReactPdfTemplateMeta } from '../src/pdf-v2/types';
import type {
  CoverLetterTemplateData,
  ResumeTemplateData,
} from '../src/pdf-v2/template-data';

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

interface Target {
  key: string;
  factory: ReactPdfTemplateFactory;
  meta: ReactPdfTemplateMeta;
}

const TARGETS: Target[] = [
  {
    key: 'classic-ats',
    factory: ClassicAtsFactory,
    meta: { language: 'en', atsOptimized: true },
  },
  {
    key: 'harvard-classic',
    factory: HarvardClassicFactory,
    meta: { language: 'en', atsOptimized: false },
  },
  {
    key: 'elegant-sidebar-original-brown',
    factory: ElegantSidebarFactory,
    meta: { language: 'en', accentColor: '#9c7a5b', colorVariantName: 'Original Brown' },
  },
  {
    key: 'elegant-sidebar-ocean-blue',
    factory: ElegantSidebarFactory,
    meta: { language: 'en', accentColor: '#2e5c8a', colorVariantName: 'Ocean Blue' },
  },
];

async function main() {
  const rp = await loadReactPdf();
  const outRoot = path.join('/tmp', 'smart-apply-pdf-validate');
  await fs.rm(outRoot, { recursive: true, force: true });

  let failures = 0;

  for (const target of TARGETS) {
    const dir = path.join(outRoot, target.key);
    await fs.mkdir(dir, { recursive: true });
    // eslint-disable-next-line no-console
    console.log(`\n[${target.key}]`);

    if (target.factory.resume) {
      try {
        const Component = target.factory.resume(rp);
        const element = createElement(Component, { data: SAMPLE_RESUME, meta: target.meta });
        const buf = await rp.renderToBuffer(element);
        await fs.writeFile(path.join(dir, 'resume.pdf'), buf);
        // eslint-disable-next-line no-console
        console.log(`  ✓ resume.pdf  ${buf.length} bytes`);
      } catch (err) {
        failures++;
        // eslint-disable-next-line no-console
        console.error(`  ✗ resume FAILED:`, err instanceof Error ? err.message : err);
      }
    }

    if (target.factory.coverLetter) {
      try {
        const Component = target.factory.coverLetter(rp);
        const element = createElement(Component, { data: SAMPLE_COVER_LETTER, meta: target.meta });
        const buf = await rp.renderToBuffer(element);
        await fs.writeFile(path.join(dir, 'cover-letter.pdf'), buf);
        // eslint-disable-next-line no-console
        console.log(`  ✓ cover-letter.pdf  ${buf.length} bytes`);
      } catch (err) {
        failures++;
        // eslint-disable-next-line no-console
        console.error(`  ✗ cover-letter FAILED:`, err instanceof Error ? err.message : err);
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(`\nOutput: ${outRoot}`);
  if (failures > 0) {
    // eslint-disable-next-line no-console
    console.error(`\n${failures} failure(s)`);
    process.exit(1);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
