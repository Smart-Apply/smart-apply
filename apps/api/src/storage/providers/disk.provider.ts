import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { StorageProvider } from '../storage.interface';

@Injectable()
export class DiskStorageProvider implements StorageProvider {
  private readonly logger = new Logger(DiskStorageProvider.name);
  private readonly storagePath = path.join(process.cwd(), 'storage');

  constructor() {
    this.ensureStorageDir();
  }

  private async ensureStorageDir() {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create storage directory', error);
    }
  }

  async upload(fileName: string, content: Buffer, _mimeType: string): Promise<string> {
    const key = `${Date.now()}-${fileName}`;
    const filePath = path.join(this.storagePath, key);

    await fs.writeFile(filePath, content);
    this.logger.log(`File uploaded: ${key}`);

    return key;
  }

  async download(key: string): Promise<Buffer> {
    const filePath = path.join(this.storagePath, key);
    return await fs.readFile(filePath);
  }

  async getSignedUrl(key: string, _expiresIn: number = 3600): Promise<string> {
    // For local development, return a simple file path
    // In production with a real web server, you'd generate a proper signed URL
    return `/api/v1/storage/${key}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.storagePath, key);
    await fs.unlink(filePath);
    this.logger.log(`File deleted: ${key}`);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = path.join(this.storagePath, key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check if storage directory is accessible
      await fs.access(this.storagePath);
      // Try to write and delete a test file
      const testKey = '.health-check';
      const testPath = path.join(this.storagePath, testKey);
      await fs.writeFile(testPath, 'health-check');
      await fs.unlink(testPath);
      return true;
    } catch (error) {
      this.logger.error('Storage health check failed', error);
      return false;
    }
  }
}
