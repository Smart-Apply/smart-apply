import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { StorageProvider } from '../storage.interface';

@Injectable()
export class DiskStorageProvider implements StorageProvider {
  private readonly logger = new Logger(DiskStorageProvider.name);
  private readonly uploadDir: string;

  constructor() {
    // Store files in uploads directory at project root
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.ensureUploadDir();
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      this.logger.log(`Upload directory ready: ${this.uploadDir}`);
    } catch (error) {
      this.logger.error(`Failed to create upload directory: ${error.message}`);
      throw error;
    }
  }

  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<string> {
    const filePath = path.join(this.uploadDir, key);
    const fileDir = path.dirname(filePath);

    try {
      // Ensure subdirectories exist
      await fs.mkdir(fileDir, { recursive: true });

      // Write file
      await fs.writeFile(filePath, buffer);

      this.logger.log(`File uploaded successfully: ${key}`);
      return key;
    } catch (error) {
      this.logger.error(`Failed to upload file ${key}: ${error.message}`);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  async download(key: string): Promise<Buffer> {
    const filePath = path.join(this.uploadDir, key);

    try {
      const buffer = await fs.readFile(filePath);
      this.logger.log(`File downloaded successfully: ${key}`);
      return buffer;
    } catch (error) {
      this.logger.error(`Failed to download file ${key}: ${error.message}`);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.uploadDir, key);

    try {
      await fs.unlink(filePath);
      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${key}: ${error.message}`);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async getSignedUrl(key: string, _expiresInSeconds: number): Promise<string> {
    // For disk storage, return a simple file path
    // In a real app, you might want to generate a temporary token
    const filePath = path.join(this.uploadDir, key);

    try {
      // Check if file exists
      await fs.access(filePath);
      return `file://${filePath}`;
    } catch (error) {
      this.logger.error(`File not found for signed URL: ${key}`);
      throw new Error(`File not found: ${key}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await fs.access(this.uploadDir);
      return true;
    } catch (error) {
      this.logger.error('Disk storage health check failed');
      return false;
    }
  }
}
