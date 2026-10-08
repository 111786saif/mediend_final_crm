import { prisma } from '@/lib/prisma'
import {
  getTypesenseClient,
  isTypesenseConfigured,
  ensureSalesPipelineCollection,
  upsertEmployeeHierarchy,
} from '@/lib/typesense/client'
import {
  SALES_PIPELINE_COLLECTION_NAME,
  mapLeadToSalesPipelineDocument,
  type EmployeeHierarchyDocument,
} from '@/lib/typesense/schema'
import { getSubordinates } from '@/lib/hierarchy'
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
  hierarchySynced?: number
}

/**
 * Syncs the entire employee hierarchy (team leads & subordinates) to Typesense
 */
export async function syncEmployeeHierarchyToTypesense(): Promise<number> {
  if (!isTypesenseConfigured()) return 0
  try {
    const employees = await prisma.employee.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    const hierarchyDocs: EmployeeHierarchyDocument[] = []
    const nowUnix = Math.floor(Date.now() / 1000)

    for (const emp of employees) {
      if (!emp.user) continue
      const subordinates = await getSubordinates(emp.id, true)
      const subordinateUserIds = Array.from(
        new Set([emp.userId, ...subordinates.map((s) => s.userId).filter(Boolean)])
      )

      hierarchyDocs.push({
        id: emp.userId,
        userId: emp.userId,
        employeeId: emp.id,
        name: emp.user.name || '',
        role: emp.user.role || '',
        teamLeadNumber: emp.bdNumber ? String(emp.bdNumber) : undefined,
        subordinateUserIds,
        updatedAt: nowUnix,
      })
    }

    return await upsertEmployeeHierarchy(hierarchyDocs)
  } catch (err) {
    console.warn('[Typesense Sync] Non-blocking error syncing employee hierarchy:', err)
    return 0
  }
}

/**
 * Incrementally syncs updated leads and employee hierarchy from PostgreSQL to Typesense.
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

    // Sync employee hierarchy alongside leads to ensure permission scoping stays up to date
    const hierarchySynced = await syncEmployeeHierarchyToTypesense()

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
      await cleanupOrphanedTypesenseLeads(client)
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

    // Clean up deleted/orphaned leads from Typesense if Typesense document count exceeds Database count
    await cleanupOrphanedTypesenseLeads(client)

    return {
      success: true,
      synced: totalSynced,
      totalFound,
      durationMs,
      since: syncSince?.toISOString(),
      hierarchySynced,
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

/**
 * Checks if document count in Typesense exceeds database lead count.
 * If orphaned/deleted leads are found in Typesense, deletes them in batches.
 * Runs with 0ms overhead when Typesense document count <= Database count.
 */
async function cleanupOrphanedTypesenseLeads(client: any): Promise<number> {
  try {
    const tsCollection = await client.collections(SALES_PIPELINE_COLLECTION_NAME).retrieve()
    const tsTotal = tsCollection.num_documents ?? 0
    const dbTotal = await prisma.lead.count()

    if (tsTotal <= dbTotal) {
      return 0
    }

    const dbLeads = await prisma.lead.findMany({ select: { id: true } })
    const dbLeadIds = new Set(dbLeads.map((l) => String(l.id)))

    let searchPage = 1
    const perPage = 250
    const orphanIds: string[] = []

    while ((searchPage - 1) * perPage < tsTotal) {
      const res = await client.collections(SALES_PIPELINE_COLLECTION_NAME).documents().search({
        q: '*',
        query_by: 'id',
        include_fields: 'id',
        page: searchPage,
        per_page: perPage,
      })

      for (const hit of res.hits || []) {
        if (hit.document?.id && !dbLeadIds.has(String(hit.document.id))) {
          orphanIds.push(String(hit.document.id))
        }
      }

      if ((res.hits || []).length < perPage) break
      searchPage++
    }

    if (orphanIds.length > 0) {
      console.log(`[Typesense Sync] Cleaning up ${orphanIds.length} deleted/orphaned leads from Typesense...`)
      for (const orphanId of orphanIds) {
        await client.collections(SALES_PIPELINE_COLLECTION_NAME).documents(orphanId).delete().catch(() => {})
      }
      return orphanIds.length
    }
  } catch (cleanErr) {
    console.warn('[Typesense Sync] Non-blocking error during orphan deletion check:', cleanErr)
  }
  return 0
}
