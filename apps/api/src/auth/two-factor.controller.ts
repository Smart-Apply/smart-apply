import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { TwoFactorService } from './two-factor.service';
import {
  Verify2FASetupDto,
  Disable2FADto,
  RegenerateBackupCodesDto,
  Setup2FAResponseDto,
  TwoFactorStatusResponseDto,
  TrustedDeviceResponseDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UseThrottler } from '../common/decorators/throttle.decorator';

@ApiTags('auth/2fa')
@Controller('auth/2fa')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class TwoFactorController {
  constructor(private twoFactorService: TwoFactorService) {}

  // ===== SETUP ENDPOINTS =====

  @Post('setup')
  @ApiOperation({ summary: 'Start 2FA setup - generates secret and QR code' })
  async startSetup(@CurrentUser() user: any): Promise<Setup2FAResponseDto> {
    return this.twoFactorService.generateSetupSecret(user.id, user.email);
  }

  @Post('setup/verify')
  @UseThrottler('auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify TOTP code and enable 2FA' })
  async verifySetup(
    @CurrentUser() user: any,
    @Body() dto: Verify2FASetupDto,
    @Req() req: Request,
  ): Promise<{ backupCodes: string[] }> {
    return this.twoFactorService.verifyAndEnable(user.id, dto.tempSecret, dto.code, req);
  }

  @Post('disable')
  @UseThrottler('auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable 2FA (requires password)' })
  async disable(
    @CurrentUser() user: any,
    @Body() dto: Disable2FADto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    await this.twoFactorService.disable(user.id, dto.password, req);
    return { message: '2FA has been disabled successfully' };
  }

  // ===== STATUS ENDPOINTS =====

  @Get('status')
  @ApiOperation({ summary: 'Get 2FA status for current user' })
  async getStatus(@CurrentUser() user: any): Promise<TwoFactorStatusResponseDto> {
    return this.twoFactorService.get2FAStatus(user.id);
  }

  // ===== BACKUP CODES =====

  @Post('backup-codes/regenerate')
  @UseThrottler('auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate backup codes (invalidates existing codes)' })
  async regenerateBackupCodes(
    @CurrentUser() user: any,
    @Body() dto: RegenerateBackupCodesDto,
    @Req() req: Request,
  ): Promise<{ backupCodes: string[] }> {
    const backupCodes = await this.twoFactorService.regenerateBackupCodes(
      user.id,
      dto.password,
      req,
    );
    return { backupCodes };
  }

  // ===== TRUSTED DEVICES =====

  @Get('trusted-devices')
  @ApiOperation({ summary: 'Get list of trusted devices' })
  async getTrustedDevices(@CurrentUser() user: any): Promise<TrustedDeviceResponseDto[]> {
    return this.twoFactorService.getTrustedDevices(user.id);
  }

  @Delete('trusted-devices/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a specific trusted device' })
  async revokeTrustedDevice(
    @CurrentUser() user: any,
    @Param('id') deviceId: string,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    await this.twoFactorService.revokeTrustedDevice(user.id, deviceId, req);
    return { message: 'Trusted device has been revoked' };
  }

  @Delete('trusted-devices')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all trusted devices' })
  async revokeAllTrustedDevices(
    @CurrentUser() user: any,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    await this.twoFactorService.revokeAllTrustedDevices(user.id, req);
    return { message: 'All trusted devices have been revoked' };
  }
}
