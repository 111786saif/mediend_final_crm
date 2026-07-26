import 'dotenv/config'
import { Job, Worker } from 'bullmq'
import { getLeadBulkReassignRedisConnection } from '@/lib/lead-bulk-reassign/queue'
import { processBulkLeadReassignCycle } from '@/lib/lead-bulk-reassign/server'
import {
  BulkLeadReassignCycleJobData,
  LEAD_BULK_REASSIGN_QUEUE_NAME,
} from '@/lib/lead-bulk-reassign/shared'

const worker = new Worker<BulkLeadReassignCycleJobData>(
  LEAD_BULK_REASSIGN_QUEUE_NAME,
  async (job: Job<BulkLeadReassignCycleJobData>) => {
    await processBulkLeadReassignCycle(
      job.data.runId,
      job.id != null ? String(job.id) : null
    )
  },
  {
    connection: getLeadBulkReassignRedisConnection(),
    prefix: process.env.LEAD_BULK_REASSIGN_QUEUE_PREFIX?.trim() || 'mediend',
    concurrency: 1,
  }
)

worker.on('ready', () => {
  console.log('[lead-bulk-reassign-worker] ready')
})

worker.on('completed', (job) => {
  console.log(
    `[lead-bulk-reassign-worker] completed job ${job.id} for run ${job.data.runId}`
  )
})

worker.on('failed', (job, error) => {
  console.error(
    `[lead-bulk-reassign-worker] failed job ${job?.id} for run ${job?.data.runId}:`,
    error
  )
})

async function shutdown(signal: string) {
  console.log(`[lead-bulk-reassign-worker] shutting down on ${signal}`)
  await worker.close()
  process.exit(0)
}

process.on('SIGINT', () => {
  void shutdown('SIGINT')
})

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})
