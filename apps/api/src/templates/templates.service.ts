import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TemplateType } from '@prisma/client';
import {
  TemplateResponseDto,
  TemplateWithContentResponseDto,
} from './dto/template-response.dto';
import { CreateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

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
}
