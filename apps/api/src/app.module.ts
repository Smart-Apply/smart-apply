import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StorageModule } from './storage/storage.module';
import { LLMModule } from './llm/llm.module';
import { ProfileModule } from './profile/profile.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
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
    // TODO: Add UploadsModule, JobPostingsModule, ApplicationsModule
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
