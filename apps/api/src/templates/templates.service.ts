import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import NodeCache from 'node-cache';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ConfigService } from '../config/config.service';
import { PreviewRendererService } from '../pdf-v2/preview-renderer.service';
import { TemplateType } from '../generated/prisma/client';
import { TemplateResponseDto, TemplateWithContentResponseDto } from './dto/template-response.dto';
import { CreateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);
  private readonly cache: NodeCache;

  // Cache statistics for monitoring
  private cacheStats = {
    hits: 0,
    misses: 0,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly previewRenderer: PreviewRendererService,
  ) {
    // Initialize cache with TTL from config (default: 3600s from env.schema.ts)
    this.cache = new NodeCache({
      stdTTL: this.config.cacheTtlSeconds,
      checkperiod: 600, // Check for expired keys every 10 minutes
      useClones: false, // Don't clone objects (better performance, read-only access)
    });

    this.logger.log(`Template cache initialized with TTL: ${this.config.cacheTtlSeconds}s`);
  }

  /**
   * Get all active templates, optionally filtered by type
   * Returns one template per design (grouped by baseTemplateId or category)
   * For UI display in wizard - shows only distinct designs, not language variants
   */
  async findAll(type?: TemplateType): Promise<TemplateResponseDto[]> {
    const cacheKey = `templates:all:${type || 'all'}`;

    // Check cache first (use !== undefined to properly handle null cached values)
    const cached = this.cache.get<TemplateResponseDto[]>(cacheKey);
    if (cached !== undefined) {
      this.cacheStats.hits++;
      this.logger.debug(
        `Cache HIT for ${cacheKey} (hits: ${this.cacheStats.hits}, misses: ${this.cacheStats.misses})`,
      );
      return cached;
    }

    // Cache miss - fetch from database
    this.cacheStats.misses++;
    this.logger.debug(
      `Cache MISS for ${cacheKey} (hits: ${this.cacheStats.hits}, misses: ${this.cacheStats.misses})`,
    );

    const allTemplates = await this.prisma.template.findMany({
      where: {
        isActive: true,
        ...(type && { type }),
      },
      orderBy: [{ isDefault: 'desc' }, { category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        category: true,
        language: true,
        baseTemplateId: true,
        accentColor: true,
        colorVariantName: true,
        thumbnailUrl: true,
        previewImageKey: true,
        isActive: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Return all templates - frontend will group by baseTemplateId for color variant swatches
    // Previously we grouped here, but now color variants need to be sent to frontend for UI grouping
    const result = allTemplates;

    // Store in cache
    this.cache.set(cacheKey, result);
    this.logger.debug(`Cached ${result.length} templates with key ${cacheKey}`);

    return result;
  }

  /**
   * Find template by category and language
   * Used for automatic selection based on job posting language
   */
  async findByCategoryAndLanguage(
    category: string,
    language: string,
    type?: TemplateType,
  ): Promise<TemplateWithContentResponseDto | null> {
    const cacheKey = `templates:category:${category}:lang:${language}:type:${type || 'all'}`;

    // Check cache first (use !== undefined to properly handle null cached values)
    const cached = this.cache.get<TemplateWithContentResponseDto | null>(cacheKey);
    if (cached !== undefined) {
      this.cacheStats.hits++;
      this.logger.debug(
        `Cache HIT for ${cacheKey} (hits: ${this.cacheStats.hits}, misses: ${this.cacheStats.misses})`,
      );
      return cached;
    }

    // Cache miss - fetch from database
    this.cacheStats.misses++;
    this.logger.debug(
      `Cache MISS for ${cacheKey} (hits: ${this.cacheStats.hits}, misses: ${this.cacheStats.misses})`,
    );

    const template = await this.prisma.template.findFirst({
      where: {
        category,
        language,
        isActive: true,
        ...(type && { type: { in: [type, TemplateType.BOTH] } }),
      },
    });

    if (!template) {
      // Fallback to English if specific language not found
      this.logger.warn(
        `Template not found for category ${category} and language ${language}, falling back to English`,
      );

      // Use a separate cache key for fallback to avoid confusion
      const fallbackCacheKey = `templates:category:${category}:lang:en:type:${type || 'all'}`;
      const cachedFallback = this.cache.get<TemplateWithContentResponseDto | null>(
        fallbackCacheKey,
      );

      if (cachedFallback !== undefined) {
        this.cacheStats.hits++;
        this.logger.debug(`Cache HIT for fallback ${fallbackCacheKey}`);
        // Note: We do NOT cache under the original key to allow new templates to be found after cache expiry
        return cachedFallback;
      }

      const fallback = await this.prisma.template.findFirst({
        where: {
          category,
          language: 'en',
          isActive: true,
          ...(type && { type: { in: [type, TemplateType.BOTH] } }),
        },
      });

      // Cache under fallback key only (not original key)
      this.cache.set(fallbackCacheKey, fallback);
      // Cache null under original key to avoid repeated DB queries for missing templates
      this.cache.set(cacheKey, null);
      return fallback;
    }

    // Cache the result
    this.cache.set(cacheKey, template);
    this.logger.debug(`Cached template with key ${cacheKey}`);

    return template;
  }

  /**
   * Get all language variants of a template design
   */
  async findLanguageVariants(baseTemplateId: string): Promise<TemplateResponseDto[]> {
    const cacheKey = `templates:variants:${baseTemplateId}`;

    // Check cache first (use !== undefined to properly handle null cached values)
    const cached = this.cache.get<TemplateResponseDto[]>(cacheKey);
    if (cached !== undefined) {
      this.cacheStats.hits++;
      this.logger.debug(
        `Cache HIT for ${cacheKey} (hits: ${this.cacheStats.hits}, misses: ${this.cacheStats.misses})`,
      );
      return cached;
    }

    // Cache miss - fetch from database
    this.cacheStats.misses++;
    this.logger.debug(
      `Cache MISS for ${cacheKey} (hits: ${this.cacheStats.hits}, misses: ${this.cacheStats.misses})`,
    );

    const variants = await this.prisma.template.findMany({
      where: {
        OR: [
          { baseTemplateId },
          { id: baseTemplateId }, // Include the base template itself
        ],
        isActive: true,
      },
      orderBy: { language: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        category: true,
        language: true,
        baseTemplateId: true,
        thumbnailUrl: true,
        isActive: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Cache the result
    this.cache.set(cacheKey, variants);
    this.logger.debug(`Cached ${variants.length} variants with key ${cacheKey}`);

    return variants;
  }

  /**
   * Get a single template by ID with full content
   */
  async findOne(id: string): Promise<TemplateWithContentResponseDto> {
    const cacheKey = `templates:id:${id}`;

    // Check cache first (use !== undefined to properly handle null cached values)
    const cached = this.cache.get<TemplateWithContentResponseDto>(cacheKey);
    if (cached !== undefined) {
      this.cacheStats.hits++;
      this.logger.debug(
        `Cache HIT for ${cacheKey} (hits: ${this.cacheStats.hits}, misses: ${this.cacheStats.misses})`,
      );
      return cached;
    }

    // Cache miss - fetch from database
    this.cacheStats.misses++;
    this.logger.debug(
      `Cache MISS for ${cacheKey} (hits: ${this.cacheStats.hits}, misses: ${this.cacheStats.misses})`,
    );

    const template = await this.prisma.template.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    // Cache the result
    this.cache.set(cacheKey, template);
    this.logger.debug(`Cached template with key ${cacheKey}`);

    return template;
  }

  /**
   * Get default template for a specific type
   */
  async findDefault(type: TemplateType): Promise<TemplateWithContentResponseDto> {
    const cacheKey = `templates:default:${type}`;

    // Check cache first (use !== undefined to properly handle null cached values)
    const cached = this.cache.get<TemplateWithContentResponseDto>(cacheKey);
    if (cached !== undefined) {
      this.cacheStats.hits++;
      this.logger.debug(
        `Cache HIT for ${cacheKey} (hits: ${this.cacheStats.hits}, misses: ${this.cacheStats.misses})`,
      );
      return cached;
    }

    // Cache miss - fetch from database
    this.cacheStats.misses++;
    this.logger.debug(
      `Cache MISS for ${cacheKey} (hits: ${this.cacheStats.hits}, misses: ${this.cacheStats.misses})`,
    );

    const template = await this.prisma.template.findFirst({
      where: {
        type: { in: [type, TemplateType.BOTH] },
        isActive: true,
        isDefault: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!template) {
      // Fallback to first active template of this type
      const fallback = await this.prisma.template.findFirst({
        where: {
          type: { in: [type, TemplateType.BOTH] },
          isActive: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (!fallback) {
        throw new NotFoundException(`No active template found for type ${type}`);
      }

      this.logger.warn(`No default template for ${type}, using fallback: ${fallback.id}`);

      // Cache the fallback
      this.cache.set(cacheKey, fallback);
      return fallback;
    }

    // Cache the result
    this.cache.set(cacheKey, template);
    this.logger.debug(`Cached default template with key ${cacheKey}`);

    return template;
  }

  /**
   * Invalidate all template caches
   * Called after any template mutation (create, update, delete)
   * Note: keyCount may not be 100% accurate due to race conditions (non-atomic operation)
   */
  private invalidateCache(): void {
    const keyCount = this.cache.keys().length;
    this.cache.flushAll();
    this.logger.log(`Template cache invalidated (~${keyCount} keys cleared)`);
  }

  /**
   * Get cache statistics for monitoring
   * Note: Hit rate is estimated and may not be 100% accurate in concurrent environments
   */
  getCacheStats() {
    return {
      ...this.cacheStats,
      hitRate:
        this.cacheStats.hits + this.cacheStats.misses > 0
          ? (this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses)) * 100
          : 0,
      keys: this.cache.keys().length,
      stats: this.cache.getStats(),
    };
  }

  /**
   * Create a new template (admin operation)
   */
  async create(dto: CreateTemplateDto): Promise<TemplateWithContentResponseDto> {
    const template = await this.prisma.template.create({
      data: dto,
    });

    this.invalidateCache(); // Clear cache after mutation
    this.logger.log(`Created template: ${template.id} (${template.name})`);
    return template;
  }

  /**
   * Update an existing template (admin operation)
   */
  async update(
    id: string,
    dto: Partial<CreateTemplateDto>,
  ): Promise<TemplateWithContentResponseDto> {
    const template = await this.prisma.template.update({
      where: { id },
      data: dto,
    });

    this.invalidateCache(); // Clear cache after mutation
    this.logger.log(`Updated template: ${template.id} (${template.name})`);
    return template;
  }

  /**
   * Delete a template (admin operation)
   */
  async delete(id: string): Promise<void> {
    await this.prisma.template.delete({
      where: { id },
    });

    this.invalidateCache(); // Clear cache after mutation
    this.logger.log(`Deleted template: ${id}`);
  }

  /**
   * Health check - verify at least one default template exists for each type
   */
  async healthCheck(): Promise<boolean> {
    try {
      const coverLetterTemplate = await this.prisma.template.findFirst({
        where: {
          type: { in: [TemplateType.COVER_LETTER, TemplateType.BOTH] },
          isActive: true,
        },
      });

      const resumeTemplate = await this.prisma.template.findFirst({
        where: {
          type: { in: [TemplateType.RESUME, TemplateType.BOTH] },
          isActive: true,
        },
      });

      return !!(coverLetterTemplate && resumeTemplate);
    } catch (error) {
      this.logger.error('Template health check failed', error);
      return false;
    }
  }

  /**
   * Generate a PNG preview for a template (with caching). On cache miss
   * the image is rendered via `PreviewRendererService` (react-pdf →
   * pdfjs-dist → @napi-rs/canvas) and persisted to storage.
   */
  async generatePreview(id: string): Promise<Buffer> {
    const template = await this.findOne(id);

    // Check if preview already exists in storage
    if (template.previewImageKey) {
      try {
        const cachedPreview = await this.storage.getFile(template.previewImageKey);
        this.logger.debug(`Using cached preview for template: ${id}`);
        return cachedPreview;
      } catch {
        this.logger.warn(`Cached preview not found for template ${id}, regenerating...`);
      }
    }

    this.logger.log(`Generating preview for template: ${id}`);
    const imageBuffer = await this.previewRenderer.renderPreviewPng(id);

    // Store preview in storage
    const previewKey = `templates/${id}/preview.png`;
    await this.storage.upload(previewKey, imageBuffer, 'image/png');

    // Update template with preview key
    await this.prisma.template.update({
      where: { id },
      data: { previewImageKey: previewKey },
    });

    this.logger.log(`Preview generated and cached for template: ${id}`);
    return imageBuffer;
  }
}
