import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';

/**
 * AdminGuard
 *
 * Allow-list based admin authorization. Run AFTER `JwtAuthGuard` so that
 * `request.user` is populated. The user's email is looked up against the
 * `ADMIN_EMAILS` env var (comma-separated, case-insensitive).
 *
 * If `ADMIN_EMAILS` is empty, every request is denied — fail-closed by
 * default so a forgotten env var can't accidentally open admin endpoints.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, AdminGuard)
 *   @Controller('admin/...')
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { id?: string; email?: string } | undefined;

    if (!user?.email) {
      throw new ForbiddenException('Admin access requires an authenticated user');
    }

    const allowed = this.config.adminEmails;
    if (allowed.length === 0) {
      this.logger.warn(
        `Admin endpoint blocked: ADMIN_EMAILS is empty (user=${user.email}). Set ADMIN_EMAILS to enable.`,
      );
      throw new ForbiddenException('Admin endpoints are disabled');
    }

    if (!allowed.includes(user.email.toLowerCase())) {
      this.logger.warn(`Admin access denied for ${user.email}`);
      throw new ForbiddenException('Not authorized');
    }

    return true;
  }
}
