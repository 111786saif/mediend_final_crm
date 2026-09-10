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
  getMySQLSourceLeadRef,
  type MySQLLeadRow,
} from '@/lib/sync/mysql-lead-mapper'
import { loadLookupMaps } from '@/lib/sync/mysql-lookup-cache'
import { fetchBDUsersMap } from '@/lib/sync/mysql-bd-map'
import { UserRole } from '@/generated/prisma/client'
import { errorResponse, successResponse } from '@/lib/api-utils'
import pLimit from 'p-limit'
import {
  processMySQLIncomingLead,
  processQueuedMySQLIncomingLeads,
  queueMySQLIncomingLead,
} from '@/lib/mysql-incoming-leads'
import { stripImportedLeadOwnership } from '@/lib/imported-lead-ingestion'

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
const CONCURRENCY_LIMIT = 15

/**
 * Daily sync endpoint for MySQL leads
 * 
 * This endpoint syncs leads from MySQL to PostgreSQL for today (in IST).
 * Can be called by cron jobs or scheduled tasks.
 * 
 * To secure this endpoint, you can:
 * 1. Add authentication via API key in headers
 * 2. Use Vercel Cron Jobs with secret verification
 * 3. Use environment variable check
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Optional: Verify API key or secret for security
    const authHeader = request.headers.get('authorization')
    const expectedSecrets = [
      process.env.CRON_SECRET,
    ].filter(Boolean) as string[]

    if (expectedSecrets.length > 0) {
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
      if (!token || !expectedSecrets.includes(token)) {
        return errorResponse('Unauthorized', 401)
      }
    }

    // Get current time in IST (UTC+5:30)
    // IST is 5 hours and 30 minutes ahead of UTC
    const now = new Date()
    const istOffsetMs = 5.5 * 60 * 60 * 1000 // 5.5 hours in milliseconds
    const istNow = new Date(now.getTime() + istOffsetMs)
    
    // Get IST date components (using UTC getters since we've already offset the time)
    const istYear = istNow.getUTCFullYear()
    const istMonth = istNow.getUTCMonth() // 0-11
    const istDay = istNow.getUTCDate()
    
    // Get today's date in IST (start of day)
    const todayIST = new Date(Date.UTC(istYear, istMonth, istDay, 0, 0, 0, 0))
    
    // Get yesterday's date in IST (for syncing yesterday to today)
    const yesterdayIST = new Date(Date.UTC(istYear, istMonth, istDay - 1, 0, 0, 0, 0))

    console.log(`🔄 Daily MySQL leads sync: Syncing from ${yesterdayIST.toISOString()} to ${todayIST.toISOString()}`)

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
      syncState = await prisma.syncState.create({
        data: {
          sourceType: SYNC_SOURCE_TYPE,
          lastSyncedDate: yesterdayIST,
          lastSyncedId: null,
          recordsCount: 0,
          lastRunAt: new Date(),
        },
      })
    }

    // Use yesterday as the starting point for daily sync
    const syncFromDate = syncState.lastSyncedDate < yesterdayIST ? yesterdayIST : syncState.lastSyncedDate

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

    const endOfRange = new Date(todayIST.getTime() + 24 * 60 * 60 * 1000)

    // Fetch leads with any activity (receive / assignment / update) in the date range.
    const leads = await queryMySQL<MySQLLeadRow>(
      `SELECT \`lead\`.* FROM \`lead\`
       WHERE (
         (COALESCE(LeadEntryDate, create_date) >= ? AND COALESCE(LeadEntryDate, create_date) < ?)
         OR (Lead_Date IS NOT NULL AND Lead_Date >= ? AND Lead_Date < ?)
         OR (update_date IS NOT NULL AND update_date >= ? AND update_date < ?)
       )
       ORDER BY COALESCE(LeadEntryDate, create_date, Lead_Date) ASC, id ASC
       LIMIT ?`,
      [syncFromDate, endOfRange, syncFromDate, endOfRange, syncFromDate, endOfRange, BATCH_SIZE]
    )

    console.log(`📥 MySQL query: Found ${leads.length} leads to sync`)

    // Pre-fetch existing leads
    const leadRefs = leads.map((l) => getMySQLSourceLeadRef(l))
    const existingLeadsMap = new Map<string, { updatedDate: Date | null; patientName: string; status: string; bdId: string; bdeName: string | null }>()
    
    const CHUNK_SIZE = 1000
    for (let i = 0; i < leadRefs.length; i += CHUNK_SIZE) {
      const chunk = leadRefs.slice(i, i + CHUNK_SIZE)
      const existingLeads = await prisma.lead.findMany({
        where: { leadRef: { in: chunk } },
        select: {
          leadRef: true,
          updatedDate: true,
          patientName: true,
          status: true,
          bdId: true,
          bdeName: true,
        },
      })
      existingLeads.forEach((lead) => {
        existingLeadsMap.set(lead.leadRef, {
          updatedDate: lead.updatedDate,
          patientName: lead.patientName,
          status: lead.status,
          bdId: lead.bdId,
          bdeName: lead.bdeName ?? null,
        })
      })
    }

    const lookups = await loadLookupMaps()
    const bdMap = await fetchBDUsersMap()
    const queueDeps = { systemUserId: systemUser.id, lookups, bdMap }

    let syncedCount = 0
    let updatedCount = 0
    let errorCount = 0
    let assignmentFailedCount = 0
    let bucketCount = 0
    const syncedLeadIds: number[] = []
    const syncedLeadRefsById = new Map<number, string>()
    const leadsToUpdate: Array<{ leadRef: string; data: any }> = []
    const leadDates: Date[] = []
    const leadIds: number[] = []
    const errorDetails: Array<{ leadId: number; error: string }> = []
    const queueRetryResult = await processQueuedMySQLIncomingLeads(
      queueDeps,
      Math.min(BATCH_SIZE, 100)
    )

    // Process leads in parallel with concurrency limit
    const limit = pLimit(CONCURRENCY_LIMIT)

    const processLead = async (mysqlLead: MySQLLeadRow) => {
      try {
        const leadRef = getMySQLSourceLeadRef(mysqlLead)
        syncedLeadRefsById.set(mysqlLead.id, leadRef)
        leadDates.push(getLeadLatestActivityDate(mysqlLead))
        leadIds.push(mysqlLead.id)

        const leadData =
          mapMySQLLeadToPrisma(mysqlLead, systemUser.id, lookups, bdMap) ??
          (await mapMySQLLeadToPrismaAsyncFallback(mysqlLead, systemUser.id, lookups, false)) ??
          mapMySQLLeadToPrismaWithoutOwner(mysqlLead, systemUser.id, lookups)
        const { updatedDate, ...leadDataForPrisma } = stripImportedLeadOwnership(leadData)
        const existingLead = existingLeadsMap.get(leadRef)

        if (existingLead) {
          const hasChanged =
            existingLead.patientName !== leadDataForPrisma.patientName ||
            existingLead.status !== leadDataForPrisma.status ||
            (updatedDate && existingLead.updatedDate && updatedDate.getTime() !== existingLead.updatedDate.getTime()) ||
            (!existingLead.updatedDate && updatedDate)

          if (hasChanged) {
            leadsToUpdate.push({
              leadRef,
              data: {
                ...leadDataForPrisma,
                ...(updatedDate !== null && { updatedDate }),
              },
            })
            updatedCount++
            syncedLeadIds.push(mysqlLead.id)
            console.log(
              `[mysql-sync:daily] leadRef=${leadRef} updated, assigned BD=${existingLead.bdeName ?? 'Unknown'}`
            )
          }
        } else {
          const incomingLead = await queueMySQLIncomingLead(mysqlLead)
          const result = await processMySQLIncomingLead(incomingLead.id, queueDeps)
          if (result.status === 'processed' || result.status === 'already_processed') {
            syncedCount++
            syncedLeadIds.push(mysqlLead.id)
            console.log(
              `[mysql-sync:daily] leadRef=${leadRef} synced, assigned BD=${result.assignedBdName ?? 'Unknown'}`
            )
          } else if (result.status === 'failed') {
            assignmentFailedCount++
            errorCount++
            errorDetails.push({ leadId: mysqlLead.id, error: result.error })
            console.log(`[mysql-sync:daily] leadRef=${leadRef} failed assignment`)
          } else if (result.status === 'bucketed') {
            bucketCount++
            console.log(`[mysql-sync:daily] leadRef=${leadRef} placed in assignment bucket`)
          }
        }
      } catch (error) {
        errorCount++
        const errorMsg = error instanceof Error ? error.message : String(error)
        errorDetails.push({ leadId: mysqlLead.id, error: errorMsg })
        console.error(`Error processing lead ${mysqlLead.id}:`, error)
      }
    }

    await Promise.allSettled(leads.map((lead) => limit(() => processLead(lead))))

    const maxDate = leadDates.length > 0 ? new Date(Math.max(...leadDates.map(d => d.getTime()))) : syncFromDate
    const maxId = leadIds.length > 0 ? Math.max(...leadIds) : null

    // Batch update existing leads
    if (leadsToUpdate.length > 0) {
      const UPDATE_CHUNK_SIZE = 25
      for (let i = 0; i < leadsToUpdate.length; i += UPDATE_CHUNK_SIZE) {
        const chunk = leadsToUpdate.slice(i, i + UPDATE_CHUNK_SIZE)
        try {
          await prisma.$transaction(
            chunk.map((item) =>
              prisma.lead.update({
                where: { leadRef: item.leadRef },
                data: item.data,
              })
            )
          )
        } catch (error) {
          for (const item of chunk) {
            try {
              await prisma.lead.update({
                where: { leadRef: item.leadRef },
                data: item.data,
              })
            } catch (individualError) {
              console.error(`Failed to update lead ${item.leadRef}:`, individualError)
            }
          }
        }
      }
    }

    // Sync lead remarks
    let remarksSynced = 0
    if (syncedLeadIds.length > 0) {
      try {
        const remarks = await queryMySQL<MySQLRemarkRow>(
          `SELECT * FROM lead_remarks WHERE RefId IN (${syncedLeadIds.map(() => '?').join(',')}) ORDER BY UpdateDate`,
          syncedLeadIds
        )

        const existingRemarkKeys = new Set<string>()
        const REMARK_CHUNK_SIZE = 500
        for (let i = 0; i < remarks.length; i += REMARK_CHUNK_SIZE) {
          const chunk = remarks.slice(i, i + REMARK_CHUNK_SIZE)
          const leadRefsChunk = [
            ...new Set(
              chunk
                .map((r) => syncedLeadRefsById.get(r.RefId))
                .filter((leadRef): leadRef is string => Boolean(leadRef))
            ),
          ]
          if (leadRefsChunk.length === 0) {
            continue
          }
          const existingRemarks = await prisma.leadRemark.findMany({
            where: {
              leadRef: { in: leadRefsChunk },
            },
            select: {
              leadRef: true,
              updateDate: true,
              remarks: true,
            },
          })
          existingRemarks.forEach((r) => {
            const key = `${r.leadRef}|${r.updateDate.toISOString()}|${r.remarks?.replace(/\x00/g, '') ?? null}`
            existingRemarkKeys.add(key)
          })
        }

        const newRemarks = remarks
          .map((remark) => {
            const leadRef = syncedLeadRefsById.get(remark.RefId)
            if (!leadRef) {
              return null
            }
            const updateDate = new Date(remark.UpdateDate)
            const cleanRemarks = remark.Remarks?.replace(/\x00/g, '') ?? null
            const key = `${leadRef}|${updateDate.toISOString()}|${cleanRemarks}`
            if (existingRemarkKeys.has(key)) {
              return null
            }
            return {
              leadRef,
              remarks: cleanRemarks,
              updateBy: remark.UpdateBy ?? null,
              updateDate,
              ip: remark.IP ?? null,
              leadStatus: remark.LeadStatus ?? null,
            }
          })
          .filter((r): r is NonNullable<typeof r> => r !== null)

        if (newRemarks.length > 0) {
          const REMARK_CREATE_CHUNK_SIZE = 1000
          for (let i = 0; i < newRemarks.length; i += REMARK_CREATE_CHUNK_SIZE) {
            const chunk = newRemarks.slice(i, i + REMARK_CREATE_CHUNK_SIZE)
            await prisma.leadRemark.createMany({
              data: chunk,
              skipDuplicates: true,
            })
          }
          remarksSynced = newRemarks.length
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
      fromDate: syncFromDate.toISOString(),
      toDate: todayIST.toISOString(),
      processed: leads.length,
      synced: syncedCount,
      updated: updatedCount,
      errors: errorCount,
      assignmentFailed: assignmentFailedCount,
      bucketed: bucketCount,
      queueRetryProcessed: queueRetryResult.processed,
      queueRetryFailed: queueRetryResult.failed,
      queueRetryBucketed: queueRetryResult.bucketed,
      remarksSynced,
      lastSyncedDate: maxDate.toISOString(),
      lastSyncedId: maxId,
      executionTimeMs: executionTime,
      errorDetails: errorDetails.slice(0, 10), // Limit to first 10 errors
      mysqlResponse: {
        leadsFetched: leads.length,
        sampleLeads: leads.length > 0 ? {
          first: {
            id: leads[0].id,
            Lead_Date: leads[0].Lead_Date,
            Patient_Name: leads[0].Patient_Name,
          },
          last: leads.length > 1 ? {
            id: leads[leads.length - 1].id,
            Lead_Date: leads[leads.length - 1].Lead_Date,
            Patient_Name: leads[leads.length - 1].Patient_Name,
          } : null,
        } : null,
      },
    })
  } catch (error) {
    console.error('Error in daily MySQL leads sync:', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to sync MySQL leads',
      500
    )
  }
}

// Also support GET for easier cron job setup
export async function GET(request: NextRequest) {
  return POST(request)
}
