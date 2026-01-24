import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicator,
  HealthIndicatorResult,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { Injectable } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { JobsService } from '../jobs/jobs.service';
import { TemplatesService } from '../templates/templates.service';
import { LLMService } from '../llm/llm.service';
import { Public } from '../common/decorators/public.decorator';

/**
 * Custom health indicator for Storage Service
 */
@Injectable()
class StorageHealthIndicator extends HealthIndicator {
  constructor(private readonly storageService: StorageService) {
    super();
  }

  async isHealthy(): Promise<HealthIndicatorResult> {
    const isHealthy = await this.storageService.healthCheck();
    const result = this.getStatus('storage', isHealthy);

    if (isHealthy) {
      return result;
    }
    throw new Error('Storage service is not healthy');
  }
}

/**
 * Custom health indicator for Queue Service
 */
@Injectable()
class QueueHealthIndicator extends HealthIndicator {
  constructor(private readonly jobsService: JobsService) {
    super();
  }

  async isHealthy(): Promise<HealthIndicatorResult> {
    const isHealthy = await this.jobsService.healthCheck();
    const result = this.getStatus('queue', isHealthy);

    if (isHealthy) {
      return result;
    }
    throw new Error('Queue service is not healthy');
  }
}

/**
 * Custom health indicator for Templates Service
 */
@Injectable()
class TemplatesHealthIndicator extends HealthIndicator {
  constructor(private readonly templatesService: TemplatesService) {
    super();
  }

  async isHealthy(): Promise<HealthIndicatorResult> {
    const isHealthy = await this.templatesService.healthCheck();
    const result = this.getStatus('templates', isHealthy);

    if (isHealthy) {
      return result;
    }
    throw new Error('Templates service is not healthy');
  }
}

/**
 * Custom health indicator for LLM Service
 */
@Injectable()
class LLMHealthIndicator extends HealthIndicator {
  constructor(private readonly llmService: LLMService) {
    super();
  }

  async isHealthy(): Promise<HealthIndicatorResult> {
    const isHealthy = await this.llmService.healthCheck();
    const result = this.getStatus('llm', isHealthy, {
      message: isHealthy ? 'LLM provider available' : 'LLM provider unavailable',
    });

    if (isHealthy) {
      return result;
    }
    throw new Error('LLM service is not healthy');
  }
}

@ApiTags('health')
@Controller('health')
@SkipThrottle() // Health checks should never be rate limited
export class HealthController {
  private storageIndicator: StorageHealthIndicator;
  private queueIndicator: QueueHealthIndicator;
  private templatesIndicator: TemplatesHealthIndicator;
  private llmIndicator: LLMHealthIndicator;

  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private prisma: PrismaService,
    private storageService: StorageService,
    private jobsService: JobsService,
    private templatesService: TemplatesService,
    private llmService: LLMService,
  ) {
    this.storageIndicator = new StorageHealthIndicator(storageService);
    this.queueIndicator = new QueueHealthIndicator(jobsService);
    this.templatesIndicator = new TemplatesHealthIndicator(templatesService);
    this.llmIndicator = new LLMHealthIndicator(llmService);
  }

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Comprehensive health check for all services' })
  @ApiResponse({ status: 200, description: 'All services are healthy' })
  @ApiResponse({ status: 503, description: 'One or more services are unhealthy' })
  async check() {
    return this.health.check([
      // Database check
      () => this.prismaHealth.pingCheck('database', this.prisma),

      // Storage check
      () => this.storageIndicator.isHealthy(),

      // Queue check
      () => this.queueIndicator.isHealthy(),

      // Templates check
      () => this.templatesIndicator.isHealthy(),

      // LLM check (provider + circuit breaker health)
      () => this.llmIndicator.isHealthy(),
    ]);
  }

  @Get('live')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness probe - checks if application is running' })
  @ApiResponse({ status: 200, description: 'Application is alive' })
  checkLiveness() {
    // Simple liveness check - just returns 200 if app is running
    return this.health.check([]);
  }

  @Get('ready')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe - checks if application is ready to serve traffic' })
  @ApiResponse({ status: 200, description: 'Application is ready' })
  @ApiResponse({ status: 503, description: 'Application is not ready' })
  checkReadiness() {
    // Readiness check - verifies critical services (database + storage)
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      () => this.storageIndicator.isHealthy(),
    ]);
  }
}
