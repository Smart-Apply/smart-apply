import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TemplateType } from '@prisma/client';
import {
  TemplateResponseDto,
  TemplateWithContentResponseDto,
} from './dto/template-response.dto';

@ApiTags('templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List all active templates' })
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

  @Get(':id')
  @ApiOperation({ summary: 'Get single template with full content' })
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
}
