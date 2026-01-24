import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as argon2 from 'argon2';
import { config } from 'dotenv';
import { join } from 'path';

// Load .env from apps/api directory (one level up from prisma/seed.ts)
config({ path: join(__dirname, '../.env') });

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smartapply',
  max: 5,
});

// Create Prisma adapter and client
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seed...');

  // Create demo user with hashed password
  const hashedPassword = await argon2.hash('Demo123!');

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@smartapply.com' },
    update: {},
    create: {
      email: 'demo@smartapply.com',
      password: hashedPassword,
      firstName: 'John',
      lastName: 'Demo',
      provider: 'local',
    },
  });

  console.log('✅ Created demo user:', demoUser.email);

  // Create FREE subscription for demo user
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1); // 1 month period

  await prisma.subscription.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      tier: 'FREE',
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      usage: {
        create: {
          applicationsUsed: 0,
          interviewSessionsUsed: 0,
          periodStart: now,
          periodEnd: periodEnd,
        },
      },
    },
  });

  console.log('✅ Created FREE subscription for demo user');

  // Create profile for demo user
  await prisma.profile.upsert({
    where: { userId: demoUser.id },
    update: {
      // Update address fields for existing profiles
      street: 'Musterstraße 123',
      postalCode: '47057',
      city: 'Duisburg',
      country: 'Deutschland',
    },
    create: {
      userId: demoUser.id,
      summary:
        'Full-stack developer with 5+ years of experience building scalable web applications.',
      phone: '+49-201-555-0123',
      street: 'Musterstraße 123',
      postalCode: '47057',
      city: 'Duisburg',
      country: 'Deutschland',
      linkedinUrl: 'https://linkedin.com/in/demouser',
      portfolioUrl: 'https://demouser.dev',
      skills: {
        create: [
          { name: 'TypeScript', category: 'Programming Language', level: 'EXPERT' },
          { name: 'JavaScript', category: 'Programming Language', level: 'EXPERT' },
          { name: 'React', category: 'Framework', level: 'ADVANCED' },
          { name: 'Node.js', category: 'Runtime', level: 'ADVANCED' },
          { name: 'NestJS', category: 'Framework', level: 'ADVANCED' },
          { name: 'PostgreSQL', category: 'Database', level: 'INTERMEDIATE' },
          { name: 'Docker', category: 'Tool', level: 'INTERMEDIATE' },
          { name: 'Azure', category: 'Cloud Platform', level: 'INTERMEDIATE' },
        ],
      },
      certificates: {
        create: [
          {
            name: 'Azure Developer Associate',
            issuer: 'Microsoft',
            issueDate: new Date('2023-01-15'),
            credentialId: 'AZ-204-12345',
          },
          {
            name: 'AWS Certified Developer',
            issuer: 'Amazon Web Services',
            issueDate: new Date('2022-06-20'),
            credentialId: 'AWS-DEV-67890',
          },
        ],
      },
      experiences: {
        create: [
          {
            title: 'Senior Full-Stack Developer',
            company: 'Tech Innovations Inc.',
            location: 'San Francisco, CA',
            startDate: new Date('2021-03-01'),
            isCurrent: true,
            description: 'Lead developer for enterprise SaaS platform serving 10K+ users.',
            achievements: [
              'Architected microservices migration reducing deployment time by 60%',
              'Implemented CI/CD pipeline with Azure DevOps, improving release frequency',
              'Mentored team of 4 junior developers on TypeScript and React best practices',
            ],
          },
          {
            title: 'Full-Stack Developer',
            company: 'StartupXYZ',
            location: 'Remote',
            startDate: new Date('2019-01-15'),
            endDate: new Date('2021-02-28'),
            isCurrent: false,
            description: 'Built MVP and core features for B2B analytics platform.',
            achievements: [
              'Developed REST API with Node.js and Express serving 1M+ requests/day',
              'Created React dashboard with real-time data visualization',
              'Optimized database queries reducing average response time by 40%',
            ],
          },
        ],
      },
      projects: {
        create: [
          {
            name: 'E-commerce Platform',
            description:
              'Full-featured online store with payment integration and inventory management.',
            url: 'https://github.com/demouser/ecommerce',
            startDate: new Date('2022-05-01'),
            endDate: new Date('2022-09-30'),
            technologies: ['React', 'Node.js', 'PostgreSQL', 'Stripe', 'Docker'],
            highlights: [
              'Implemented secure payment processing with Stripe',
              'Built admin dashboard for inventory and order management',
              'Achieved 95+ Lighthouse score for performance',
            ],
          },
          {
            name: 'Smart Apply',
            description:
              'AI-powered job application assistant generating tailored resumes and cover letters.',
            url: 'https://github.com/demouser/smart-apply',
            startDate: new Date('2023-10-01'),
            technologies: ['NestJS', 'Azure OpenAI', 'Prisma', 'Azure', 'TypeScript'],
            highlights: [
              'Integrated Azure OpenAI for intelligent content generation',
              'Deployed on Azure Container Apps with CI/CD',
              'Implemented document storage with Azure Blob Storage',
            ],
          },
        ],
      },
      education: {
        create: [
          {
            degree: 'Bachelor of Science in Computer Science',
            institution: 'University of California, Berkeley',
            fieldOfStudy: 'Computer Science',
            startYear: new Date('2014-09-01'),
            endYear: new Date('2018-06-01'),
            gpa: '3.8/4.0',
            description:
              "Focus on Software Engineering and Distributed Systems. Dean's List 2016-2018.",
          },
          {
            degree: 'Master of Science in Software Engineering',
            institution: 'Stanford University',
            fieldOfStudy: 'Software Engineering',
            startYear: new Date('2018-09-01'),
            endYear: new Date('2020-06-01'),
            gpa: '3.9/4.0',
            description:
              'Thesis: Scalable Microservices Architecture for Cloud-Native Applications.',
          },
        ],
      },
      languages: {
        create: [
          { name: 'Deutsch', level: 'NATIVE' },
          { name: 'Englisch', level: 'FLUENT' },
        ],
      },
    },
  });

  console.log(
    '✅ Created demo profile with skills, certificates, experiences, projects, and languages',
  );

  // Create sample job posting
  const jobPosting = await prisma.jobPosting.create({
    data: {
      userId: demoUser.id,
      title: 'Senior TypeScript Developer',
      company: 'Azure Solutions Corp',
      location: 'Seattle, WA (Hybrid)',
      rawText: `We are seeking an experienced TypeScript developer to join our cloud-native development team.
  
  Requirements:
  • 5+ years of TypeScript/JavaScript experience
  • Strong experience with Node.js and NestJS
  • Experience with Azure cloud services
  • Proficiency in PostgreSQL or similar databases
  • Experience with containerization (Docker, Kubernetes)
  
  Responsibilities:
  • Design and develop scalable microservices
  • Collaborate with cross-functional teams
  • Mentor junior developers
  • Participate in code reviews and architectural decisions
  
  Nice to have:
  • Experience with Azure OpenAI or similar AI services
  • Familiarity with CI/CD pipelines
  • Open source contributions`,
      fullText: `We are seeking an experienced TypeScript developer to join our cloud-native development team.
  
  Requirements:
  • 5+ years of TypeScript/JavaScript experience
  • Strong experience with Node.js and NestJS
  • Experience with Azure cloud services
  • Proficiency in PostgreSQL or similar databases
  • Experience with containerization (Docker, Kubernetes)
  
  Responsibilities:
  • Design and develop scalable microservices
  • Collaborate with cross-functional teams
  • Mentor junior developers
  • Participate in code reviews and architectural decisions
  
  Nice to have:
  • Experience with Azure OpenAI or similar AI services
  • Familiarity with CI/CD pipelines
  • Open source contributions`,
    },
  });

  console.log('✅ Created sample job posting:', jobPosting.title);

  // Create FREE subscriptions for all existing users who don't have one
  const usersWithoutSubscription = await prisma.user.findMany({
    where: {
      subscription: null,
    },
    select: { id: true, email: true },
  });

  if (usersWithoutSubscription.length > 0) {
    const subPeriodStart = new Date();
    const subPeriodEnd = new Date();
    subPeriodEnd.setMonth(subPeriodEnd.getMonth() + 1);

    for (const user of usersWithoutSubscription) {
      await prisma.subscription.create({
        data: {
          userId: user.id,
          tier: 'FREE',
          status: 'ACTIVE',
          currentPeriodStart: subPeriodStart,
          currentPeriodEnd: subPeriodEnd,
          usage: {
            create: {
              applicationsUsed: 0,
              interviewSessionsUsed: 0,
              periodStart: subPeriodStart,
              periodEnd: subPeriodEnd,
            },
          },
        },
      });
    }
    console.log(
      `✅ Created FREE subscriptions for ${usersWithoutSubscription.length} existing user(s)`,
    );
  }

  // Import template seeding (run separately if needed)
  console.log('💡 To seed templates, run: npm run seed:templates');

  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
