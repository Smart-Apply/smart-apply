import { Controller, Get, Delete, Param, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SessionService } from './session.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto';
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
  @ApiOperation({ summary: 'Get all active sessions for the current user with pagination' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (starts at 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (max: 100)',
    example: 20,
  })
  async getSessions(@CurrentUser() user: any, @Query() paginationQuery: PaginationQueryDto) {
    return this.sessionService.getActiveSessions(
      user.id,
      paginationQuery.page,
      paginationQuery.limit,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a specific session (logout from one device)' })
  async revokeSession(@Param('id') sessionId: string, @CurrentUser() user: any) {
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
