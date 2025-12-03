import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { JobsModule } from '../jobs/jobs.module';
import { LLMModule } from '../llm/llm.module';

@Module({
  imports: [TerminusModule, PrismaModule, StorageModule, JobsModule, LLMModule],
  controllers: [HealthController],
})
export class HealthModule {}
