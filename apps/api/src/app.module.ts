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
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { ConfigService } from './config/config.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.rateLimitTtl,
          limit: config.rateLimitMax,
        },
      ],
    }),
    AuthModule,
    StorageModule,
    LLMModule,
    ProfileModule,
    UploadsModule,
    JobPostingsModule,
    PdfModule,
    // TODO: Add ApplicationsModule
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
