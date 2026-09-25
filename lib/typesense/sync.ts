import { prisma } from '@/lib/prisma'
import {
  getTypesenseClient,
  isTypesenseConfigured,
  ensureSalesPipelineCollection,
} from '@/lib/typesense/client'
import {
  SALES_PIPELINE_COLLECTION_NAME,
  mapLeadToSalesPipelineDocument,
} from '@/lib/typesense/schema'
import { pipelineTableSelect } from '@/lib/pipeline/server-query'

export const TYPESENSE_LEADS_SYNC_SOURCE = 'typesense_sales_pipeline'

export interface TypesenseSyncOptions {
  /** If true, sync all leads regardless of last sync timestamp */
  full?: boolean
  /** Sync leads updated on or after this timestamp */
  since?: Date
  /** Number of leads to query and upsert per batch (default: 500) */
  batchSize?: number
  /** Lookback window in minutes if no prior sync state is recorded (default: 10) */
  fallbackLookbackMinutes?: number
  /** Safety overlap buffer in seconds to prevent missing concurrent in-flight updates (default: 60) */
  overlapBufferSeconds?: number
}

export interface TypesenseSyncResult {
  success: boolean
  synced: number
  totalFound: number
  durationMs: number
  since?: string
  error?: string
}

/**
 * Incrementally syncs updated leads from PostgreSQL to Typesense.
 * Uses SyncState to track last sync timestamp and records execution to CronJobLog.
 */
export async function syncLeadsToTypesense(
  options: TypesenseSyncOptions = {}
): Promise<TypesenseSyncResult> {
  const startTime = Date.now()
  const runStartDate = new Date(startTime)

  if (!isTypesenseConfigured()) {
    return {
      success: false,
      synced: 0,
      totalFound: 0,
      durationMs: 0,
      error: 'Typesense is not configured in environment variables (TYPESENSE_URL / TYPESENSE_API_KEY)',
    }
  }

  const batchSize = Math.max(1, options.batchSize || parseInt(process.env.TYPESENSE_SYNC_BATCH_SIZE || '500', 10))
  const fallbackLookbackMinutes = options.fallbackLookbackMinutes || parseInt(process.env.TYPESENSE_SYNC_LOOKBACK_MINUTES || '10', 10)
  const overlapBufferSeconds = options.overlapBufferSeconds ?? 60

  try {
    await ensureSalesPipelineCollection()
    const client = getTypesenseClient()

    // Determine the cutoff timestamp
    let syncSince: Date | undefined

    if (options.full) {
      syncSince = undefined
    } else if (options.since) {
      syncSince = options.since
    } else {
      const syncState = await prisma.syncState.findUnique({
        where: { sourceType: TYPESENSE_LEADS_SYNC_SOURCE },
      })

      if (syncState?.lastSyncedDate) {
        // Subtract safety overlap buffer to handle concurrent DB writes
        syncSince = new Date(syncState.lastSyncedDate.getTime() - overlapBufferSeconds * 1000)
      } else {
        // Default to fallback lookback window
        syncSince = new Date(startTime - fallbackLookbackMinutes * 60 * 1000)
      }
    }

    const whereClause = syncSince
      ? { updatedDate: { gte: syncSince } }
      : {}

    const totalFound = await prisma.lead.count({ where: whereClause })

    if (totalFound === 0) {
      const durationMs = Date.now() - startTime
      // Update lastRunAt on sync state even if no records changed
      await prisma.syncState.upsert({
        where: { sourceType: TYPESENSE_LEADS_SYNC_SOURCE },
        create: {
          sourceType: TYPESENSE_LEADS_SYNC_SOURCE,
          lastSyncedDate: runStartDate,
          recordsCount: 0,
          lastRunAt: runStartDate,
        },
        update: {
          lastRunAt: runStartDate,
        },
      }).catch(() => {})

      return {
        success: true,
        synced: 0,
        totalFound: 0,
        durationMs,
        since: syncSince?.toISOString(),
      }
    }

    let skip = 0
    let totalSynced = 0

    while (skip < totalFound) {
      const take = Math.min(batchSize, totalFound - skip)
      const leads = await prisma.lead.findMany({
        where: whereClause,
        select: pipelineTableSelect,
        orderBy: { updatedDate: 'asc' },
        skip,
        take,
      })

      if (leads.length === 0) break

      const documents = leads.map(mapLeadToSalesPipelineDocument)
      const importResults = await client
        .collections(SALES_PIPELINE_COLLECTION_NAME)
        .documents()
        .import(documents, { action: 'upsert' })

      const failed = (importResults as any[]).filter((r) => !r.success)
      if (failed.length > 0) {
        console.warn(`[Typesense Sync] ${failed.length} documents failed to import in batch:`, failed[0]?.error)
      }

      totalSynced += documents.length - failed.length
      skip += take
    }

    const durationMs = Date.now() - startTime

    // Update persistent sync state
    await prisma.syncState.upsert({
      where: { sourceType: TYPESENSE_LEADS_SYNC_SOURCE },
      create: {
        sourceType: TYPESENSE_LEADS_SYNC_SOURCE,
        lastSyncedDate: runStartDate,
        recordsCount: totalSynced,
        lastRunAt: runStartDate,
      },
      update: {
        lastSyncedDate: runStartDate,
        recordsCount: totalSynced,
        lastRunAt: runStartDate,
      },
    })

    // Record in CronJobLog for observability
    await prisma.cronJobLog.create({
      data: {
        jobName: 'typesense_sync',
        status: 'success',
        durationMs,
        recordsProcessed: totalSynced,
        message: `Synced ${totalSynced} leads to Typesense (modified since ${syncSince?.toISOString() || 'all'})`,
      },
    }).catch((err) => {
      console.warn('[Typesense Sync] Failed to write CronJobLog entry:', err)
    })

    return {
      success: true,
      synced: totalSynced,
      totalFound,
      durationMs,
      since: syncSince?.toISOString(),
    }
  } catch (error: any) {
    const durationMs = Date.now() - startTime
    const errorMessage = error?.message || String(error)

    // Record failure in CronJobLog
    await prisma.cronJobLog.create({
      data: {
        jobName: 'typesense_sync',
        status: 'error',
        durationMs,
        recordsProcessed: 0,
        message: 'Typesense lead sync failed',
        error: error?.stack || errorMessage,
      },
    }).catch(() => {})

    return {
      success: false,
      synced: 0,
      totalFound: 0,
      durationMs,
      error: errorMessage,
    }
  }
}
