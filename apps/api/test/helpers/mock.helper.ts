import { PrismaService } from '@/prisma/prisma.service';
import { LLMService } from '@/llm/llm.service';
import { StorageService } from '@/storage/storage.service';
import { JobsService } from '@/jobs/jobs.service';
import { PdfService } from '@/pdf/pdf.service';

/**
 * Mock Factory Helper
 * Creates consistent mocks for testing
 */
export class MockHelper {
  /**
   * Create mock PrismaService
   */
  static createMockPrismaService() {
    return {
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      profile: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      jobPosting: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      application: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      skill: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      experience: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      education: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      certificate: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      project: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      language: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      refreshToken: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({
          id: 'refresh-token-id',
          token: 'refresh-token-hash',
          userId: 'user-id-123',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        }),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
      session: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn((fn) => fn),
    } as unknown as PrismaService;
  }

  /**
   * Create mock LLMService
   */
  static createMockLLMService() {
    return {
      generate: vi.fn().mockResolvedValue('Generated content'),
      generateCoverLetter: vi.fn().mockResolvedValue('Cover letter content'),
      generateResume: vi.fn().mockResolvedValue('Resume content'),
      translate: vi.fn().mockResolvedValue('Translated text'),
      detectLanguage: vi.fn().mockReturnValue('en'),
      categorizeSkills: vi.fn().mockResolvedValue({ technical: [], soft: [], other: [] }),
      translateSummary: vi.fn().mockResolvedValue('Translated summary'),
    } as unknown as LLMService;
  }

  /**
   * Create mock StorageService
   */
  static createMockStorageService() {
    return {
      upload: vi.fn().mockResolvedValue('file-key-123'),
      download: vi.fn().mockResolvedValue(Buffer.from('file content')),
      delete: vi.fn().mockResolvedValue(undefined),
      getSignedUrl: vi.fn().mockResolvedValue('https://blob.storage.azure.com/signed-url'),
      exists: vi.fn().mockResolvedValue(true),
    } as unknown as StorageService;
  }

  /**
   * Create mock JobsService
   */
  static createMockJobsService() {
    return {
      publishJob: vi.fn().mockResolvedValue('job-id-123'),
      getJobStatus: vi.fn().mockResolvedValue({ status: 'COMPLETED' }),
      subscribeToQueue: vi.fn().mockResolvedValue(undefined),
      healthCheck: vi.fn().mockResolvedValue(true),
    } as unknown as JobsService;
  }

  /**
   * Create mock PdfService
   */
  static createMockPdfService() {
    return {
      generateCoverLetterPDF: vi.fn().mockResolvedValue(Buffer.from('pdf content')),
      generateResumePDF: vi.fn().mockResolvedValue(Buffer.from('pdf content')),
      validateATS: vi.fn().mockResolvedValue({
        score: 95,
        issues: [],
        passed: true,
      }),
    } as unknown as PdfService;
  }

  /**
   * Create mock ConfigService
   */
  static createMockConfigService() {
    return {
      get: vi.fn((key: string) => {
        const config = {
          JWT_SECRET: 'test-secret-key-minimum-64-characters-for-security-requirements',
          JWT_EXPIRES_IN: '7d',
          JWT_REFRESH_EXPIRES_IN: '30d',
          DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
          STORAGE_DRIVER: 'disk',
          JOBS_PROVIDER: 'in-memory',
          LLM_PROVIDER: 'mock',
          CORS_ORIGINS: 'http://localhost:3000,http://localhost:3001',
        };
        return config[key];
      }),
      // Getter properties for custom ConfigService
      jwtSecret: 'test-secret-key-minimum-64-characters-for-security-requirements',
      jwtExpiresIn: '7d',
      jwtAccessExpiresIn: '7d',
      jwtRefreshExpiresIn: '30d',
      databaseUrl: 'postgresql://test:test@localhost:5432/test_db',
      storageDriver: 'disk',
      jobsProvider: 'in-memory',
      llmProvider: 'mock',
    };
  }

  /**
   * Create mock Logger
   */
  static createMockLogger() {
    return {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
    };
  }

  /**
   * Create mock ExecutionContext (for Guards)
   */
  static createMockExecutionContext(user?: any, request?: any) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: user || { id: 'test-user-id' },
          headers: {},
          ip: '127.0.0.1',
          method: 'GET',
          url: '/api/v1/test',
          ...request,
        }),
        getResponse: () => ({
          status: vi.fn().mockReturnThis(),
          json: vi.fn(),
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  }

  /**
   * Create mock CallHandler (for Interceptors)
   */
  static createMockCallHandler(data?: any) {
    return {
      handle: vi.fn().mockReturnValue({
        pipe: vi.fn().mockReturnValue(data),
      }),
    } as any;
  }

  /**
   * Create mock SessionService
   */
  static createMockSessionService() {
    return {
      createSession: vi.fn().mockResolvedValue({
        id: 'session-id-123',
        userId: 'user-id-123',
        refreshToken: 'refresh-token',
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      }),
      findSession: vi.fn().mockResolvedValue(null),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      deleteAllUserSessions: vi.fn().mockResolvedValue({ count: 0 }),
      getUserSessions: vi.fn().mockResolvedValue([]),
    };
  }
}
