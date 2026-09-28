#!/usr/bin/env node
// Incremental Typesense Leads Sync Script
// Can be scheduled via crontab (runs once and exits) or as a background daemon (--daemon)
// Configurable interval via .env (TYPESENSE_SYNC_INTERVAL_MINUTES, default: 5)
import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { syncLeadsToTypesense, type TypesenseSyncOptions } from '@/lib/typesense/sync'

function parseArgs(): {
  isDaemon: boolean
  isFull: boolean
  fromDate?: Date
  intervalMinutes: number
  batchSize?: number
} {
  const args = process.argv.slice(2)
  const isDaemon = args.includes('--daemon') || process.env.TYPESENSE_SYNC_DAEMON === 'true'
  const isFull = args.includes('--full')

  let fromDate: Date | undefined
  const fromIdx = args.indexOf('--from')
  if (fromIdx !== -1 && fromIdx + 1 < args.length) {
    const raw = args[fromIdx + 1]
    const parsed = new Date(raw.includes('T') ? raw : `${raw}T00:00:00Z`)
    if (isNaN(parsed.getTime())) {
      console.error(`[Typesense Sync] Invalid --from date format: "${raw}". Use YYYY-MM-DD or ISO string.`)
      process.exit(1)
    }
    fromDate = parsed
  }

  let intervalMinutes = parseInt(process.env.TYPESENSE_SYNC_INTERVAL_MINUTES || '5', 10)
  const intervalIdx = args.indexOf('--interval')
  if (intervalIdx !== -1 && intervalIdx + 1 < args.length) {
    const parsed = parseInt(args[intervalIdx + 1], 10)
    if (!isNaN(parsed) && parsed > 0) {
      intervalMinutes = parsed
    }
  }

  let batchSize: number | undefined
  const batchIdx = args.indexOf('--batch-size')
  if (batchIdx !== -1 && batchIdx + 1 < args.length) {
    const parsed = parseInt(args[batchIdx + 1], 10)
    if (!isNaN(parsed) && parsed > 0) {
      batchSize = parsed
    }
  }

  return { isDaemon, isFull, fromDate, intervalMinutes, batchSize }
}

async function runOnce(options: TypesenseSyncOptions): Promise<boolean> {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] [Typesense Sync] Starting sync run...`)

  const result = await syncLeadsToTypesense(options)

  if (result.success) {
    console.log(
      `[${new Date().toISOString()}] [Typesense Sync] SUCCESS: Synced ${result.synced}/${result.totalFound} leads in ${result.durationMs}ms (since: ${result.since || 'all'})`
    )
    return true
  } else {
    console.error(
      `[${new Date().toISOString()}] [Typesense Sync] ERROR: Sync failed after ${result.durationMs}ms: ${result.error}`
    )
    return false
  }
}

async function main() {
  const { isDaemon, isFull, fromDate, intervalMinutes, batchSize } = parseArgs()

  const syncOptions: TypesenseSyncOptions = {
    full: isFull,
    since: fromDate,
    batchSize,
  }

  if (isDaemon) {
    console.log(`[Typesense Sync] Running in DAEMON mode. Scheduling sync every ${intervalMinutes} minute(s).`)
    console.log(`[Typesense Sync] (Press Ctrl+C to terminate)`)

    let isRunning = false

    const execute = async () => {
      if (isRunning) {
        console.warn(`[${new Date().toISOString()}] [Typesense Sync] Previous run still in progress, skipping interval.`)
        return
      }
      isRunning = true
      try {
        await runOnce(syncOptions)
      } catch (err) {
        console.error('[Typesense Sync] Unexpected error in daemon loop:', err)
      } finally {
        isRunning = false
      }
    }

    // Run first sync immediately on boot
    await execute()

    // Schedule subsequent runs
    const intervalMs = intervalMinutes * 60 * 1000
    const timer = setInterval(execute, intervalMs)

    const shutdown = async () => {
      console.log('\n[Typesense Sync] Shutting down daemon gracefully...')
      clearInterval(timer)
      await prisma.$disconnect()
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  } else {
    // Single-shot run for crontab / docker run
    try {
      const ok = await runOnce(syncOptions)
      await prisma.$disconnect()
      process.exit(ok ? 0 : 1)
    } catch (err) {
      console.error('[Typesense Sync] Fatal error during sync:', err)
      await prisma.$disconnect()
      process.exit(1)
    }
  }
}

main().catch((err) => {
  console.error('[Typesense Sync] Unhandled fatal error:', err)
  process.exit(1)
})
