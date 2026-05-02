import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';

/**
 * AdminModule
 *
 * Admin-only endpoints (allow-listed via `ADMIN_EMAILS`). PrismaService and
 * SubscriptionService are already global, so we only need to declare the
 * controller + guard here.
 */
@Module({
  controllers: [AdminController],
  providers: [AdminGuard],
})
export class AdminModule {}
