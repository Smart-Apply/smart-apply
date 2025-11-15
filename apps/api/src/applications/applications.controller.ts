import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseGuards,
  ParseBoolPipe,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ApplicationResponseDto } from './dto/application-response.dto';
import { ApplicationFilesResponseDto } from './dto/application-files-response.dto';

@ApiTags('applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new application',
    description:
      'Creates a new application and triggers background processing (LLM → PDF → Storage)',
  })
  @ApiResponse({
    status: 201,
    description: 'Application created successfully',
    type: ApplicationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (missing profile or invalid job posting)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all applications',
    description: 'Returns all applications for the authenticated user',
  })
  @ApiQuery({
    name: 'includeJobPosting',
    required: false,
    type: Boolean,
    description: 'Include job posting details in response',
  })
  @ApiResponse({
    status: 200,
    description: 'Applications retrieved successfully',
    type: [ApplicationResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @CurrentUser() user: any,
    @Query('includeJobPosting', new ParseBoolPipe({ optional: true }))
    includeJobPosting = false,
  ): Promise<ApplicationResponseDto[]> {
    return this.applicationsService.findAll(user.id, includeJobPosting);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get application by ID',
    description: 'Returns a single application with details',
  })
  @ApiQuery({
    name: 'includeJobPosting',
    required: false,
    type: Boolean,
    description: 'Include job posting details in response',
  })
  @ApiResponse({
    status: 200,
    description: 'Application retrieved successfully',
    type: ApplicationResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async findOne(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('includeJobPosting', new ParseBoolPipe({ optional: true }))
    includeJobPosting = false,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.findOne(user.id, id, includeJobPosting);
  }

  @Get(':id/files')
  @ApiOperation({
    summary: 'Get download URLs for application files',
    description: 'Returns SAS URLs for cover letter and resume PDFs (1 hour expiry)',
  })
  @ApiResponse({
    status: 200,
    description: 'File URLs retrieved successfully',
    type: ApplicationFilesResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Application not ready' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async getFiles(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<ApplicationFilesResponseDto> {
    return this.applicationsService.getFiles(user.id, id);
  }

  @Get(':id/download/cover-letter')
  @ApiOperation({
    summary: 'Download cover letter PDF',
    description: 'Streams the cover letter PDF file for download',
  })
  @ApiResponse({ status: 200, description: 'PDF file stream' })
  @ApiResponse({ status: 400, description: 'Application not ready or file not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async downloadCoverLetter(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.applicationsService.getFileStream(user.id, id, 'cover-letter');

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="cover-letter-${id}.pdf"`,
    });

    return new StreamableFile(file);
  }

  @Get(':id/download/resume')
  @ApiOperation({
    summary: 'Download resume PDF',
    description: 'Streams the resume PDF file for download',
  })
  @ApiResponse({ status: 200, description: 'PDF file stream' })
  @ApiResponse({ status: 400, description: 'Application not ready or file not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async downloadResume(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.applicationsService.getFileStream(user.id, id, 'resume');

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="resume-${id}.pdf"`,
    });

    return new StreamableFile(file);
  }
}
