import { Injectable, Inject, Logger } from '@nestjs/common';
import { StorageProvider } from './storage.interface';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject('STORAGE_PROVIDER')
    private readonly provider: StorageProvider,
  ) {}

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    this.logger.log(`Uploading file: ${key}`);
    return this.provider.upload(key, buffer, mimeType);
  }

  async download(key: string): Promise<Buffer> {
    this.logger.log(`Downloading file: ${key}`);
    return this.provider.download(key);
  }

  async delete(key: string): Promise<void> {
    this.logger.log(`Deleting file: ${key}`);
    return this.provider.delete(key);
  }

  async getSignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    this.logger.log(`Generating signed URL for: ${key}`);
    return this.provider.getSignedUrl(key, expiresInSeconds);
  }

  async healthCheck(): Promise<boolean> {
    return this.provider.healthCheck();
  }
}
