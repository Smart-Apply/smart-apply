import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { LLMModule } from '../llm/llm.module';
import { PdfModule } from '../pdf/pdf.module';
import { StorageModule } from '../storage/storage.module';
import { TemplatesModule } from '../templates/templates.module';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { QStashWebhookController } from './qstash-webhook.controller';
import { InMemoryQueueProvider } from './providers/in-memory-queue.provider';
import { QStashQueueProvider } from './providers/qstash-queue.provider';
import { ApplicationProcessor } from './processors/application.processor';

/**
 * JobsModule wires the queue provider chosen by JOBS_DRIVER:
 *   - 'in-memory' → InMemoryQueueProvider (default; lost on restart)
 *   - 'qstash'    → QStashQueueProvider + QStashWebhookController active
 *
 * The QStash webhook controller is always mounted but inert when the driver
 * isn't qstash — it returns 503 if invoked without a configured provider.
 * This keeps the endpoint URL stable across deploys (useful when toggling).
 */
@Module({
  imports: [ConfigModule, PrismaModule, LLMModule, PdfModule, StorageModule, TemplatesModule],
  controllers: [JobsController, QStashWebhookController],
  providers: [
    JobsService,
    ApplicationProcessor,
    // The actively-used queue provider. Selected at boot from JOBS_DRIVER.
    {
      provide: 'QUEUE_PROVIDER',
      useFactory: (configService: ConfigService, prismaService: PrismaService) => {
        const driver = configService.jobsDriver;
        if (driver === 'qstash') {
          return new QStashQueueProvider(configService, prismaService);
        }
        return new InMemoryQueueProvider();
      },
      inject: [ConfigService, PrismaService],
    },
    // Provider class used directly by QStashWebhookController. Resolves to:
    //   - the live QStash provider when JOBS_DRIVER=qstash (same instance
    //     as QUEUE_PROVIDER, sharing the in-memory handler registry)
    //   - null otherwise — the controller checks for null and returns 503.
    {
      provide: QStashQueueProvider,
      useFactory: (
        configService: ConfigService,
        prismaService: PrismaService,
        // Inject the already-resolved QUEUE_PROVIDER so we can reuse the
        // same instance when the driver IS qstash. This guarantees handlers
        // registered via QueueProvider.subscribe() are visible to the
        // webhook dispatcher.
        queueProvider: unknown,
      ) => {
        if (configService.jobsDriver !== 'qstash') {
          return null as unknown as QStashQueueProvider;
        }
        if (queueProvider instanceof QStashQueueProvider) {
          return queueProvider;
        }
        // Fallback: shouldn't happen, but build a fresh one if QUEUE_PROVIDER
        // is somehow not the QStash variant despite the driver setting.
        return new QStashQueueProvider(configService, prismaService);
      },
      inject: [ConfigService, PrismaService, 'QUEUE_PROVIDER'],
    },
  ],
  exports: [JobsService],
})
export class JobsModule {}

