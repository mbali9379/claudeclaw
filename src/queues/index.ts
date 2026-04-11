import { Queue, QueueOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { readEnvFile } from '../env.js';
import { logger } from '../logger.js';

/**
 * Central queue registry for ClaudeClaw. Defines the shared Redis
 * connection and all named BullMQ queues used by the system.
 *
 * Queues are defined per the Durable Execution Upgrade spec
 * (2. Areas/02 HSTM/Operations/Specs/ClaudeClaw Durable Execution Upgrade - BullMQ + Redis.md).
 */

export type QueueName =
  | 'publish'
  | 'agent'
  | 'pipeline'
  | 'notify'
  | 'maintenance';

const env = readEnvFile([
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
]);

const redisHost = env.REDIS_HOST ?? '127.0.0.1';
const redisPort = Number(env.REDIS_PORT ?? 6379);
const redisPassword = env.REDIS_PASSWORD;

/**
 * Shared Redis connection for all queue producers. BullMQ recommends
 * reusing a single connection for producers. Workers must use their
 * own dedicated connection (see workers/base.ts).
 */
export const redisConnection: Redis = new Redis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisConnection.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});

redisConnection.on('connect', () => {
  logger.info({ host: redisHost, port: redisPort }, 'Redis connected');
});

const defaultJobOptions: QueueOptions['defaultJobOptions'] = {
  removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1000 },
  removeOnFail: { age: 30 * 24 * 60 * 60 },
};

function createQueue(name: QueueName): Queue {
  return new Queue(name, {
    connection: redisConnection,
    defaultJobOptions,
  });
}

/**
 * Queue registry. Access queues via `queues.publish`, `queues.agent`, etc.
 * Each queue is lazily created on first access and reused thereafter.
 */
export const queues = {
  publish: createQueue('publish'),
  agent: createQueue('agent'),
  pipeline: createQueue('pipeline'),
  notify: createQueue('notify'),
  maintenance: createQueue('maintenance'),
} as const;

/**
 * Per-queue retry and rate-limit policies. Applied at job-add time,
 * not at queue-create time, so individual jobs can override.
 */
export const queuePolicies: Record<
  QueueName,
  { attempts: number; backoff: { type: 'exponential'; delay: number } }
> = {
  publish: { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
  agent: { attempts: 2, backoff: { type: 'exponential', delay: 120_000 } },
  pipeline: { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
  notify: { attempts: 3, backoff: { type: 'exponential', delay: 30_000 } },
  maintenance: { attempts: 1, backoff: { type: 'exponential', delay: 0 } },
};

/**
 * Close all queues and the shared Redis connection. Used at shutdown
 * and in tests.
 */
export async function closeQueues(): Promise<void> {
  await Promise.all(Object.values(queues).map((q) => q.close()));
  await redisConnection.quit();
}
