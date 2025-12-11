import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../storage/storage.service';
import { UploadResponseDto } from './dto/upload-response.dto';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  // Allowed MIME types
  private readonly ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  ];

  // Max file size from environment (defaults to 10MB for job postings)
  private readonly MAX_FILE_SIZE: number;

  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {
    // Get max file size from env (in MB) and convert to bytes
    const maxSizeMB = parseInt(
      this.configService.get<string>('MAX_FILE_SIZE_MB', '10'),
      10,
    );
    this.MAX_FILE_SIZE = maxSizeMB * 1024 * 1024;
    this.logger.log(`Max file size configured: ${maxSizeMB}MB`);
  }

  async uploadFile(userId: string, file: Express.Multer.File): Promise<UploadResponseDto> {
    // Validate file exists
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate MIME type
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: PDF, DOCX. Received: ${file.mimetype}`,
      );
    }

    // Validate file size
    if (file.size > this.MAX_FILE_SIZE) {
      const maxSizeMB = this.MAX_FILE_SIZE / (1024 * 1024);
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      throw new BadRequestException(
        `File size exceeds ${maxSizeMB}MB limit. Your file is ${fileSizeMB}MB. Please compress or split your file.`,
      );
    }

    // Validate and sanitize filename
    const sanitizedFilename = this.sanitizeFilename(file.originalname);

    // Generate unique storage key
    const storageKey = this.generateStorageKey(userId, sanitizedFilename);

    try {
      // Upload to storage
      await this.storageService.upload(storageKey, file.buffer, file.mimetype);

      this.logger.log(`File uploaded successfully: ${storageKey}`);

      // Return response DTO
      const response: UploadResponseDto = {
        id: this.generateUploadId(storageKey),
        fileName: sanitizedFilename,
        mimeType: file.mimetype,
        size: file.size,
        storageKey,
        uploadedAt: new Date(),
      };

      return response;
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`);
      throw new BadRequestException(`Failed to upload file: ${error.message}`);
    }
  }

  private sanitizeFilename(filename: string): string {
    // Remove path traversal attempts and dangerous characters
    const sanitized = filename
      .replace(/\.\./g, '') // Remove path traversal
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace unsafe chars with underscore
      .slice(0, 255); // Limit length

    if (!sanitized) {
      throw new BadRequestException('Invalid filename');
    }

    return sanitized;
  }

  private generateStorageKey(userId: string, filename: string): string {
    const timestamp = Date.now();
    return `${userId}/${timestamp}-${filename}`;
  }

  private generateUploadId(storageKey: string): string {
    // For simplicity, use base64 encoded storage key as ID
    // In production, you might want to store this in DB and return DB ID
    return Buffer.from(storageKey).toString('base64');
  }
}
