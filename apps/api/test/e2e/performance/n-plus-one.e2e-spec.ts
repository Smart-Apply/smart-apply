import { config } from 'dotenv';
config(); // Load .env before any imports

import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/prisma/prisma.service';

/**
 * E2E tests to verify N+1 query problems are fixed
 * 
 * N+1 Problem: When fetching N applications, we should NOT execute N+1 queries
 * (1 for applications + N for job postings). We should execute 1 or 2 queries total
 * using Prisma's `include` for eager loading.
 */
describe('Applications N+1 Query Prevention (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let jobPostingIds: string[] = [];
  let applicationIds: string[] = [];

  // Track database queries
  let queryCount = 0;
  let queries: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // Wait for module initialization
    await new Promise((resolve) => setTimeout(resolve, 500));

    prisma = app.get<PrismaService>(PrismaService);

    // Enable Prisma query logging
    prisma.$on('query' as never, (e: any) => {
      queryCount++;
      queries.push(e.query);
      console.log(`[Query ${queryCount}]:`, e.query.substring(0, 100) + '...');
    });

    // Login to get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'demo@smartapply.com',
        password: 'Demo123!',
      })
      .expect(201);

    authToken = loginResponse.body.accessToken;
    userId = loginResponse.body.user.id;

    // Clean up any existing test data
    await prisma.application.deleteMany({ where: { userId } });
    await prisma.jobPosting.deleteMany({ where: { userId } });

    // Create 10 job postings
    for (let i = 0; i < 10; i++) {
      const jobPosting = await prisma.jobPosting.create({
        data: {
          userId,
          title: `Test Job ${i + 1}`,
          company: `Company ${i + 1}`,
          description: `Description for job ${i + 1}`,
          requirements: ['Requirement 1', 'Requirement 2'],
          responsibilities: ['Responsibility 1', 'Responsibility 2'],
          niceToHave: ['Nice to have 1'],
        },
      });
      jobPostingIds.push(jobPosting.id);
    }

    // Create 10 applications
    for (const jobPostingId of jobPostingIds) {
      const application = await prisma.application.create({
        data: {
          userId,
          jobPostingId,
          title: `Application for ${jobPostingId}`,
          status: 'READY',
          applicationStatus: 'CREATED',
        },
      });
      applicationIds.push(application.id);
    }

    console.log(`✅ Created ${jobPostingIds.length} job postings and ${applicationIds.length} applications`);
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.application.deleteMany({ where: { userId } });
    await prisma.jobPosting.deleteMany({ where: { userId } });
    await app.close();
  });

  beforeEach(() => {
    // Reset query counter before each test
    queryCount = 0;
    queries = [];
  });

  describe('GET /api/v1/applications with includeJobPosting=true', () => {
    it('should NOT have N+1 query problem (max 3 queries for 10 applications)', async () => {
      console.log('\n🔍 Testing N+1 query prevention...\n');

      const response = await request(app.getHttpServer())
        .get('/api/v1/applications?includeJobPosting=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      console.log(`\n📊 Query Count: ${queryCount}`);
      console.log(`📦 Applications returned: ${response.body.items?.length || response.body.length}`);

      // Expected queries:
      // 1. SELECT applications with JOIN job_postings (or separate SELECT with IN clause)
      // 2. COUNT applications
      // Total: 2-3 queries maximum
      
      expect(queryCount).toBeLessThanOrEqual(3);
      expect(queryCount).toBeGreaterThan(0);

      // Verify response has job postings
      const items = response.body.items || response.body;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
      
      if (items[0]) {
        expect(items[0].jobPosting).toBeDefined();
        expect(items[0].jobPosting.title).toBeDefined();
      }

      console.log('\n✅ No N+1 query problem detected!\n');
    });

    it('should fetch all 10 applications with job postings in minimal queries', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/applications?includeJobPosting=true&limit=100')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const items = response.body.items || response.body;
      
      // Should return all 10 applications
      expect(items.length).toBe(10);
      
      // Each should have job posting data
      items.forEach((app: any, index: number) => {
        expect(app.jobPosting).toBeDefined();
        expect(app.jobPosting.title).toContain('Test Job');
        expect(app.jobPosting.company).toContain('Company');
      });

      // Should still use minimal queries (not 1 + 10)
      console.log(`\n📊 Total queries for 10 applications: ${queryCount}`);
      expect(queryCount).toBeLessThanOrEqual(3);
    });

    it('should use fewer queries than N+1 (performance benchmark)', async () => {
      const n = applicationIds.length; // 10 applications
      
      await request(app.getHttpServer())
        .get('/api/v1/applications?includeJobPosting=true&limit=100')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // N+1 would be 1 + N = 11 queries
      // Optimized should be ≤ 3 queries
      const expectedN1Queries = 1 + n; // 11
      const actualQueries = queryCount;

      console.log(`\n⚡ Performance Comparison:`);
      console.log(`  N+1 queries (BAD): ${expectedN1Queries}`);
      console.log(`  Actual queries (GOOD): ${actualQueries}`);
      console.log(`  Improvement: ${Math.round((1 - actualQueries / expectedN1Queries) * 100)}%`);

      expect(actualQueries).toBeLessThan(expectedN1Queries);
      expect(actualQueries).toBeLessThanOrEqual(3);
    });
  });

  describe('GET /api/v1/applications without includeJobPosting', () => {
    it('should use minimal queries when NOT including job posting', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should use 2 queries: 1 for applications, 1 for count
      expect(queryCount).toBeLessThanOrEqual(2);

      const items = response.body.items || response.body;
      expect(items.length).toBeGreaterThan(0);
      
      // Should NOT include job posting
      if (items[0]) {
        expect(items[0].jobPosting).toBeUndefined();
      }
    });
  });

  describe('Pagination should not affect query count', () => {
    it('should use same number of queries for different page sizes', async () => {
      // Test with page size 5
      await request(app.getHttpServer())
        .get('/api/v1/applications?includeJobPosting=true&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const queriesPage5 = queryCount;

      // Reset counter
      queryCount = 0;

      // Test with page size 10
      await request(app.getHttpServer())
        .get('/api/v1/applications?includeJobPosting=true&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const queriesPage10 = queryCount;

      console.log(`\n📊 Query count comparison:`);
      console.log(`  Page size 5: ${queriesPage5} queries`);
      console.log(`  Page size 10: ${queriesPage10} queries`);

      // Should use same number of queries regardless of page size
      expect(queriesPage5).toBe(queriesPage10);
      expect(queriesPage5).toBeLessThanOrEqual(3);
    });
  });
});
