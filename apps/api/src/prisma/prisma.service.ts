import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, PoolConfig } from 'pg';

/**
 * Connection pool configuration optimized for different environments
 */
interface PoolSettings {
  max: number;
  min: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  statementTimeout: number;
  queryTimeout: number;
}

const POOL_SETTINGS: Record<string, PoolSettings> = {
  development: {
    max: 10,                      // Smaller pool for local dev
    min: 2,                       // Keep some connections warm
    idleTimeoutMillis: 30000,     // 30 seconds
    connectionTimeoutMillis: 5000, // 5 seconds
    statementTimeout: 30000,      // 30 seconds
    queryTimeout: 30000,          // 30 seconds
  },
  production: {
    max: 20,                      // Larger pool for production load
    min: 5,                       // More warm connections
    idleTimeoutMillis: 60000,     // 60 seconds (longer for connection reuse)
    connectionTimeoutMillis: 3000, // 3 seconds (fail fast)
    statementTimeout: 60000,      // 60 seconds (allow longer queries)
    queryTimeout: 60000,          // 60 seconds
  },
  test: {
    max: 5,                       // Minimal pool for tests
    min: 1,
    idleTimeoutMillis: 10000,     // 10 seconds
    connectionTimeoutMillis: 2000,
    statementTimeout: 10000,
    queryTimeout: 10000,
  },
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private pool: Pool;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(private configService: ConfigService) {
    // Get environment-specific pool settings
    const nodeEnv = configService.get<string>('NODE_ENV', 'development');
    const settings = POOL_SETTINGS[nodeEnv] || POOL_SETTINGS.development;
    
    // Allow overrides via environment variables
    const poolConfig: PoolConfig = {
      connectionString: configService.get<string>('DATABASE_URL'),
      max: configService.get<number>('DB_POOL_MAX', settings.max),
      min: configService.get<number>('DB_POOL_MIN', settings.min),
      idleTimeoutMillis: configService.get<number>('DB_IDLE_TIMEOUT', settings.idleTimeoutMillis),
      connectionTimeoutMillis: configService.get<number>('DB_CONNECTION_TIMEOUT', settings.connectionTimeoutMillis),
      statement_timeout: settings.statementTimeout,
      query_timeout: settings.queryTimeout,
      // Application name for monitoring
      application_name: 'smart-apply-api',
    };

    // Create PostgreSQL connection pool
    const pool = new Pool(poolConfig);

    // Pool error handling
    pool.on('error', (err) => {
      this.logger.error('Unexpected pool error:', err);
    });

    pool.on('connect', () => {
      this.logger.debug('New client connected to pool');
    });

    pool.on('remove', () => {
      this.logger.debug('Client removed from pool');
    });

    // Create Prisma adapter
    const adapter = new PrismaPg(pool);

    // Initialize PrismaClient with adapter
    super({ adapter });
    this.pool = pool;

    this.logger.log(`Pool configured: max=${poolConfig.max}, min=${poolConfig.min}, env=${nodeEnv}`);
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected successfully (Prisma 7 with PG Adapter)');
      
      // Start health check interval in production
      if (this.configService.get<string>('NODE_ENV') === 'production') {
        this.startHealthCheck();
      }
    } catch (error) {
      this.logger.error('❌ Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    // Stop health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('Database disconnected and connection pool closed');
  }

  /**
   * Get pool statistics for monitoring
   */
  getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  /**
   * Periodic health check to keep connections warm and detect issues
   */
  private startHealthCheck() {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.$queryRaw`SELECT 1`;
        this.logger.debug(`Pool health OK: ${JSON.stringify(this.getPoolStats())}`);
      } catch (error) {
        this.logger.error('Pool health check failed:', error);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Refresh all materialized views
   * Call this periodically (e.g., via cron job) or after significant data changes
   */
  async refreshMaterializedViews(): Promise<void> {
    try {
      await this.$executeRaw`SELECT refresh_all_materialized_views()`;
      this.logger.log('Materialized views refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh materialized views:', error);
      throw error;
    }
  }

  /**
   * Get user statistics from materialized view (fast)
   */
  async getUserStatistics(userId: string) {
    const stats = await this.$queryRaw<any[]>`
      SELECT * FROM mv_user_statistics WHERE "userId" = ${userId}
    `;
    return stats[0] || null;
  }

  /**
   * Get application status distribution from materialized view (fast)
   */
  async getApplicationStatusDistribution(userId: string) {
    return this.$queryRaw<any[]>`
      SELECT * FROM mv_application_status_distribution WHERE "userId" = ${userId}
    `;
  }

  /**
   * Get monthly trends from materialized view (fast)
   */
  async getMonthlyTrends(userId: string, months: number = 6) {
    return this.$queryRaw<any[]>`
      SELECT * FROM mv_monthly_application_trends 
      WHERE "userId" = ${userId} 
      AND "month" >= CURRENT_DATE - INTERVAL '${months} months'
      ORDER BY "month" DESC
    `;
  }
}

