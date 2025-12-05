import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from '../../auth.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigService } from '@/config/config.service';
import { AuditLoggerService } from '@/common/audit-logger';
import { SessionService } from '../../session.service';
import { MockHelper } from '../../../../test/helpers/mock.helper';

// Mock argon2
jest.mock('argon2');

describe('AuthService (Unit)', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let sessionService: SessionService;
  let auditLogger: AuditLoggerService;

  const mockUser = {
    id: 'user-id-123',
    email: 'test@smartapply.com',
    password: 'hashedPassword123',
    firstName: 'Test',
    lastName: 'User',
    provider: 'local',
    providerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = MockHelper.createMockPrismaService();
    mockPrisma.refreshToken.findMany = jest.fn().mockResolvedValue([]);
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn().mockReturnValue({ sub: mockUser.id }),
          },
        },
        {
          provide: ConfigService,
          useValue: MockHelper.createMockConfigService(),
        },
        {
          provide: AuditLoggerService,
          useValue: {
            logRegistration: jest.fn(),
            logLoginAttempt: jest.fn(),
            logLogout: jest.fn(),
            logPasswordChange: jest.fn(),
          },
        },
        {
          provide: SessionService,
          useValue: MockHelper.createMockSessionService(),
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    sessionService = module.get<SessionService>(SessionService);
    auditLogger = module.get<AuditLoggerService>(AuditLoggerService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto = {
      email: 'newuser@smartapply.com',
      password: 'SecurePass123!',
      firstName: 'New',
      lastName: 'User',
    };

    beforeEach(() => {
      // Mock argon2.hash
      (argon2.hash as jest.Mock).mockResolvedValue('hashedPassword');
    });

    it('should successfully register a new user', async () => {
      // Arrange
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
          profile: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      // Mock token generation
      jwtService.sign = jest
        .fn()
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      // Act
      const result = await service.register(registerDto, 'test-agent', '127.0.0.1');

      // Assert
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(registerDto.email);
      expect(argon2.hash).toHaveBeenCalledWith(registerDto.password);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
    });

    it('should throw ConflictException if user already exists', async () => {
      // Arrange
      prisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.register(registerDto, 'test-agent', '127.0.0.1')).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(registerDto, 'test-agent', '127.0.0.1')).rejects.toThrow(
        'User with this email already exists',
      );
    });

    it('should create an empty profile for new user', async () => {
      // Arrange
      const mockTransaction = {
        user: {
          create: jest.fn().mockResolvedValue({
            id: 'new-user-id',
            email: registerDto.email,
            firstName: registerDto.firstName,
            lastName: registerDto.lastName,
            createdAt: new Date(),
          }),
        },
        profile: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      prisma.user.findUnique = jest.fn().mockResolvedValue(null);
      prisma.$transaction = jest.fn().mockImplementation(async (callback) => {
        return callback(mockTransaction);
      });

      // Act
      await service.register(registerDto, 'test-agent', '127.0.0.1');

      // Assert
      expect(mockTransaction.profile.create).toHaveBeenCalledWith({
        data: { userId: 'new-user-id' },
      });
    });

    it('should log registration event', async () => {
      // Arrange
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
          profile: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const mockRequest = { ip: '127.0.0.1', headers: {} } as any;

      // Act
      await service.register(registerDto, 'test-agent', '127.0.0.1', mockRequest);

      // Assert
      expect(auditLogger.logRegistration).toHaveBeenCalledWith(
        registerDto.email,
        expect.any(String),
        mockRequest,
      );
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@smartapply.com',
      password: 'SecurePass123!',
    };

    it('should successfully login with valid credentials', async () => {
      // Arrange
      prisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      jwtService.sign = jest
        .fn()
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      // Act
      const result = await service.login(loginDto, 'test-agent', '127.0.0.1');

      // Assert
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(loginDto.email);
      expect(argon2.verify).toHaveBeenCalledWith(mockUser.password, loginDto.password);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      // Arrange
      prisma.user.findUnique = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(loginDto, 'test-agent', '127.0.0.1')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto, 'test-agent', '127.0.0.1')).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      // Arrange
      prisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(service.login(loginDto, 'test-agent', '127.0.0.1')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto, 'test-agent', '127.0.0.1')).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should log successful login event', async () => {
      // Arrange
      prisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      const mockRequest = { ip: '127.0.0.1', headers: {} } as any;

      // Act
      await service.login(loginDto, 'test-agent', '127.0.0.1', mockRequest);

      // Assert
      expect(auditLogger.logLoginAttempt).toHaveBeenCalledWith(mockUser.email, true, mockRequest, mockUser.id);
    });

    it('should log failed login attempt', async () => {
      // Arrange
      prisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      const mockRequest = { ip: '127.0.0.1', headers: {} } as any;

      // Act & Assert
      await expect(service.login(loginDto, 'test-agent', '127.0.0.1', mockRequest)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(auditLogger.logLoginAttempt).toHaveBeenCalledWith(loginDto.email, false, mockRequest, mockUser.id);
    });
  });

  describe('validateUser', () => {
    it('should return user when validation succeeds', async () => {
      // Arrange
      prisma.user.findUnique = jest.fn().mockResolvedValue(mockUser);

      // Act
      const result = await service.validateUser(mockUser.id);

      // Assert
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
      });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      // Arrange
      prisma.user.findUnique = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(service.validateUser('non-existent-id')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('generateTokens', () => {
    it('should generate both access and refresh tokens', async () => {
      // Arrange
      jwtService.sign = jest
        .fn()
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      // Act
      const result = await service['generateTokens'](
        mockUser.id,
        mockUser.email,
        'test-agent',
        '127.0.0.1',
      );

      // Assert
      expect(result).toHaveProperty('accessToken', 'access-token');
      expect(result).toHaveProperty('refreshToken', 'refresh-token');
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('should create session with refresh token', async () => {
      // Arrange
      jwtService.sign = jest
        .fn()
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      // Act
      await service['generateTokens'](mockUser.id, mockUser.email, 'test-agent', '127.0.0.1');

      // Assert
      expect(sessionService.createSession).toHaveBeenCalledWith(
        mockUser.id,
        'refresh-token',
        'test-agent',
        '127.0.0.1',
      );
    });
  });
});
