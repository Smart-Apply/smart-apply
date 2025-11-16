import { Controller, Post, Body, Get, UseGuards, Res, Req } from '@nestjs/common';
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
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);

    // Set HttpOnly cookie
    this.setAuthCookie(res, result.accessToken);

    // Return user info only (not the token)
    return { user: result.user };
  }

  @Public()
  @UseThrottler('auth')
  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);

    // Set HttpOnly cookie
    this.setAuthCookie(res, result.accessToken);

    // Return user info only (not the token)
    return { user: result.user };
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
  @ApiOperation({ summary: 'Logout user (clear cookie)' })
  async logout(@Res({ passthrough: true }) res: Response) {
    // Force no-cache to prevent browser from caching this endpoint
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Clear the cookie
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: this.configService.isProduction,
      sameSite: 'strict',
      path: '/',
    });

    return { message: 'Logged out successfully' };
  }

  /**
   * Helper method to set authentication cookie with secure attributes
   */
  private setAuthCookie(res: Response, token: string) {
    const isProduction = this.configService.isProduction;

    res.cookie('access_token', token, {
      httpOnly: true, // Prevents JavaScript access (XSS protection)
      secure: isProduction, // HTTPS only in production
      sameSite: 'strict', // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matches JWT expiry)
      path: '/', // Available for all routes
    });
  }
}
