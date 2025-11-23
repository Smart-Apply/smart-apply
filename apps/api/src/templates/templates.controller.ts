import { Controller, Get, Param, Query, UseGuards, Res } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { TemplateType } from '@prisma/client';
import {
  TemplateResponseDto,
  TemplateWithContentResponseDto,
} from './dto/template-response.dto';

@ApiTags('templates')
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Public() // Public endpoint - templates can be viewed without authentication
  @Get()
  @ApiOperation({ summary: 'List all active templates (public)' })
  @ApiQuery({
    name: 'type',
    enum: TemplateType,
    required: false,
    description: 'Filter by template type',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns list of active templates',
    type: [TemplateResponseDto],
  })
  async findAll(@Query('type') type?: TemplateType): Promise<TemplateResponseDto[]> {
    return this.templatesService.findAll(type);
  }

  @Public() // Public endpoint - template details can be viewed without authentication
  @Get(':id')
  @ApiOperation({ summary: 'Get single template with full content (public)' })
  @ApiResponse({
    status: 200,
    description: 'Returns template with HTML and CSS content',
    type: TemplateWithContentResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found',
  })
  async findOne(@Param('id') id: string): Promise<TemplateWithContentResponseDto> {
    return this.templatesService.findOne(id);
  }

  @Public() // Public endpoint - template previews can be viewed without authentication
  @SkipThrottle() // Skip rate limiting for preview images (they are cached)
  @Get(':id/preview')
  @ApiOperation({ summary: 'Get template preview image (public)' })
  @ApiResponse({
    status: 200,
    description: 'Returns template preview as PNG image',
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found',
  })
  async getPreview(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const imageBuffer = await this.templatesService.generatePreview(id);
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // Allow loading from frontend
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all origins for public images
    res.send(imageBuffer);
  }
}
