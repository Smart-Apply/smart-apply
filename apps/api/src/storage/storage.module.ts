import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { DiskStorageProvider } from './providers/disk-storage.provider';
import { AzureBlobStorageProvider } from './providers/azure-blob-storage.provider';
import { ConfigService } from '../config/config.service';

@Module({
  providers: [
    {
      provide: 'STORAGE_PROVIDER',
      useFactory: (configService: ConfigService) => {
        const driver = configService.storageDriver;
        if (driver === 'azure') {
          return new AzureBlobStorageProvider(configService);
        }
        return new DiskStorageProvider();
      },
      inject: [ConfigService],
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
