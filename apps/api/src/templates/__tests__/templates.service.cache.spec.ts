import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TemplateType } from '../../generated/prisma/client';
import { TemplatesService } from '../templates.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { ConfigService } from '../../config/config.service';

describe('TemplatesService - Cache Behavior', () => {
  let service: TemplatesService;
  let prisma: PrismaService;

  // Create typed mock functions
  const mockFindMany = jest.fn();
  const mockFindFirst = jest.fn();
  const mockFindUnique = jest.fn();
  const mockCreate = jest.fn();
  const mockUpdate = jest.fn();
  const mockDelete = jest.fn();

  const mockTemplate = {
    id: 'template-1',
    name: 'Modern Professional',
    description: 'A modern professional resume template',
    type: TemplateType.RESUME,
    category: 'modern-professional',
    language: 'en',
    baseTemplateId: null,
    thumbnailUrl: null,
    htmlTemplate: '<html>{{content}}</html>',
    cssStyles: 'body { font-family: Arial; }',
    previewImageKey: null,
    isActive: true,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Reset mocks before each test
    mockFindMany.mockReset();
    mockFindFirst.mockReset();
    mockFindUnique.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesService,
        {
          provide: PrismaService,
          useValue: {
            template: {
              findMany: mockFindMany,
              findFirst: mockFindFirst,
              findUnique: mockFindUnique,
              create: mockCreate,
              update: mockUpdate,
              delete: mockDelete,
            },
          },
        },
        {
          provide: StorageService,
          useValue: {
            upload: jest.fn(),
            getFile: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            cacheTtlSeconds: 3600, // 1 hour
          },
        },
      ],
    }).compile();

    service = module.get<TemplatesService>(TemplatesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should cache results on first call', async () => {
      mockFindMany.mockResolvedValue([mockTemplate]);

      // First call - should query database
      const result1 = await service.findAll();
      expect(mockFindMany).toHaveBeenCalledTimes(1);
      expect(result1).toHaveLength(1);

      // Second call - should use cache (no additional DB query)
      const result2 = await service.findAll();
      expect(mockFindMany).toHaveBeenCalledTimes(1); // Still 1
      expect(result2).toEqual(result1);
    });

    it('should cache results separately by type', async () => {
      const resumeTemplate = { ...mockTemplate, type: TemplateType.RESUME };
      const coverLetterTemplate = {
        ...mockTemplate,
        id: 'template-2',
        type: TemplateType.COVER_LETTER,
      };

      mockFindMany
        .mockResolvedValueOnce([resumeTemplate])
        .mockResolvedValueOnce([coverLetterTemplate]);

      // First call for RESUME type
      await service.findAll(TemplateType.RESUME);
      expect(mockFindMany).toHaveBeenCalledTimes(1);

      // First call for COVER_LETTER type (different cache key)
      await service.findAll(TemplateType.COVER_LETTER);
      expect(mockFindMany).toHaveBeenCalledTimes(2);

      // Second call for RESUME type - should use cache
      await service.findAll(TemplateType.RESUME);
      expect(mockFindMany).toHaveBeenCalledTimes(2); // Still 2

      // Second call for COVER_LETTER type - should use cache
      await service.findAll(TemplateType.COVER_LETTER);
      expect(mockFindMany).toHaveBeenCalledTimes(2); // Still 2
    });

    it('should track cache hits and misses', async () => {
      mockFindMany.mockResolvedValue([mockTemplate]);

      // First call - cache miss
      await service.findAll();
      let stats = service.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);

      // Second call - cache hit
      await service.findAll();
      stats = service.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);

      // Third call - cache hit
      await service.findAll();
      stats = service.getCacheStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should cache individual templates by ID', async () => {
      mockFindUnique.mockResolvedValue(mockTemplate);

      // First call - cache miss
      await service.findOne('template-1');
      expect(mockFindUnique).toHaveBeenCalledTimes(1);

      // Second call - cache hit
      await service.findOne('template-1');
      expect(mockFindUnique).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should throw NotFoundException for missing template', async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findDefault', () => {
    it('should cache default templates by type', async () => {
      mockFindFirst.mockResolvedValue(mockTemplate);

      // First call - cache miss
      await service.findDefault(TemplateType.RESUME);
      expect(mockFindFirst).toHaveBeenCalledTimes(1);

      // Second call - cache hit
      await service.findDefault(TemplateType.RESUME);
      expect(mockFindFirst).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should cache fallback templates when no default exists', async () => {
      // First findFirst returns null (no default)
      // Second findFirst returns fallback template
      mockFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(mockTemplate);

      // First call - should query twice (default + fallback)
      const result1 = await service.findDefault(TemplateType.RESUME);
      expect(mockFindFirst).toHaveBeenCalledTimes(2);
      expect(result1).toEqual(mockTemplate);

      // Second call - should use cached fallback
      const result2 = await service.findDefault(TemplateType.RESUME);
      expect(mockFindFirst).toHaveBeenCalledTimes(2); // Still 2
      expect(result2).toEqual(mockTemplate);
    });
  });

  describe('findByCategoryAndLanguage', () => {
    it('should cache templates by category, language, and type', async () => {
      mockFindFirst.mockResolvedValue(mockTemplate);

      // First call - cache miss
      await service.findByCategoryAndLanguage('modern-professional', 'en', TemplateType.RESUME);
      expect(mockFindFirst).toHaveBeenCalledTimes(1);

      // Second call - cache hit
      await service.findByCategoryAndLanguage('modern-professional', 'en', TemplateType.RESUME);
      expect(mockFindFirst).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should cache null results for missing templates', async () => {
      // First findFirst returns null (no template for 'de')
      // Second findFirst returns English fallback
      mockFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(mockTemplate);

      // First call - should query twice (German + English fallback)
      const result1 = await service.findByCategoryAndLanguage(
        'modern-professional',
        'de',
        TemplateType.RESUME,
      );
      expect(mockFindFirst).toHaveBeenCalledTimes(2);
      expect(result1).toEqual(mockTemplate);

      // Second call - should use cached result
      const result2 = await service.findByCategoryAndLanguage(
        'modern-professional',
        'de',
        TemplateType.RESUME,
      );
      expect(mockFindFirst).toHaveBeenCalledTimes(2); // Still 2
      expect(result2).toEqual(mockTemplate);
    });
  });

  describe('findLanguageVariants', () => {
    it('should cache language variants by baseTemplateId', async () => {
      const variants = [mockTemplate, { ...mockTemplate, id: 'template-2', language: 'de' }];
      mockFindMany.mockResolvedValue(variants);

      // First call - cache miss
      await service.findLanguageVariants('base-template-1');
      expect(mockFindMany).toHaveBeenCalledTimes(1);

      // Second call - cache hit
      await service.findLanguageVariants('base-template-1');
      expect(mockFindMany).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('cache invalidation', () => {
    it('should clear cache after create', async () => {
      mockFindMany.mockResolvedValue([mockTemplate]);
      mockCreate.mockResolvedValue(mockTemplate);

      // Populate cache
      await service.findAll();
      expect(mockFindMany).toHaveBeenCalledTimes(1);

      // Create new template - should invalidate cache
      await service.create({
        name: 'New Template',
        description: 'A new template',
        type: TemplateType.RESUME,
        category: 'new-category',
        language: 'en',
        htmlTemplate: '<html></html>',
        cssStyles: 'body {}',
        isActive: true,
        isDefault: false,
      });

      // Next call should query database again (cache was cleared)
      await service.findAll();
      expect(mockFindMany).toHaveBeenCalledTimes(2);
    });

    it('should clear cache after update', async () => {
      mockFindUnique.mockResolvedValue(mockTemplate);
      mockUpdate.mockResolvedValue(mockTemplate);

      // Populate cache
      await service.findOne('template-1');
      expect(mockFindUnique).toHaveBeenCalledTimes(1);

      // Update template - should invalidate cache
      await service.update('template-1', { name: 'Updated Name' });

      // Next call should query database again (cache was cleared)
      await service.findOne('template-1');
      expect(mockFindUnique).toHaveBeenCalledTimes(2);
    });

    it('should clear cache after delete', async () => {
      mockFindMany.mockResolvedValue([mockTemplate]);
      mockDelete.mockResolvedValue(mockTemplate);

      // Populate cache
      await service.findAll();
      expect(mockFindMany).toHaveBeenCalledTimes(1);

      // Delete template - should invalidate cache
      await service.delete('template-1');

      // Next call should query database again (cache was cleared)
      await service.findAll();
      expect(mockFindMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('cache statistics', () => {
    it('should calculate hit rate correctly', async () => {
      mockFindMany.mockResolvedValue([mockTemplate]);

      // Make 1 miss + 3 hits = 75% hit rate
      await service.findAll(); // miss
      await service.findAll(); // hit
      await service.findAll(); // hit
      await service.findAll(); // hit

      const stats = service.getCacheStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(75);
    });

    it('should return 0 hit rate when no calls made', () => {
      const stats = service.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('should return cache key count', async () => {
      mockFindMany.mockResolvedValue([mockTemplate]);
      mockFindUnique.mockResolvedValue(mockTemplate);

      // Add 2 different cache entries
      await service.findAll();
      await service.findOne('template-1');

      const stats = service.getCacheStats();
      expect(stats.keys).toBeGreaterThanOrEqual(2);
    });
  });
});
