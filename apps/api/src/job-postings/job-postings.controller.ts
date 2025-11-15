import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JobPostingsService } from './job-postings.service';
import { ParseJobPostingDto, JobPostingResponseDto } from './dto';

@ApiTags('job-postings')
@Controller('job-postings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JobPostingsController {
  constructor(private readonly jobPostingsService: JobPostingsService) {}

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
  @ApiOperation({ summary: 'List all job postings for current user' })
  @ApiResponse({
    status: 200,
    description: 'Job postings retrieved successfully',
    type: [JobPostingResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listJobPostings(@CurrentUser('id') userId: string): Promise<JobPostingResponseDto[]> {
    return this.jobPostingsService.listJobPostings(userId);
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
}
