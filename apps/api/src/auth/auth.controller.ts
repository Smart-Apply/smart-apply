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
  getCsrfToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Generate CSRF token using the csrf-csrf utility
    // This is stored in the app instance during bootstrap
    const generateToken = req.app.get('csrfGenerateToken');
    const csrfToken = generateToken(req, res);
    
    return { 
      csrfToken,
      message: 'CSRF token generated successfully. Include this token in X-CSRF-Token header for state-changing requests.'
    };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@CurrentUser() user: any) {
    return user;
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user (clear cookie)' })
  async logout(@Res({ passthrough: true }) res: Response) {
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
