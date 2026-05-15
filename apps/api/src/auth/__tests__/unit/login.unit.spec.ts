import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { Mock } from 'vitest';
import { AuthService } from '../../auth.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigService } from '@/config/config.service';
import { AuditLoggerService } from '@/common/audit-logger';
import { SessionService } from '../../session.service';
import { TwoFactorService } from '../../two-factor.service';
import { EmailService } from '@/email/email.service';
import { SubscriptionService } from '@/subscription/subscription.service';
import { UnauthorizedWithCode } from '@/common/exceptions/coded-http.exception';
import { MockHelper } from '../../../../test/helpers/mock.helper';

vi.mock('argon2');

describe('AuthService.login (Unit)', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockUser = {
    id: 'user-id-123',
    email: 'test@smartapply.com',
    password: 'hashedPassword123',
    firstName: 'Test',
    lastName: 'User',
    provider: 'local',
    twoFactorAuth: null,
  };

  beforeEach(async () => {
    const mockPrisma = MockHelper.createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: JwtService,
          useValue: {
            sign: vi.fn().mockReturnValue('mock-jwt-token'),
            verify: vi.fn().mockReturnValue({ sub: mockUser.id }),
          },
        },
        { provide: ConfigService, useValue: MockHelper.createMockConfigService() },
        {
          provide: AuditLoggerService,
          useValue: { logLoginAttempt: vi.fn(), logRegistration: vi.fn() },
        },
        { provide: SessionService, useValue: MockHelper.createMockSessionService() },
        {
          provide: SubscriptionService,
          useValue: { getOrCreateSubscription: vi.fn().mockResolvedValue({}) },
        },
        {
          provide: TwoFactorService,
          useValue: { isTrustedDevice: vi.fn().mockResolvedValue(false) },
        },
        { provide: EmailService, useValue: { sendVerificationEmail: vi.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    vi.clearAllMocks();
  });

  it('should successfully login with valid credentials', async () => {
    prisma.user.findUnique = vi.fn().mockResolvedValue(mockUser);
    (argon2.verify as Mock).mockResolvedValue(true);
    (argon2.hash as Mock).mockResolvedValue('hashed-refresh-token');
    jwtService.sign = vi
      .fn()
      .mockReturnValueOnce('access-token')
      .mockReturnValueOnce('refresh-token');

    const result = await service.login(
      { email: mockUser.email, password: 'SecurePass123!' },
      'test-agent',
      '127.0.0.1',
    );

    expect(result.user?.email).toBe(mockUser.email);
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(argon2.verify).toHaveBeenCalledWith(mockUser.password, 'SecurePass123!');
  });

  it('should throw UnauthorizedWithCode for non-existent user', async () => {
    prisma.user.findUnique = vi.fn().mockResolvedValue(null);

    await expect(
      service.login({ email: 'nope@x.com', password: 'pw' }, 'ua', '127.0.0.1'),
    ).rejects.toThrow(UnauthorizedWithCode);
  });

  it('should throw UnauthorizedWithCode for invalid password', async () => {
    prisma.user.findUnique = vi.fn().mockResolvedValue(mockUser);
    (argon2.verify as Mock).mockResolvedValue(false);

    await expect(
      service.login({ email: mockUser.email, password: 'wrong' }, 'ua', '127.0.0.1'),
    ).rejects.toThrow(UnauthorizedWithCode);
  });
});
