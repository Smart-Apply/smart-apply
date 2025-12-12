import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto';
import { JobPostingsService } from './job-postings.service';
import { ParseJobPostingDto, CreateJobPostingDto, JobPostingResponseDto } from './dto';
import { KeywordsService, MatchAnalysisResponseDto } from '../keywords';

@ApiTags('job-postings')
@Controller('job-postings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JobPostingsController {
  constructor(
    private readonly jobPostingsService: JobPostingsService,
    private readonly keywordsService: KeywordsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create job posting manually with all fields' })
  @ApiResponse({
    status: 201,
    description: 'Job posting created successfully',
    type: JobPostingResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createJobPosting(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateJobPostingDto,
  ): Promise<JobPostingResponseDto> {
    return this.jobPostingsService.create(userId, dto);
  }

  @Post('parse')
  @ApiOperation({ summary: 'Parse job posting from text, URL, or file' })
  @ApiResponse({
    status: 201,
    description: 'Job posting parsed and created successfully',
    type: JobPostingResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input or parsing failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async parseJobPosting(
    @CurrentUser('id') userId: string,
    @Body() dto: ParseJobPostingDto,
  ): Promise<JobPostingResponseDto> {
    return this.jobPostingsService.parseJobPosting(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all job postings for current user with pagination' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (starts at 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (max: 100)',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Job postings retrieved successfully with pagination',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { $ref: '#/components/schemas/JobPostingResponseDto' },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
            total: { type: 'number', example: 50 },
            totalPages: { type: 'number', example: 3 },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listJobPostings(
    @CurrentUser('id') userId: string,
    @Query() paginationQuery: PaginationQueryDto,
  ) {
    return this.jobPostingsService.listJobPostings(
      userId,
      paginationQuery.page,
      paginationQuery.limit,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single job posting by ID' })
  @ApiResponse({
    status: 200,
    description: 'Job posting retrieved successfully',
    type: JobPostingResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Job posting not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getJobPostingById(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<JobPostingResponseDto> {
    return this.jobPostingsService.getJobPostingById(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete job posting' })
  @ApiResponse({
    status: 204,
    description: 'Job posting deleted successfully',
  })
  @ApiResponse({ status: 400, description: 'Job posting not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteJobPosting(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.jobPostingsService.deleteJobPosting(userId, id);
  }

  @Post(':id/analyze')
  @ApiOperation({
    summary: 'Analyze job posting keywords against user profile',
    description:
      'Extract keywords from job posting and compare against user profile to calculate ATS match percentage',
  })
  @ApiResponse({
    status: 200,
    description: 'Match analysis completed successfully',
    type: MatchAnalysisResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Job posting or profile not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async analyzeJobPosting(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<MatchAnalysisResponseDto> {
    try {
      return await this.keywordsService.analyzeMatch(userId, id);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
