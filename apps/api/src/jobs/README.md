# JobsModule - Queue Abstraction

Background job processing module with multi-provider support for queue management.

## Overview

The JobsModule provides a queue abstraction layer that enables asynchronous background job processing. It supports multiple queue providers through a factory pattern, allowing seamless switching between in-memory queues for development and Azure Service Bus for production.

## Architecture

### Provider Pattern

The module follows the same provider pattern as StorageModule and LLMModule:

```typescript
JOBS_DRIVER=in-memory  // Development & Testing
JOBS_DRIVER=service-bus  // Production
```

### Components

- **QueueProvider Interface**: Defines the contract for queue implementations
- **InMemoryQueueProvider**: Array-based queue for local development
- **AzureServiceBusProvider**: Azure Service Bus integration for production
- **JobsService**: Orchestrates job publishing and status queries
- **ApplicationProcessor**: Handles the application generation pipeline

## Usage

### Publishing a Job

```typescript
import { JobsService } from './jobs/jobs.service';
import { JobType } from './jobs/interfaces/queue.interface';

@Injectable()
export class ApplicationsService {
  constructor(private readonly jobsService: JobsService) {}

  async createApplication(data: CreateApplicationDto) {
    // Create application in database
    const application = await this.prisma.application.create({
      data: {
        userId: data.userId,
        jobPostingId: data.jobPostingId,
        status: 'PENDING',
      },
    });

    // Publish job to queue
    const jobId = await this.jobsService.publishJob(
      JobType.APPLICATION_GENERATE,
      {
        applicationId: application.id,
        userId: data.userId,
        jobPostingId: data.jobPostingId,
      },
    );

    return { application, jobId };
  }
}
```

### Checking Job Status

```typescript
const job = await this.jobsService.getJobStatus(jobId);
console.log(job.status); // PENDING | PROCESSING | COMPLETED | FAILED
```

## Job Types

Current job types:
- `APPLICATION_GENERATE`: Generates cover letter and resume for an application

Future job types can be easily added to the `JobType` enum.

## Configuration

### Environment Variables

```bash
# Queue Driver Selection
JOBS_DRIVER=in-memory                          # or "service-bus"

# Azure Service Bus (Production)
SERVICE_BUS_CONNECTION_STRING=<connection>     # Required when JOBS_DRIVER=service-bus
SERVICE_BUS_QUEUE_NAME=application-jobs        # Default queue name
```

### Config Service

```typescript
get jobsDriver(): 'in-memory' | 'service-bus' {
  return this.nestConfig.get('JOBS_DRIVER', { infer: true });
}
```

## Providers

### InMemoryQueueProvider

**Features:**
- Array-based queue implementation
- Automatic retry logic (max 3 retries)
- Immediate processing via setTimeout
- No persistence (resets on restart)
- Ideal for development and testing

**Use Cases:**
- Local development
- Unit/Integration tests
- CI/CD pipelines

### AzureServiceBusProvider

**Features:**
- Azure Service Bus integration
- Message persistence
- Built-in retry logic
- Dead Letter Queue support
- Horizontal scaling via multiple consumers
- Graceful shutdown handling

**Use Cases:**
- Production environments
- High-volume processing
- Distributed systems

## Application Pipeline

The `ApplicationProcessor` implements the complete application generation workflow:

1. **Load Data**: Fetch Profile and JobPosting from database
2. **Generate Content**: Use LLMService to generate cover letter and resume
3. **Create PDFs**: Convert generated text to PDFs using PdfService
4. **Upload Files**: Store PDFs in StorageService (Azure Blob or Disk)
5. **Update Status**: Mark application as READY with file references

### Status Flow

```
PENDING → GENERATING → READY
              ↓
           FAILED (with error message)
```

## Error Handling

### Retry Logic

- **InMemory**: Manual retry up to 3 times
- **Service Bus**: Built-in retry via Service Bus configuration

### Error Tracking

Failed jobs include:
- Error message
- Retry count
- Completion timestamp
- Stack trace (in logs)

## Testing

### Unit Tests

```bash
npm test -- jobs
```

**Coverage:**
- JobsService: 6 tests
- InMemoryQueueProvider: 9 tests
- Mocked dependencies for isolation

### Integration Tests

Create test with real processors:

```typescript
describe('Jobs Integration', () => {
  let jobsService: JobsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [JobsModule, PrismaModule, /* ... */],
    }).compile();

    jobsService = module.get<JobsService>(JobsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should process application job end-to-end', async () => {
    // Setup test data
    const application = await prisma.application.create({
      data: { /* ... */ },
    });

    // Publish job
    const jobId = await jobsService.publishJob(
      JobType.APPLICATION_GENERATE,
      { applicationId: application.id, /* ... */ },
    );

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify results
    const updatedApp = await prisma.application.findUnique({
      where: { id: application.id },
    });
    expect(updatedApp?.status).toBe('READY');
  });
});
```

## Health Checks

The module provides health check endpoints:

```typescript
const isHealthy = await this.jobsService.healthCheck();
```

- **InMemory**: Always returns `true`
- **Service Bus**: Tests connection by creating a test sender

## Adding New Job Types

1. Add to `JobType` enum:
```typescript
export enum JobType {
  APPLICATION_GENERATE = 'application:generate',
  PROFILE_SYNC = 'profile:sync', // New job type
}
```

2. Create a processor:
```typescript
@Injectable()
export class ProfileProcessor {
  async process(job: Job<ProfileJobData>): Promise<void> {
    // Implementation
  }
}
```

3. Register in `JobsService`:
```typescript
private async registerHandlers() {
  await this.queueProvider.subscribe(
    JobType.PROFILE_SYNC,
    async (job: Job) => {
      await this.profileProcessor.process(job);
    },
  );
}
```

## Best Practices

### Job Data

- Keep job data minimal (IDs, not full entities)
- Load fresh data from database in processor
- Avoid storing large objects in queue

### Error Handling

- Always wrap processor logic in try/catch
- Update database status on failure
- Log errors with context

### Performance

- Use InMemory for development
- Use Service Bus for production
- Monitor queue depth and processing time
- Scale horizontally with multiple consumers

## Azure Service Bus Setup

### Production Setup

1. Create Service Bus Namespace in Azure Portal
2. Create Queue: `application-generate`
3. Copy Connection String from "Shared access policies"
4. Set environment variable:
   ```bash
   SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://...
   ```

### Queue Configuration

Recommended settings:
- **Max delivery count**: 4 (initial + 3 retries)
- **Message TTL**: 14 days
- **Dead letter on expiration**: Yes
- **Lock duration**: 5 minutes

## Monitoring

### Logs

All job lifecycle events are logged:
- Job published
- Processing started
- Processing completed
- Processing failed
- Retry queued

### Metrics (Future)

Consider adding:
- Queue depth
- Processing time
- Success/failure rate
- Retry count distribution

## Security

- Connection strings stored in environment variables
- No sensitive data in job payloads
- Database queries use Prisma (SQL injection safe)
- File operations use StorageService abstraction
