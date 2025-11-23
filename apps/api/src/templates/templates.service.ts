import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { TemplateType } from '@prisma/client';
import {
  TemplateResponseDto,
  TemplateWithContentResponseDto,
} from './dto/template-response.dto';
import { CreateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Get all active templates, optionally filtered by type
   */
  async findAll(type?: TemplateType): Promise<TemplateResponseDto[]> {
    const templates = await this.prisma.template.findMany({
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
        thumbnailUrl: true,
        isActive: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return templates;
  }

  /**
   * Get a single template by ID with full content
   */
  async findOne(id: string): Promise<TemplateWithContentResponseDto> {
    const template = await this.prisma.template.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return template;
  }

  /**
   * Get default template for a specific type
   */
  async findDefault(type: TemplateType): Promise<TemplateWithContentResponseDto> {
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
      return fallback;
    }

    return template;
  }

  /**
   * Create a new template (admin operation)
   */
  async create(dto: CreateTemplateDto): Promise<TemplateWithContentResponseDto> {
    const template = await this.prisma.template.create({
      data: dto,
    });

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
    });
    
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 595, height: 842 }); // A4 size at 72 DPI
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
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
