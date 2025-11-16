import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StorageModule } from './storage/storage.module';
import { LLMModule } from './llm/llm.module';
import { ProfileModule } from './profile/profile.module';
import { UploadsModule } from './uploads/uploads.module';
import { JobPostingsModule } from './job-postings/job-postings.module';
import { PdfModule } from './pdf/pdf.module';
import { JobsModule } from './jobs/jobs.module';
import { ApplicationsModule } from './applications/applications.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { ConfigService } from './config/config.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.rateLimitTtl,
            limit: config.rateLimitMax,
          },
          {
            name: 'auth',
            ttl: config.rateLimitAuthTtl,
            limit: config.rateLimitAuthMax,
          },
        ],
      }),
    }),
    AuthModule,
    StorageModule,
    LLMModule,
    ProfileModule,
    UploadsModule,
    JobPostingsModule,
    PdfModule,
    JobsModule,
    ApplicationsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}
