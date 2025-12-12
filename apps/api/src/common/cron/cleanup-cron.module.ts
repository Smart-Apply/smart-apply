import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CleanupCron } from './cleanup.cron';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '../../config/config.service';
import { ConfigModule } from '../../config/config.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
  ],
  providers: [CleanupCron, PrismaService, ConfigService],
  exports: [CleanupCron],
})
export class CleanupCronModule {}
