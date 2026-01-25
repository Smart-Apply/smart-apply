import { Controller, Get, Param, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JobsService } from './jobs.service';

/**
 * Job Status Response DTO
 */
class JobStatusDto {
  id: string;
  type: string;
  status: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount?: number;
}

@ApiTags('Jobs')
@Controller('jobs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  /**
   * Get job status by ID
   *
   * Returns the current status of a background job.
   * Used to track the progress of application generation and other async tasks.
   */
  @Get(':id/status')
  @ApiOperation({
    summary: 'Get job status',
    description: 'Returns the current status of a background job by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Job ID (returned when creating an application)',
    example: 'job-1737810000000-abc123def',
  })
  @ApiResponse({
    status: 200,
    description: 'Job status retrieved successfully',
    type: JobStatusDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
  })
  async getJobStatus(@Param('id') id: string): Promise<JobStatusDto> {
    const job = await this.jobsService.getJobStatus(id);

    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    return {
      id: job.id,
      type: job.type,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      retryCount: job.retryCount,
    };
  }

  /**
   * Health check for the jobs queue
   */
  @Get('health')
  @ApiOperation({
    summary: 'Queue health check',
    description: 'Check if the background job queue is healthy',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue is healthy',
  })
  @ApiResponse({
    status: 503,
    description: 'Queue is unhealthy',
  })
  async healthCheck(): Promise<{ healthy: boolean; provider: string }> {
    const healthy = await this.jobsService.healthCheck();
    const provider = process.env.JOBS_DRIVER || 'in-memory';

    return { healthy, provider };
  }
}
