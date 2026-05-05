import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
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

jest.mock('argon2');

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
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn().mockReturnValue({ sub: mockUser.id }),
          },
        },
        { provide: ConfigService, useValue: MockHelper.createMockConfigService() },
        {
          provide: AuditLoggerService,
          useValue: { logLoginAttempt: jest.fn(), logRegistration: jest.fn() },
        },
        { provide: SessionService, useValue: MockHelper.createMockSessionService() },
        {
          provide: SubscriptionService,
          useValue: { getOrCreateSubscription: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: TwoFactorService,
          useValue: { isTrustedDevice: jest.fn().mockResolvedValue(false) },
        },
        { provide: EmailService, useValue: { sendVerificationEmail: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  it('should successfully login with valid credentials', async () => {
    prisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    (argon2.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');
    jwtService.sign = jest
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
    prisma.user.findUnique = jest.fn().mockResolvedValue(null);

    await expect(
      service.login({ email: 'nope@x.com', password: 'pw' }, 'ua', '127.0.0.1'),
    ).rejects.toThrow(UnauthorizedWithCode);
  });

  it('should throw UnauthorizedWithCode for invalid password', async () => {
    prisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);
    (argon2.verify as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({ email: mockUser.email, password: 'wrong' }, 'ua', '127.0.0.1'),
    ).rejects.toThrow(UnauthorizedWithCode);
  });
});
