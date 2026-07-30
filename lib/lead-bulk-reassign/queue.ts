import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import {
  BulkLeadReassignCycleJobData,
  LEAD_BULK_REASSIGN_QUEUE_NAME,
} from '@/lib/lead-bulk-reassign/shared'

declare global {
  var __leadBulkReassignRedis__: IORedis | undefined
  var __leadBulkReassignQueue__:
    | Queue<BulkLeadReassignCycleJobData>
    | undefined
}

function createRedisConnection() {
  const redisUrl = process.env.REDIS_URL?.trim()
  if (redisUrl) {
    return new IORedis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
  }

  const host = process.env.REDIS_HOST?.trim()
  if (!host) {
    throw new Error(
      'Redis is not configured. Set REDIS_URL or REDIS_HOST/REDIS_PORT for bulk reassignment.'
    )
  }

  return new IORedis({
    host,
    port: Number(process.env.REDIS_PORT?.trim() || '6379'),
    password: process.env.REDIS_PASSWORD?.trim() || undefined,
    db: process.env.REDIS_DB ? Number(process.env.REDIS_DB) : undefined,
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
}

export function getLeadBulkReassignRedisConnection() {
  if (!globalThis.__leadBulkReassignRedis__) {
    globalThis.__leadBulkReassignRedis__ = createRedisConnection()
  }

  return globalThis.__leadBulkReassignRedis__
}

export function getLeadBulkReassignQueue() {
  if (!globalThis.__leadBulkReassignQueue__) {
    globalThis.__leadBulkReassignQueue__ = new Queue<BulkLeadReassignCycleJobData>(
      LEAD_BULK_REASSIGN_QUEUE_NAME,
      {
        connection: getLeadBulkReassignRedisConnection(),
        prefix:
          process.env.LEAD_BULK_REASSIGN_QUEUE_PREFIX?.trim() || 'mediend',
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: 500,
          removeOnFail: 500,
        },
      }
    )
  }

  return globalThis.__leadBulkReassignQueue__
}

export async function enqueueLeadBulkReassignCycle(
  runId: string,
  cycleNumber: number,
  delayMs: number
) {
  const queue = getLeadBulkReassignQueue()
  return queue.add(
    'process-cycle',
    {
      runId,
      cycleNumber,
    },
    {
      jobId: `${runId}:cycle:${cycleNumber}`,
      delay: Math.max(0, delayMs),
    }
  )
}
