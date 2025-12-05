import { JwtService } from '@nestjs/jwt';

/**
 * Authentication Test Helper
 * Provides utilities for auth testing
 */
export class AuthHelper {
  private jwtService: JwtService;

  constructor() {
    this.jwtService = new JwtService({
      secret: 'test-secret-key-minimum-64-characters-for-security-requirements',
      signOptions: { expiresIn: '1h' },
    });
  }

  /**
   * Create test user credentials
   */
  createTestUser() {
    return {
      id: 'test-user-id-123',
      email: 'test@smartapply.com',
      firstName: 'Test',
      lastName: 'User',
      password: 'Test123!@#',
    };
  }

  /**
   * Generate JWT token for test user
   */
  generateToken(userId: string = 'test-user-id-123'): string {
    return this.jwtService.sign({ sub: userId });
  }

  /**
   * Create Authorization header
   */
  getAuthHeader(token?: string): { Authorization: string } {
    const jwt = token || this.generateToken();
    return { Authorization: `Bearer ${jwt}` };
  }

  /**
   * Create Cookie header with JWT (HttpOnly simulation)
   */
  getCookieHeader(token?: string): { Cookie: string } {
    const jwt = token || this.generateToken();
    return { Cookie: `access_token=${jwt}` };
  }

  /**
   * Decode JWT token (for assertions)
   */
  decodeToken(token: string) {
    return this.jwtService.decode(token);
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): boolean {
    try {
      this.jwtService.verify(token);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create expired token (for testing token refresh)
   */
  generateExpiredToken(userId: string = 'test-user-id-123'): string {
    return this.jwtService.sign(
      { sub: userId },
      { expiresIn: '-1h' }, // Already expired
    );
  }
}
