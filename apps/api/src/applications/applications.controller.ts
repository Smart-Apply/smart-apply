import {
  Controller,
  Post,
  Put,
  Patch,
  Get,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseBoolPipe,
  Res,
  StreamableFile,
  HttpCode,
  HttpStatus,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ApplicationResponseDto } from './dto/application-response.dto';
import { ApplicationFilesResponseDto } from './dto/application-files-response.dto';
import { ApplicationStatusResponseDto } from './dto/application-status-response.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { UpdateApplicationTitleDto } from './dto/update-application-title.dto';
import { UseThrottler } from '../common/decorators/throttle.decorator';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { CoverLetterDto } from './dto/cover-letter.dto';

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

  @Post('create-with-generation')
  @ApiOperation({
    summary: 'Create application with immediate LLM generation',
    description:
      'Creates a new application and immediately generates resume + cover letter with LLM. Returns READY status for editing.',
  })
  @ApiResponse({
    status: 201,
    description: 'Application created with generated content',
    type: ApplicationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (missing profile or invalid job posting)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too many requests (max 5 per minute)' })
  async createWithGeneration(
    @CurrentUser() user: any,
    @Body() dto: CreateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.createWithGeneration(user.id, dto);
  }

  @Put(':id/resume')
  @ApiOperation({ summary: 'Lebenslauf-Daten aktualisieren' })
  @ApiResponse({ status: 200, type: ApplicationResponseDto })
  async updateResume(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateResumeDto,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.updateResume(user.id, id, dto);
  }

  @Post(':id/cover-letter')
  @ApiOperation({ summary: 'Anschreiben generieren oder speichern' })
  @ApiResponse({ status: 200, type: ApplicationResponseDto })
  async upsertCoverLetter(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CoverLetterDto,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.upsertCoverLetter(user.id, id, dto);
  }

  @Post(':id/export')
  @ApiOperation({ summary: 'PDF-Export anstoßen' })
  @ApiResponse({ status: 200, type: ApplicationResponseDto })
  async export(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.requestExport(user.id, id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update application tracking status',
    description:
      'Updates the user-facing application status (APPLIED, INTERVIEW, ACCEPTED, REJECTED)',
  })
  @ApiResponse({
    status: 200,
    description: 'Application status updated successfully',
    type: ApplicationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid status value' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async updateStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.updateStatus(user.id, id, dto.status);
  }

  @Patch(':id/title')
  @ApiOperation({
    summary: 'Update application title',
    description: 'Updates the custom application title (max 60 characters)',
  })
  @ApiResponse({
    status: 200,
    description: 'Application title updated successfully',
    type: ApplicationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid title (too short/long)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async updateTitle(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationTitleDto,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.updateTitle(user.id, id, dto.title);
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

  @Get(':id/status')
  @UseThrottler('health-check')
  @ApiOperation({
    summary: 'Get application status (lightweight)',
    description:
      'Returns only the status of an application. Optimized for polling with generous rate limits (600/min).',
  })
  @ApiResponse({
    status: 200,
    description: 'Status retrieved successfully',
    type: ApplicationStatusResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async getStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<ApplicationStatusResponseDto> {
    return this.applicationsService.getStatus(user.id, id);
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

  @Get(':id/stream')
  @SkipThrottle() // SSE streams are long-lived connections, not repeated requests
  @Sse()
  @ApiOperation({
    summary: 'Stream application status updates via SSE',
    description:
      'Streams real-time status updates for an application. Connection automatically closes when status reaches READY or FAILED. More efficient than polling.',
  })
  @ApiResponse({
    status: 200,
    description: 'SSE stream of status updates',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async streamStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<Observable<MessageEvent>> {
    return this.applicationsService.streamStatus(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete application',
    description: 'Deletes an application and its associated files (cover letter and resume PDFs)',
  })
  @ApiResponse({
    status: 204,
    description: 'Application deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async delete(@CurrentUser() user: any, @Param('id') id: string): Promise<void> {
    await this.applicationsService.delete(user.id, id);
  }
}
