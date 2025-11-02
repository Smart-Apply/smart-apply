import { Injectable, Logger } from '@nestjs/common';
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from '@azure/storage-blob';
import { ConfigService } from '../../config/config.service';
import { StorageProvider } from '../storage.interface';

@Injectable()
export class AzureBlobStorageProvider implements StorageProvider {
  private readonly logger = new Logger(AzureBlobStorageProvider.name);
  private blobServiceClient: BlobServiceClient;
  private containerName: string;
  private accountName: string;

  constructor(private configService: ConfigService) {
    this.containerName = this.configService.azureStorageContainer;
    this.accountName = this.configService.azureStorageAccount || '';
    this.initializeClient();
  }

  private initializeClient() {
    const connectionString = this.configService.azureStorageConnectionString;

    if (!connectionString) {
      throw new Error('Azure Storage connection string not configured');
    }

    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    this.logger.log('Azure Blob Storage client initialized');
  }

  async upload(fileName: string, content: Buffer, mimeType: string): Promise<string> {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);

    // Ensure container exists
    await containerClient.createIfNotExists({ access: 'blob' });

    const blobName = `${Date.now()}-${fileName}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.upload(content, content.length, {
      blobHTTPHeaders: { blobContentType: mimeType },
    });

    this.logger.log(`File uploaded to Azure Blob: ${blobName}`);
    return blobName;
  }

  async download(key: string): Promise<Buffer> {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(key);

    const downloadResponse = await blockBlobClient.download(0);
    const chunks: Buffer[] = [];

    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download blob');
    }

    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(key);

    // Generate SAS token
    const startsOn = new Date();
    const expiresOn = new Date(startsOn.getTime() + expiresIn * 1000);

    // Extract credentials from connection string
    const connectionString = this.configService.azureStorageConnectionString!;
    const accountKeyMatch = connectionString.match(/AccountKey=([^;]+)/);
    const accountKey = accountKeyMatch ? accountKeyMatch[1] : '';

    const sharedKeyCredential = new StorageSharedKeyCredential(this.accountName, accountKey);

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: this.containerName,
        blobName: key,
        permissions: BlobSASPermissions.parse('r'), // Read only
        startsOn,
        expiresOn,
      },
      sharedKeyCredential,
    ).toString();

    return `${blockBlobClient.url}?${sasToken}`;
  }

  async delete(key: string): Promise<void> {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(key);

    await blockBlobClient.delete();
    this.logger.log(`File deleted from Azure Blob: ${key}`);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(key);
      return await blockBlobClient.exists();
    } catch {
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check if we can access the container
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const exists = await containerClient.exists();
      if (!exists) {
        this.logger.warn(`Container ${this.containerName} does not exist`);
        return false;
      }

      // Try to upload and delete a test blob
      const testKey = `.health-check-${Date.now()}`;
      const testContent = Buffer.from('health-check');
      const blockBlobClient = containerClient.getBlockBlobClient(testKey);
      await blockBlobClient.upload(testContent, testContent.length);
      await blockBlobClient.delete();
      return true;
    } catch (error) {
      this.logger.error('Azure Blob Storage health check failed', error);
      return false;
    }
  }
}
