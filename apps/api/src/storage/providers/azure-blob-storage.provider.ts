import { Injectable, Logger } from '@nestjs/common';
import {
  BlobServiceClient,
  ContainerClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import { StorageProvider } from '../storage.interface';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class AzureBlobStorageProvider implements StorageProvider {
  private readonly logger = new Logger(AzureBlobStorageProvider.name);
  private readonly containerClient: ContainerClient;
  private readonly accountName: string;
  private readonly credential: StorageSharedKeyCredential | null = null;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.configService.azureStorageConnectionString;
    const containerName = this.configService.azureStorageContainer;
    this.accountName = this.configService.azureStorageAccount || '';

    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is required for Azure Blob Storage');
    }

    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      this.containerClient = blobServiceClient.getContainerClient(containerName);

      // Extract account key from connection string for SAS generation
      const keyMatch = connectionString.match(/AccountKey=([^;]+)/);
      if (keyMatch && this.accountName) {
        this.credential = new StorageSharedKeyCredential(this.accountName, keyMatch[1]);
      }

      this.logger.log(`Azure Blob Storage initialized: ${containerName}`);
    } catch (error) {
      this.logger.error(`Failed to initialize Azure Blob Storage: ${error.message}`);
      throw error;
    }
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(key);

    try {
      await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: {
          blobContentType: mimeType,
        },
      });

      this.logger.log(`File uploaded to Azure Blob: ${key}`);
      return key;
    } catch (error) {
      this.logger.error(`Failed to upload file to Azure Blob ${key}: ${error.message}`);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  async download(key: string): Promise<Buffer> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(key);

    try {
      const downloadResponse = await blockBlobClient.download();
      const buffer = await this.streamToBuffer(downloadResponse.readableStreamBody);

      this.logger.log(`File downloaded from Azure Blob: ${key}`);
      return buffer;
    } catch (error) {
      this.logger.error(`Failed to download file from Azure Blob ${key}: ${error.message}`);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(key);

    try {
      await blockBlobClient.delete();
      this.logger.log(`File deleted from Azure Blob: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from Azure Blob ${key}: ${error.message}`);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(key);

    try {
      if (!this.credential) {
        // Fallback to direct URL without SAS
        this.logger.warn('No credential available for SAS generation, returning direct URL');
        return blockBlobClient.url;
      }

      const expiresOn = new Date();
      expiresOn.setSeconds(expiresOn.getSeconds() + expiresInSeconds);

      const sasToken = generateBlobSASQueryParameters(
        {
          containerName: this.containerClient.containerName,
          blobName: key,
          permissions: BlobSASPermissions.parse('r'), // Read-only
          expiresOn,
        },
        this.credential,
      ).toString();

      const sasUrl = `${blockBlobClient.url}?${sasToken}`;
      this.logger.log(`Generated SAS URL for blob: ${key}`);
      return sasUrl;
    } catch (error) {
      this.logger.error(`Failed to generate SAS URL for ${key}: ${error.message}`);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.containerClient.exists();
      return true;
    } catch (error) {
      this.logger.error('Azure Blob Storage health check failed');
      return false;
    }
  }

  private async streamToBuffer(readableStream: NodeJS.ReadableStream | undefined): Promise<Buffer> {
    if (!readableStream) {
      throw new Error('No readable stream available');
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      readableStream.on('data', (data) => {
        chunks.push(data instanceof Buffer ? data : Buffer.from(data));
      });
      readableStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      readableStream.on('error', reject);
    });
  }
}
