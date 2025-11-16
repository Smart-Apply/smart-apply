import { Controller, Post, Body, Get, UseGuards, Res, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto';
import { Public } from '../common/decorators/public.decorator';
import { UseThrottler } from '../common/decorators/throttle.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ConfigService } from '../config/config.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Public()
  @UseThrottler('auth')
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;
    
    const result = await this.authService.register(dto, userAgent, ipAddress);

    // Set HttpOnly cookies for both tokens
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    // Return user info only (not the tokens)
    return { user: result.user };
  }

  @Public()
  @UseThrottler('auth')
  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;
    
    const result = await this.authService.login(dto, userAgent, ipAddress);

    // Set HttpOnly cookies for both tokens
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    // Return user info only (not the tokens)
    return { user: result.user };
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;

    const tokens = await this.authService.refresh(refreshToken, userAgent, ipAddress);

    // Set new HttpOnly cookies for both tokens
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    return { message: 'Tokens refreshed successfully' };
  }

  @Public()
  @Get('csrf-token')
  @ApiOperation({ summary: 'Get CSRF token for form submissions' })
  // No @UseThrottler('auth') - use default rate limit (100/15min) instead of strict auth limit (5/15min)
  // CSRF tokens need to be fetched frequently (after logout, on page load, after 403 errors)
  getCsrfToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Check if CSRF is enabled
    if (!this.configService.enableCsrf) {
      return {
        csrfToken: 'csrf-disabled',
        message: 'CSRF protection is disabled. No token required.',
      };
    }

    // Generate CSRF token using the csrf-csrf utility
    // This is stored in the app instance during bootstrap
    const generateToken = req.app.get('csrfGenerateToken');
    if (!generateToken) {
      throw new Error('CSRF token generator not initialized');
    }

    const csrfToken = generateToken(req, res);

    return {
      csrfToken,
      message:
        'CSRF token generated successfully. Include this token in X-CSRF-Token header for state-changing requests.',
    };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@CurrentUser() user: any) {
    return user;
  }

  @Get('logout') // Changed to GET (no CSRF validation required for GET requests)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user (clear cookies and revoke refresh tokens)' })
  async logout(@CurrentUser() user: any, @Res({ passthrough: true }) res: Response) {
    // Revoke all refresh tokens for this user
    await this.authService.revokeRefreshToken(user.id);

    // Force no-cache to prevent browser from caching this endpoint
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Clear both cookies
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: this.configService.isProduction,
      sameSite: 'strict',
      path: '/',
    });

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: this.configService.isProduction,
      sameSite: 'strict',
      path: '/',
    });

    return { message: 'Logged out successfully' };
  }

  /**
   * Helper method to set authentication cookies with secure attributes
   */
  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProduction = this.configService.isProduction;

    // Access token cookie (short-lived: 15 minutes)
    res.cookie('access_token', accessToken, {
      httpOnly: true, // Prevents JavaScript access (XSS protection)
      secure: isProduction, // HTTPS only in production
      sameSite: 'strict', // CSRF protection
      maxAge: 15 * 60 * 1000, // 15 minutes (matches JWT expiry)
      path: '/', // Available for all routes
    });

    // Refresh token cookie (long-lived: 30 days)
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true, // Prevents JavaScript access (XSS protection)
      secure: isProduction, // HTTPS only in production
      sameSite: 'strict', // CSRF protection
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days (matches JWT expiry)
      path: '/', // Available for all routes
    });
  }
}
