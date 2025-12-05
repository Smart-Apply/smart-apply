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
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      profile: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      jobPosting: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      application: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      skill: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      experience: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      education: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      certificate: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      project: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      language: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      refreshToken: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
          id: 'refresh-token-id',
          token: 'refresh-token-hash',
          userId: 'user-id-123',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        }),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      session: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((fn) => fn),
    } as unknown as PrismaService;
  }

  /**
   * Create mock LLMService
   */
  static createMockLLMService() {
    return {
      generate: jest.fn().mockResolvedValue('Generated content'),
      generateCoverLetter: jest.fn().mockResolvedValue('Cover letter content'),
      generateResume: jest.fn().mockResolvedValue('Resume content'),
      translate: jest.fn().mockResolvedValue('Translated text'),
      detectLanguage: jest.fn().mockReturnValue('en'),
    } as unknown as LLMService;
  }

  /**
   * Create mock StorageService
   */
  static createMockStorageService() {
    return {
      upload: jest.fn().mockResolvedValue('file-key-123'),
      download: jest.fn().mockResolvedValue(Buffer.from('file content')),
      delete: jest.fn().mockResolvedValue(undefined),
      getSignedUrl: jest.fn().mockResolvedValue('https://blob.storage.azure.com/signed-url'),
      exists: jest.fn().mockResolvedValue(true),
    } as unknown as StorageService;
  }

  /**
   * Create mock JobsService
   */
  static createMockJobsService() {
    return {
      publishJob: jest.fn().mockResolvedValue('job-id-123'),
      getJobStatus: jest.fn().mockResolvedValue({ status: 'COMPLETED' }),
      subscribeToQueue: jest.fn().mockResolvedValue(undefined),
      healthCheck: jest.fn().mockResolvedValue(true),
    } as unknown as JobsService;
  }

  /**
   * Create mock PdfService
   */
  static createMockPdfService() {
    return {
      generateCoverLetterPDF: jest.fn().mockResolvedValue(Buffer.from('pdf content')),
      generateResumePDF: jest.fn().mockResolvedValue(Buffer.from('pdf content')),
      validateATS: jest.fn().mockResolvedValue({
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
      get: jest.fn((key: string) => {
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
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
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
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
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
      handle: jest.fn().mockReturnValue({
        pipe: jest.fn().mockReturnValue(data),
      }),
    } as any;
  }

  /**
   * Create mock SessionService
   */
  static createMockSessionService() {
    return {
      createSession: jest.fn().mockResolvedValue({
        id: 'session-id-123',
        userId: 'user-id-123',
        refreshToken: 'refresh-token',
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      }),
      findSession: jest.fn().mockResolvedValue(null),
      deleteSession: jest.fn().mockResolvedValue(undefined),
      deleteAllUserSessions: jest.fn().mockResolvedValue({ count: 0 }),
      getUserSessions: jest.fn().mockResolvedValue([]),
    };
  }
}
