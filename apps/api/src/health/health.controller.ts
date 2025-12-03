import { Controller, Get, Logger } from '@nestjs/common';
import { HealthCheckService, HealthCheck, HealthCheckResult } from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { JobsService } from '../jobs/jobs.service';
import { LLMService } from '../llm/llm.service';
import { Throttle } from '@nestjs/throttler';

@ApiTags('health')
@Controller('health')
@Throttle({ default: { limit: 600, ttl: 60000 } }) // 600 requests per minute (10/sec)
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly jobsService: JobsService,
    private readonly llmService: LLMService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Comprehensive health check' })
  @ApiResponse({ status: 200, description: 'All services are healthy' })
  @ApiResponse({ status: 503, description: 'One or more services are unhealthy' })
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.checkDatabase(),
      () => this.checkStorage(),
      () => this.checkQueue(),
      () => this.checkLLM(),
    ]);
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe (Kubernetes/ACA)' })
  @ApiResponse({ status: 200, description: 'Application is alive' })
  async live(): Promise<{ status: string; timestamp: string }> {
    // Basic liveness check - just confirms the app is running
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe (Kubernetes/ACA)' })
  @ApiResponse({ status: 200, description: 'Application is ready to accept traffic' })
  @ApiResponse({ status: 503, description: 'Application is not ready' })
  async ready(): Promise<HealthCheckResult> {
    // Readiness check - confirms critical dependencies are available
    return this.health.check([() => this.checkDatabase(), () => this.checkStorage()]);
  }

  /**
   * Database health check
   */
  private async checkDatabase(): Promise<Record<string, any>> {
    const startTime = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        database: {
          status: 'up',
          responseTime: `${responseTime}ms`,
        },
      };
    } catch (error) {
      this.logger.error('Database health check failed', error);
      throw new Error('Database is not available');
    }
  }

  /**
   * Storage health check
   */
  private async checkStorage(): Promise<Record<string, any>> {
    try {
      const isHealthy = await this.storageService.healthCheck();

      if (!isHealthy) {
        throw new Error('Storage health check returned false');
      }

      return {
        storage: {
          status: 'up',
        },
      };
    } catch (error) {
      this.logger.error('Storage health check failed', error);
      throw new Error('Storage is not available');
    }
  }

  /**
   * Queue health check
   */
  private async checkQueue(): Promise<Record<string, any>> {
    try {
      const isHealthy = await this.jobsService.healthCheck();

      if (!isHealthy) {
        throw new Error('Queue health check returned false');
      }

      return {
        queue: {
          status: 'up',
        },
      };
    } catch (error) {
      this.logger.error('Queue health check failed', error);
      throw new Error('Queue is not available');
    }
  }

  /**
   * LLM health check
   */
  private async checkLLM(): Promise<Record<string, any>> {
    try {
      const isHealthy = await this.llmService.healthCheck();

      if (!isHealthy) {
        throw new Error('LLM health check returned false');
      }

      return {
        llm: {
          status: 'up',
        },
      };
    } catch (error) {
      this.logger.error('LLM health check failed', error);
      // LLM failures are non-critical - don't fail the health check
      this.logger.warn('LLM service is degraded but application continues');
      return {
        llm: {
          status: 'degraded',
          message: 'LLM service unavailable',
        },
      };
    }
  }
}
