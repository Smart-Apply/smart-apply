import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import * as NodeCache from 'node-cache';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ConfigService } from '../config/config.service';
import { TemplateType } from '@prisma/client';
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
      this.logger.debug(`Cache HIT for ${cacheKey} (hits: ${this.cacheStats.hits}, misses: ${this.cacheStats.misses})`);
      return cached;
    }

    // Cache miss - fetch from database
    this.cacheStats.misses++;
    this.logger.debug(`Cache MISS for ${cacheKey} (hits: ${this.cacheStats.hits}, misses: ${this.cacheStats.misses})`);

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
        thumbnailUrl: true,
        isActive: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Group by baseTemplateId (or category if no baseTemplateId)
    // Return only one template per design family (preferring English as default)
    const templateMap = new Map<string, typeof allTemplates[0]>();
    
    for (const template of allTemplates) {
      const groupKey = template.baseTemplateId || template.category;
      const existing = templateMap.get(groupKey);
      
      if (!existing) {
        templateMap.set(groupKey, template);
      } else if (template.language === 'en' && existing.language !== 'en') {
        // Prefer English variant for display
        templateMap.set(groupKey, template);
      }
    }

    const result = Array.from(templateMap.values());

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
      this.logger.debug(`Cache HIT for ${cacheKey} (hits: ${this.cacheStats.hits}, misses: ${this.cacheStats.misses})`);
      return cached;
    }

    // Cache miss - fetch from database
    this.cacheStats.misses++;
    this.logger.debug(`Cache MISS for ${cacheKey} (hits: ${this.cacheStats.hits}, misses: ${this.cacheStats.misses})`);

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
      this.logger.warn(`Template not found for category ${category} and language ${language}, falling back to English`);
      
      // Use a separate cache key for fallback to avoid confusion
      const fallbackCacheKey = `templates:category:${category}:lang:en:type:${type || 'all'}`;
      const cachedFallback = this.cache.get<TemplateWithContentResponseDto | null>(fallbackCacheKey);
      
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
      this.logger.debug(`Cache HIT for ${cacheKey} (hits: ${this.cacheStats.hits}, misses: ${this.cacheStats.misses})`);
      return cached;
    }

    // Cache miss - fetch from database
    this.cacheStats.misses++;
    this.logger.debug(`Cache MISS for ${cacheKey} (hits: ${this.cacheStats.hits}, misses: ${this.cacheStats.misses})`);

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
      this.logger.debug(`Cache HIT for ${cacheKey} (hits: ${this.cacheStats.hits}, misses: ${this.cacheStats.misses})`);
      return cached;
    }

    // Cache miss - fetch from database
    this.cacheStats.misses++;
    this.logger.debug(`Cache MISS for ${cacheKey} (hits: ${this.cacheStats.hits}, misses: ${this.cacheStats.misses})`);

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
      this.logger.debug(`Cache HIT for ${cacheKey} (hits: ${this.cacheStats.hits}, misses: ${this.cacheStats.misses})`);
      return cached;
    }

    // Cache miss - fetch from database
    this.cacheStats.misses++;
    this.logger.debug(`Cache MISS for ${cacheKey} (hits: ${this.cacheStats.hits}, misses: ${this.cacheStats.misses})`);

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
      hitRate: this.cacheStats.hits + this.cacheStats.misses > 0
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
   * Generate preview image for a template (with caching)
   */
  async generatePreview(id: string): Promise<Buffer> {
    const template = await this.findOne(id);

    // Check if preview already exists in storage
    if (template.previewImageKey) {
      try {
        const cachedPreview = await this.storage.getFile(template.previewImageKey);
        this.logger.debug(`Using cached preview for template: ${id}`);
        return cachedPreview;
      } catch (error) {
        this.logger.warn(`Cached preview not found for template ${id}, regenerating...`);
      }
    }

    // Generate new preview
    this.logger.log(`Generating preview for template: ${id}`);
    const sampleData = this.getSampleDataForTemplate(template.type);
    const html = this.wrapTemplateWithStyles(template.htmlTemplate, template.cssStyles, sampleData);
    const imageBuffer = await this.generatePreviewImage(html);

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

  /**
   * Get sample data for template preview
   */
  private getSampleDataForTemplate(type: TemplateType): Record<string, any> {
    if (type === TemplateType.COVER_LETTER || type === TemplateType.BOTH) {
      return {
        candidateName: 'Max Mustermann',
        email: 'max.mustermann@example.com',
        phone: '+49 123 456789',
        location: 'Berlin, Deutschland',
        linkedin: 'linkedin.com/in/maxmustermann',
        date: new Date().toLocaleDateString('de-DE', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        companyName: 'Beispiel GmbH',
        recipientName: 'Frau Schmidt',
        content: `<p>Hiermit bewerbe ich mich für die Position als Softwareentwickler in Ihrem Unternehmen.</p>
        <p>Mit meiner mehrjährigen Erfahrung in der Softwareentwicklung und meiner Leidenschaft für innovative Technologien bin ich überzeugt, einen wertvollen Beitrag zu Ihrem Team leisten zu können.</p>
        <p>Ich freue mich darauf, von Ihnen zu hören und mehr über diese spannende Gelegenheit zu erfahren.</p>`,
        closingPhrase: 'Mit freundlichen Grüßen',
      };
    } else {
      return {
        candidateName: 'Max Mustermann',
        email: 'max.mustermann@example.com',
        phone: '+49 123 456789',
        location: 'Berlin, Deutschland',
        linkedin: 'linkedin.com/in/maxmustermann',
        github: 'github.com/maxmustermann',
        summary: 'Erfahrener Softwareentwickler mit 5+ Jahren Erfahrung in Full-Stack-Entwicklung.',
        skillCategories: [
          {
            type: 'Programmiersprachen',
            skills: ['JavaScript', 'TypeScript', 'Python', 'Java'],
          },
          {
            type: 'Frameworks',
            skills: ['React', 'Node.js', 'NestJS', 'Next.js'],
          },
        ],
        experiences: [
          {
            title: 'Senior Software Engineer',
            company: 'Tech Corp',
            location: 'Berlin',
            dateRange: '2020 - Heute',
            achievements: [
              'Entwicklung einer microservice-basierten Plattform',
              'Führung eines Teams von 5 Entwicklern',
            ],
          },
        ],
        education: [
          {
            degree: 'Bachelor of Science',
            institution: 'Technische Universität Berlin',
            year: '2018',
            fieldOfStudy: 'Informatik',
          },
        ],
      };
    }
  }

  /**
   * Wrap template with styles and compile with Handlebars
   */
  private wrapTemplateWithStyles(
    htmlTemplate: string,
    cssStyles: string,
    data: Record<string, any>,
  ): string {
    const Handlebars = require('handlebars');
    const template = Handlebars.compile(htmlTemplate);
    const content = template(data);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>${cssStyles}</style>
        </head>
        <body>${content}</body>
      </html>
    `;
  }

  /**
   * Generate PNG preview image from HTML using Puppeteer
   */
  private async generatePreviewImage(html: string): Promise<Buffer> {
    const puppeteer = require('puppeteer');

    const browser = await puppeteer.launch({
      headless: 'new', // Use new headless mode (Chrome 109+)
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      timeout: 120000, // 2 minutes for browser launch
      protocolTimeout: 120000, // 2 minutes for protocol operations
    });

    try {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(120000); // 2 minutes
      page.setDefaultTimeout(120000); // 2 minutes
      await page.setViewport({ width: 595, height: 842 }); // A4 size at 72 DPI
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 120000 });

      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: false,
      });

      return screenshot as Buffer;
    } finally {
      await browser.close();
    }
  }
}
