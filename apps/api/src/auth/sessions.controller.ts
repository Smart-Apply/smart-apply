import { Controller, Get, Delete, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SessionService } from './session.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('auth/sessions')
@Controller('auth/sessions')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class SessionsController {
  constructor(
    private sessionService: SessionService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all active sessions for the current user' })
  async getSessions(@CurrentUser() user: any) {
    return this.sessionService.getActiveSessions(user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a specific session (logout from one device)' })
  async revokeSession(
    @Param('id') sessionId: string,
    @CurrentUser() user: any,
  ) {
    // Verify session belongs to user
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId: user.id },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.sessionService.revokeSession(sessionId);
    return { message: 'Session revoked successfully' };
  }

  @Delete()
  @ApiOperation({ summary: 'Revoke all sessions (logout from all devices)' })
  async revokeAllSessions(@CurrentUser() user: any) {
    await this.sessionService.revokeAllSessions(user.id);
    return { message: 'All sessions revoked successfully' };
  }
}