import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
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
import { TemplatesModule } from './templates/templates.module';
import { UserPreferencesModule } from './user-preferences/user-preferences.module';
import { HealthModule } from './health/health.module';
import { CleanupCronModule } from './common/cron/cleanup-cron.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { ConfigService } from './config/config.service';
import { AuditLoggerModule } from './common/audit-logger';
import { CSPViolationController } from './common/csp/csp-violation.controller';
import { TimeoutMiddleware } from './common/middleware';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuditLoggerModule,
    CleanupCronModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDevelopment = config.nodeEnv === 'development';
        const developmentLimit = 10000000; // 10 million requests per minute in development
        const defaultLimit = isDevelopment ? developmentLimit : config.rateLimitMax;

        // Log rate limit configuration for debugging
        console.log('[ThrottlerModule] Configuration:', {
          environment: config.nodeEnv,
          isDevelopment,
          default: {
            ttl: config.rateLimitTtl,
            limit: defaultLimit,
            configLimit: config.rateLimitMax,
          },
          auth: {
            ttl: config.rateLimitAuthTtl,
            limit: config.rateLimitAuthMax,
          },
        });

        return {
          throttlers: [
            {
              name: 'default',
              ttl: config.rateLimitTtl,
              // In development, effectively disable rate limiting with very high limit
              limit: defaultLimit,
            },
            {
              name: 'auth',
              ttl: config.rateLimitAuthTtl,
              limit: config.rateLimitAuthMax,
            },
            {
              name: 'health-check',
              ttl: 60000, // 60 seconds
              limit: 600, // 600 requests per minute (10/sec) - very generous for polling
            },
          ],
        };
      },
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
    TemplatesModule,
    UserPreferencesModule,
    HealthModule,
  ],
  controllers: [CSPViolationController],
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
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply global request timeout middleware to all routes
    consumer.apply(TimeoutMiddleware).forRoutes('*');
  }
}
