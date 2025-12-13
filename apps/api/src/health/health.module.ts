import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';
import { StorageModule } from '../storage/storage.module';
import { JobsModule } from '../jobs/jobs.module';
import { TemplatesModule } from '../templates/templates.module';
import { LLMModule } from '../llm/llm.module';

@Module({
  imports: [TerminusModule, StorageModule, JobsModule, TemplatesModule, LLMModule],
  controllers: [HealthController],
  providers: [PrismaService],
})
export class HealthModule {}
