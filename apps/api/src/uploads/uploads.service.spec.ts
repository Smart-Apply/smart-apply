import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { StorageService } from '../storage/storage.service';

describe('UploadsService', () => {
  let service: UploadsService;
  let storageService: StorageService;

  const mockStorageService = {
    upload: jest.fn(),
    download: jest.fn(),
    delete: jest.fn(),
    getSignedUrl: jest.fn(),
    healthCheck: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
      ],
    }).compile();

    service = module.get<UploadsService>(UploadsService);
    storageService = module.get<StorageService>(StorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    const userId = 'test-user-123';

    it('should upload a PDF file successfully', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test-resume.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('mock file content'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      mockStorageService.upload.mockResolvedValue('user123/timestamp-test-resume.pdf');

      const result = await service.uploadFile(userId, mockFile);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('fileName', 'test-resume.pdf');
      expect(result).toHaveProperty('mimeType', 'application/pdf');
      expect(result).toHaveProperty('size', 1024);
      expect(result).toHaveProperty('storageKey');
      expect(result).toHaveProperty('uploadedAt');
      expect(result.storageKey).toContain(userId);
      expect(storageService.upload).toHaveBeenCalledWith(
        expect.stringContaining(userId),
        mockFile.buffer,
        mockFile.mimetype,
      );
    });

    it('should upload a DOCX file successfully', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test-resume.docx',
        encoding: '7bit',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 2048,
        buffer: Buffer.from('mock docx content'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      mockStorageService.upload.mockResolvedValue('user123/timestamp-test-resume.docx');

      const result = await service.uploadFile(userId, mockFile);

      expect(result).toHaveProperty('fileName', 'test-resume.docx');
      expect(result).toHaveProperty('mimeType', mockFile.mimetype);
    });

    it('should throw BadRequestException when no file is provided', async () => {
      await expect(service.uploadFile(userId, null as any)).rejects.toThrow(BadRequestException);
      await expect(service.uploadFile(userId, null as any)).rejects.toThrow('No file provided');
    });

    it('should throw BadRequestException for invalid MIME type', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: 1024,
        buffer: Buffer.from('text content'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      await expect(service.uploadFile(userId, mockFile)).rejects.toThrow(BadRequestException);
      await expect(service.uploadFile(userId, mockFile)).rejects.toThrow('Invalid file type');
    });

    it('should throw BadRequestException for file size exceeding limit', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'large.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 6 * 1024 * 1024, // 6 MB
        buffer: Buffer.alloc(6 * 1024 * 1024),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      await expect(service.uploadFile(userId, mockFile)).rejects.toThrow(BadRequestException);
      await expect(service.uploadFile(userId, mockFile)).rejects.toThrow('File too large');
    });

    it('should sanitize dangerous filenames', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: '../../../etc/passwd.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('mock content'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      mockStorageService.upload.mockResolvedValue('key');

      const result = await service.uploadFile(userId, mockFile);

      expect(result.fileName).not.toContain('..');
      expect(result.storageKey).not.toContain('..');
    });

    it('should replace unsafe characters in filename', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test@#$%^&file.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('mock content'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      mockStorageService.upload.mockResolvedValue('key');

      const result = await service.uploadFile(userId, mockFile);

      // Unsafe characters should be replaced with underscore
      expect(result.fileName).toMatch(/^test[_]+file\.pdf$/);
    });

    it('should handle storage service errors', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('mock content'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      mockStorageService.upload.mockRejectedValue(new Error('Storage error'));

      await expect(service.uploadFile(userId, mockFile)).rejects.toThrow(BadRequestException);
      await expect(service.uploadFile(userId, mockFile)).rejects.toThrow('Failed to upload file');
    });
  });
});
