# Jobs Module

Background-job runtime for the API. Pluggable queue providers selected via
`JOBS_DRIVER`.

## Drivers

| `JOBS_DRIVER` | Provider                  | When to use            |
| ------------- | ------------------------- | ---------------------- |
| `in-memory`   | `InMemoryQueueProvider`   | Local dev / single-machine |
| `qstash`      | `QStashQueueProvider`     | Production (Upstash QStash) |

Selected at boot in [`jobs.module.ts`](./jobs.module.ts) via the
`QUEUE_PROVIDER` factory.

## Job lifecycle

1. `JobsService.publishJob(type, data)` writes a `BackgroundJob` row
   (`PENDING`) and pushes to the queue.
2. The provider invokes the registered handler (`subscribe()`).
3. `ApplicationProcessor` updates the row to `RUNNING` → `COMPLETED` /
   `FAILED`. Status is streamed to the frontend via SSE.

## Endpoints

| Method | Path                                    | Description |
| ------ | --------------------------------------- | ----------- |
| GET    | `/api/v1/jobs/health`                   | Queue health probe |
| POST   | `/api/v1/jobs/qstash-webhook`           | QStash webhook (verified signature) — only registered when `JOBS_DRIVER=qstash` |

## Env vars

```bash
JOBS_DRIVER=in-memory                      # in-memory | qstash
QSTASH_TOKEN=<upstash-qstash-token>        # required when qstash
QSTASH_CURRENT_SIGNING_KEY=<key>
QSTASH_NEXT_SIGNING_KEY=<key>
QSTASH_WEBHOOK_URL=<public-url>            # falls back to API_BASE_URL + /api/v1/jobs/qstash-webhook
```

## Adding a new job type

1. Add to `JobType` enum in [`interfaces/queue.interface.ts`](./interfaces/queue.interface.ts).
2. Implement a processor in `processors/`.
3. Register the handler in `JobsService.registerHandlers()`.
4. Call `JobsService.publishJob(JobType.YOUR_TYPE, payload)` from the producer.
