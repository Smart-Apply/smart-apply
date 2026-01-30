import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { LoggerModule } from './logger/logger.module';
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
import { TimeoutMiddleware, RequestIdMiddleware } from './common/middleware';
import { SubscriptionModule } from './subscription/subscription.module';
import { InterviewsModule } from './interviews/interviews.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    // Core infrastructure modules (must be first)
    ConfigModule,
    LoggerModule, // Structured logging with Pino - must be early for proper log capture
    PrismaModule,
    SubscriptionModule,
    AuditLoggerModule,
    CleanupCronModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDevelopment = config.nodeEnv === 'development';
        const developmentLimit = 10000000; // 10 million requests per minute in development
        const defaultLimit = isDevelopment ? developmentLimit : config.rateLimitMax;

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
            {
              name: 'resume-parser',
              ttl: 3600000, // 1 hour
              limit: 10, // 10 resume parses per hour per user - LLM calls are expensive
            },
            {
              name: 'translation',
              ttl: 900000, // 15 minutes
              limit: 10, // 10 translation requests per 15 minutes - LLM calls are expensive
            },
            {
              name: 'email',
              ttl: 3600000, // 1 hour
              limit: 3, // 3 email requests per hour per user - prevent spam
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
    InterviewsModule,
    EmailModule,
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
    // Apply request ID middleware first for request tracing
    consumer.apply(RequestIdMiddleware).forRoutes('*');
    // Apply global request timeout middleware to all routes
    consumer.apply(TimeoutMiddleware).forRoutes('*');
  }
}
