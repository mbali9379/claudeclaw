import { Worker, WorkerOptions, Job, Processor } from 'bullmq';
import { Redis } from 'ioredis';
import { readEnvFile } from '../env.js';
import { logger } from '../logger.js';
import { QueueName } from '../queues/index.js';

/**
 * Base worker factory for BullMQ. Each worker gets its own dedicated
 * Redis connection (BullMQ requirement) and shared error handling,
 * lifecycle logging, and graceful shutdown hooks.
 *
 * Specific workers (agent, publish, pipeline, notify, maintenance) wrap
 * this factory with their own processor functions.
 */

const env = readEnvFile(['REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD']);

function createWorkerConnection(): Redis {
  return new Redis({
    host: env.REDIS_HOST ?? '127.0.0.1',
    port: Number(env.REDIS_PORT ?? 6379),
    password: env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export interface BaseWorkerOptions<T = unknown, R = unknown> {
  /** Queue name to subscribe to. Must match a registered queue. */
  queueName: QueueName;
  /** Job processor function. Receives the job, returns a result. */
  processor: Processor<T, R>;
  /** Max concurrent jobs this worker instance will process. */
  concurrency?: number;
  /** Optional rate limit (e.g. `{ max: 3, duration: 3600_000 }` for 3/hour). */
  limiter?: WorkerOptions['limiter'];
}

/**
 * Create a BullMQ worker with standard logging, error handling, and
 * graceful shutdown. The returned worker is already running.
 */
export function createBaseWorker<T = unknown, R = unknown>(
  opts: BaseWorkerOptions<T, R>,
): Worker<T, R> {
  const connection = createWorkerConnection();

  const worker = new Worker<T, R>(
    opts.queueName,
    async (job: Job<T, R>) => {
      const start = Date.now();
      logger.info(
        { queue: opts.queueName, jobId: job.id, name: job.name, attempt: job.attemptsMade + 1 },
        'Job started',
      );
      try {
        const result = await opts.processor(job, job.token ?? '');
        logger.info(
          {
            queue: opts.queueName,
            jobId: job.id,
            name: job.name,
            durationMs: Date.now() - start,
          },
          'Job completed',
        );
        return result;
      } catch (err) {
        logger.error(
          {
            err,
            queue: opts.queueName,
            jobId: job.id,
            name: job.name,
            attempt: job.attemptsMade + 1,
            durationMs: Date.now() - start,
          },
          'Job failed',
        );
        throw err;
      }
    },
    {
      connection,
      concurrency: opts.concurrency ?? 1,
      limiter: opts.limiter,
    },
  );

  worker.on('failed', (job, err) => {
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      logger.error(
        { err, queue: opts.queueName, jobId: job.id, name: job.name },
        'Job failed permanently (all retries exhausted)',
      );
    }
  });

  worker.on('error', (err) => {
    logger.error({ err, queue: opts.queueName }, 'Worker error');
  });

  worker.on('ready', () => {
    logger.info({ queue: opts.queueName }, 'Worker ready');
  });

  return worker;
}

/**
 * Gracefully close a set of workers. Waits for in-flight jobs to
 * finish (up to the BullMQ default timeout), then closes connections.
 */
export async function closeWorkers(workers: Worker[]): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
}
