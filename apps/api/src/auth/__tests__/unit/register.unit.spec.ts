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
import { ConflictWithCode } from '@/common/exceptions/coded-http.exception';
import { MockHelper } from '../../../../test/helpers/mock.helper';

vi.mock('argon2');

describe('AuthService.register (Unit)', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const registerDto = {
    email: 'newuser@smartapply.com',
    password: 'SecurePass123!',
    firstName: 'New',
    lastName: 'User',
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
            verify: vi.fn().mockReturnValue({ sub: 'new-user-id' }),
          },
        },
        { provide: ConfigService, useValue: MockHelper.createMockConfigService() },
        {
          provide: AuditLoggerService,
          useValue: { logRegistration: vi.fn(), logLoginAttempt: vi.fn() },
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
    (argon2.hash as Mock).mockResolvedValue('hashedPassword');
  });

  it('should successfully register a new user', async () => {
    prisma.user.findUnique = vi.fn().mockResolvedValue(null);
    prisma.$transaction = vi.fn().mockImplementation(async (callback) => {
      return callback({
        user: {
          create: vi.fn().mockResolvedValue({
            id: 'new-user-id',
            email: registerDto.email,
            firstName: registerDto.firstName,
            lastName: registerDto.lastName,
            createdAt: new Date(),
          }),
        },
        profile: { create: vi.fn().mockResolvedValue({}) },
      });
    });

    jwtService.sign = vi
      .fn()
      .mockReturnValueOnce('access-token')
      .mockReturnValueOnce('refresh-token');

    const result = await service.register(registerDto, 'test-agent', '127.0.0.1');

    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result.user.email).toBe(registerDto.email);
    expect(argon2.hash).toHaveBeenCalledWith(registerDto.password);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: registerDto.email },
    });
  });

  it('should throw ConflictWithCode if user already exists', async () => {
    prisma.user.findUnique = vi.fn().mockResolvedValue({ id: 'existing', email: registerDto.email });

    await expect(
      service.register(registerDto, 'test-agent', '127.0.0.1'),
    ).rejects.toThrow(ConflictWithCode);
  });
});
