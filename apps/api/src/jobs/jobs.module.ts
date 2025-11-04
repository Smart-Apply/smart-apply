import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LLMModule } from '../llm/llm.module';
import { PdfModule } from '../pdf/pdf.module';
import { StorageModule } from '../storage/storage.module';
import { JobsService } from './jobs.service';
import { InMemoryQueueProvider } from './providers/in-memory-queue.provider';
import { AzureServiceBusProvider } from './providers/azure-service-bus.provider';
import { ApplicationProcessor } from './processors/application.processor';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    LLMModule,
    PdfModule,
    StorageModule,
  ],
  providers: [
    JobsService,
    ApplicationProcessor,
    {
      provide: 'QUEUE_PROVIDER',
      useFactory: (configService: ConfigService) => {
        const driver = configService.jobsDriver;

        if (driver === 'service-bus') {
          return new AzureServiceBusProvider(configService);
        }

        return new InMemoryQueueProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [JobsService],
})
export class JobsModule {}
