import { NextRequest } from 'next/server'
import {
  queryMySQL,
  testMySQLConnection,
} from '@/lib/mysql-source-client'
import { prisma } from '@/lib/prisma'
import {
  mapMySQLLeadToPrisma,
  mapMySQLLeadToPrismaAsyncFallback,
  mapMySQLLeadToPrismaWithoutOwner,
  getLeadLatestActivityDate,
  type MySQLLeadRow,
} from '@/lib/sync/mysql-lead-mapper'
import { loadLookupMaps } from '@/lib/sync/mysql-lookup-cache'
import { fetchBDUsersMap } from '@/lib/sync/mysql-bd-map'
import { UserRole } from '@/generated/prisma/client'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  processMySQLIncomingLead,
  processQueuedMySQLIncomingLeads,
  queueMySQLIncomingLead,
} from '@/lib/mysql-incoming-leads'
import { stripImportedLeadOwnership } from '@/lib/imported-lead-ingestion'
import { resolveInboundSubStatus } from '@/lib/sub-status'

interface MySQLRemarkRow {
  id: number
  RefId: number
  Remarks: string
  UpdateBy: number | null
  UpdateDate: Date | string
  IP: string | null
  LeadStatus: number | null
}

const BATCH_SIZE = 2500
const SYNC_SOURCE_TYPE = 'mysql_leads'
const MAX_EXECUTION_TIME = 9 * 60 * 1000 // 9 minutes (cron-job.org has 10 min timeout)

/**
 * POST /api/sync/mysql-leads
 * Sync leads from MySQL to PostgreSQL (incremental sync)
 * 
 * Authentication: Bearer token with CRON_SECRET
 * 
 * This endpoint is designed to be called by cron-job.org every 10 minutes
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Check for API key authentication
    const authHeader = request.headers.get('authorization')
    const expectedSecrets = [
      process.env.CRON_SECRET,
    ].filter(Boolean) as string[]

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorizedResponse('Missing or invalid Authorization header')
    }

    const token = authHeader.substring(7)
    if (!expectedSecrets.length || !expectedSecrets.includes(token)) {
      return unauthorizedResponse('Invalid API token')
    }

    // Test MySQL connection
    const isConnected = await testMySQLConnection()
    if (!isConnected) {
      return errorResponse('Failed to connect to MySQL database', 500)
    }

    // Get sync state
    let syncState = await prisma.syncState.findUnique({
      where: { sourceType: SYNC_SOURCE_TYPE },
    })

    if (!syncState) {
      const defaultDate = new Date()
      defaultDate.setDate(defaultDate.getDate() - 1)

      syncState = await prisma.syncState.create({
        data: {
          sourceType: SYNC_SOURCE_TYPE,
          lastSyncedDate: defaultDate,
          lastSyncedId: null,
          recordsCount: 0,
          lastRunAt: new Date(),
        },
      })
    }

    const lastSyncedDate = syncState.lastSyncedDate

    // Get system user
    let systemUser = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
    })
    if (!systemUser) {
      systemUser = await prisma.user.findFirst()
      if (!systemUser) {
        return errorResponse('No users found in system. Cannot process leads.', 500)
      }
    }

    // Fetch new/changed leads since the cursor — covers receive (LeadEntryDate / create_date),
    // assignment (Lead_Date) and update events.
    const leads = await queryMySQL<MySQLLeadRow>(
      `SELECT \`lead\`.* FROM \`lead\`
       WHERE COALESCE(LeadEntryDate, create_date) >= ?
          OR (Lead_Date IS NOT NULL AND Lead_Date >= ?)
          OR (update_date IS NOT NULL AND update_date >= ?)
       ORDER BY COALESCE(LeadEntryDate, create_date, Lead_Date) ASC, id ASC
       LIMIT ?`,
      [lastSyncedDate, lastSyncedDate, lastSyncedDate, BATCH_SIZE]
    )

    const lookups = await loadLookupMaps()
    const bdMap = await fetchBDUsersMap()
    const queueDeps = { systemUserId: systemUser.id, lookups, bdMap }

    let syncedCount = 0
    let updatedCount = 0
    let errorCount = 0
    let assignmentFailedCount = 0
    let maxDate = lastSyncedDate
    let maxId: number | null = null
    const syncedLeadIds: number[] = []
    const queueRetryResult = await processQueuedMySQLIncomingLeads(
      queueDeps,
      Math.min(BATCH_SIZE, 100)
    )

    // Process each lead with timeout check
    for (const mysqlLead of leads) {
      // Check execution time to avoid timeout
      if (Date.now() - startTime > MAX_EXECUTION_TIME) {
        console.log('Approaching timeout, stopping sync...')
        break
      }

      try {
        const leadRef = String(mysqlLead.id)
        const activityDate = getLeadLatestActivityDate(mysqlLead)
        if (activityDate > maxDate) maxDate = activityDate
        if (maxId === null || mysqlLead.id > maxId) {
          maxId = mysqlLead.id
        }

        const leadData =
          mapMySQLLeadToPrisma(mysqlLead, systemUser.id, lookups, bdMap) ??
          (await mapMySQLLeadToPrismaAsyncFallback(mysqlLead, systemUser.id, lookups, false)) ??
          mapMySQLLeadToPrismaWithoutOwner(mysqlLead, systemUser.id, lookups)
        const resolvedSubStatus = await resolveInboundSubStatus(mysqlLead.SubStatus)

        if (resolvedSubStatus !== null || leadData.subStatus != null) {
          leadData.subStatus = resolvedSubStatus
        }

        const existingLead = await prisma.lead.findUnique({
          where: { leadRef },
          select: {
            id: true,
            bdeName: true,
          },
        })

        if (existingLead) {
          const { updatedDate, ...leadDataWithoutOwner } = stripImportedLeadOwnership(leadData)
          await prisma.lead.update({
            where: { leadRef },
            data: {
              ...leadDataWithoutOwner,
              ...(updatedDate !== null && { updatedDate }),
            },
          })
          updatedCount++
          syncedLeadIds.push(mysqlLead.id)
          console.log(
            `[mysql-sync] leadRef=${leadRef} updated, assigned BD=${existingLead.bdeName ?? 'Unknown'}`
          )
        } else {
          const incomingLead = await queueMySQLIncomingLead(mysqlLead)
          const result = await processMySQLIncomingLead(incomingLead.id, queueDeps)
          if (result.status === 'processed' || result.status === 'already_processed') {
            syncedCount++
            syncedLeadIds.push(mysqlLead.id)
            console.log(
              `[mysql-sync] leadRef=${leadRef} synced, assigned BD=${result.assignedBdName ?? 'Unknown'}`
            )
          } else if (result.status === 'failed') {
            assignmentFailedCount++
            errorCount++
            console.log(`[mysql-sync] leadRef=${leadRef} failed assignment`)
          }
        }
      } catch (error) {
        errorCount++
        console.error(`Error processing lead ${mysqlLead.id}:`, error)
      }
    }

    // Sync lead remarks for processed leads
    if (syncedLeadIds.length > 0) {
      try {
        const remarks = await queryMySQL<MySQLRemarkRow>(
          `SELECT * FROM lead_remarks WHERE RefId IN (${syncedLeadIds.map(() => '?').join(',')}) ORDER BY UpdateDate`,
          syncedLeadIds
        )

        let remarksSynced = 0
        for (const remark of remarks) {
          try {
            const leadRef = String(remark.RefId)
            const lead = await prisma.lead.findUnique({
              where: { leadRef },
            })

            if (!lead) continue

            const cleanRemarks = remark.Remarks?.replace(/\x00/g, '') ?? null

            const existingRemark = await prisma.leadRemark.findFirst({
              where: {
                leadRef,
                updateDate: new Date(remark.UpdateDate),
                remarks: cleanRemarks,
              },
            })

            if (existingRemark) continue

            await prisma.leadRemark.create({
              data: {
                leadRef,
                remarks: cleanRemarks,
                updateBy: remark.UpdateBy ?? null,
                updateDate: new Date(remark.UpdateDate),
                ip: remark.IP ?? null,
                leadStatus: remark.LeadStatus ?? null,
              },
            })
            remarksSynced++
          } catch (error) {
            console.error(`Error syncing remark ${remark.id}:`, error)
          }
        }
      } catch (error) {
        console.error('Error syncing lead remarks:', error)
      }
    }

    // Update sync state
    await prisma.syncState.upsert({
      where: { sourceType: SYNC_SOURCE_TYPE },
      update: {
        lastSyncedDate: maxDate,
        lastSyncedId: maxId,
        recordsCount: {
          increment: syncedCount + updatedCount,
        },
        lastRunAt: new Date(),
      },
      create: {
        sourceType: SYNC_SOURCE_TYPE,
        lastSyncedDate: maxDate,
        lastSyncedId: maxId,
        recordsCount: syncedCount + updatedCount,
        lastRunAt: new Date(),
      },
    })

    const executionTime = Date.now() - startTime

    return successResponse({
      message:
        leads.length === 0 && queueRetryResult.processed === 0 && queueRetryResult.failed === 0
          ? 'No new leads to sync'
          : 'Sync completed successfully',
      lastSyncedDate: maxDate.toISOString(),
      lastSyncedId: maxId,
      processed: leads.length,
      synced: syncedCount,
      updated: updatedCount,
      errors: errorCount,
      assignmentFailed: assignmentFailedCount,
      queueRetryProcessed: queueRetryResult.processed,
      queueRetryFailed: queueRetryResult.failed,
      executionTimeMs: executionTime,
    })
  } catch (error) {
    console.error('Sync failed:', error)

    return errorResponse(
      error instanceof Error ? error.message : 'Failed to sync leads',
      500
    )
  }
}

/**
 * GET /api/sync/mysql-leads
 * Get sync status and last sync information
 */
export async function GET(request: NextRequest) {
  try {
    // Check for API key authentication
    const authHeader = request.headers.get('authorization')
    const expectedSecrets = [
      process.env.CRON_SECRET,
    ].filter(Boolean) as string[]

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorizedResponse('Missing or invalid Authorization header')
    }

    const token = authHeader.substring(7)
    if (!expectedSecrets.length || !expectedSecrets.includes(token)) {
      return unauthorizedResponse('Invalid API token')
    }

    const syncState = await prisma.syncState.findUnique({
      where: { sourceType: SYNC_SOURCE_TYPE },
    })

    if (!syncState) {
      return successResponse({
        message: 'Sync has not been run yet',
        lastSyncedDate: null,
        lastSyncedId: null,
        recordsCount: 0,
        lastRunAt: null,
      })
    }

    // Test MySQL connection
    const mysqlConnected = await testMySQLConnection()

    return successResponse({
      message: 'Sync status retrieved',
      lastSyncedDate: syncState.lastSyncedDate.toISOString(),
      lastSyncedId: syncState.lastSyncedId,
      recordsCount: syncState.recordsCount,
      lastRunAt: syncState.lastRunAt.toISOString(),
      mysqlConnected,
    })
  } catch (error) {
    console.error('Error getting sync status:', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to get sync status',
      500
    )
  }
}
