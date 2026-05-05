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
import { ConflictWithCode } from '@/common/exceptions/coded-http.exception';
import { MockHelper } from '../../../../test/helpers/mock.helper';

jest.mock('argon2');

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
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn().mockReturnValue({ sub: 'new-user-id' }),
          },
        },
        { provide: ConfigService, useValue: MockHelper.createMockConfigService() },
        {
          provide: AuditLoggerService,
          useValue: { logRegistration: jest.fn(), logLoginAttempt: jest.fn() },
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
    (argon2.hash as jest.Mock).mockResolvedValue('hashedPassword');
  });

  it('should successfully register a new user', async () => {
    prisma.user.findUnique = jest.fn().mockResolvedValue(null);
    prisma.$transaction = jest.fn().mockImplementation(async (callback) => {
      return callback({
        user: {
          create: jest.fn().mockResolvedValue({
            id: 'new-user-id',
            email: registerDto.email,
            firstName: registerDto.firstName,
            lastName: registerDto.lastName,
            createdAt: new Date(),
          }),
        },
        profile: { create: jest.fn().mockResolvedValue({}) },
      });
    });

    jwtService.sign = jest
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
    prisma.user.findUnique = jest.fn().mockResolvedValue({ id: 'existing', email: registerDto.email });

    await expect(
      service.register(registerDto, 'test-agent', '127.0.0.1'),
    ).rejects.toThrow(ConflictWithCode);
  });
});
