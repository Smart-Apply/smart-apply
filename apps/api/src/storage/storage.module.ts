import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { DiskStorageProvider } from './providers/disk-storage.provider';
import { R2StorageProvider } from './providers/r2-storage.provider';
import { ConfigService } from '../config/config.service';

@Module({
  providers: [
    {
      provide: 'STORAGE_PROVIDER',
      useFactory: (configService: ConfigService) => {
        const driver = configService.storageDriver;
        if (driver === 'r2') {
          return new R2StorageProvider(configService);
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

