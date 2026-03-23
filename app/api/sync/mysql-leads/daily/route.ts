import { NextRequest } from 'next/server'
import {
  queryMySQL,
  closeMySQLPool,
  testMySQLConnection,
  getMySQLLeadAssignmentDateColumn,
} from '@/lib/mysql-source-client'
import { prisma } from '@/lib/prisma'
import {
  mapMySQLLeadToPrisma,
  mapMySQLLeadToPrismaAsyncFallback,
  getLeadReceivedDate,
  getLeadAssignmentDate,
  type MySQLLeadRow,
} from '@/lib/sync/mysql-lead-mapper'
import { loadLookupMaps } from '@/lib/sync/mysql-lookup-cache'
import { fetchBDUsersMap } from '@/lib/sync/mysql-bd-map'
import { UserRole } from '@/generated/prisma/client'
import { errorResponse, successResponse } from '@/lib/api-utils'
import pLimit from 'p-limit'

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
      process.env.SYNC_API_SECRET,
      process.env.LEADS_API_SECRET,
      process.env.MYSQL_SYNC_SECRET,
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
    const assignmentDateColumn = await getMySQLLeadAssignmentDateColumn()
    const assignmentDateSelect = assignmentDateColumn ? `, \`${assignmentDateColumn}\` AS assignedDate` : ''
    const assignmentDateWhere = assignmentDateColumn
      ? `OR (\`${assignmentDateColumn}\` IS NOT NULL AND \`${assignmentDateColumn}\` >= ? AND \`${assignmentDateColumn}\` < ?)`
      : ''
    const queryParams = assignmentDateColumn
      ? [syncFromDate, endOfRange, syncFromDate, endOfRange, syncFromDate, endOfRange, syncFromDate, endOfRange, BATCH_SIZE]
      : [syncFromDate, endOfRange, syncFromDate, endOfRange, syncFromDate, endOfRange, BATCH_SIZE]

    // Fetch leads from MySQL: new in date range, assignment changes, or updated in date range.
    const leads = await queryMySQL<MySQLLeadRow>(
      `SELECT lead.*${assignmentDateSelect} FROM lead
       WHERE (
         (Lead_Date >= ? AND Lead_Date < ?)
         OR (Lead_Date IS NULL AND COALESCE(LeadEntryDate, create_date) >= ? AND COALESCE(LeadEntryDate, create_date) < ?)
         OR (update_date IS NOT NULL AND update_date >= ? AND update_date < ?)
         ${assignmentDateWhere}
       )
       ORDER BY COALESCE(Lead_Date, LeadEntryDate, create_date) ASC, id ASC
       LIMIT ?`,
      queryParams
    )

    console.log(`📥 MySQL query: Found ${leads.length} leads to sync`)

    if (leads.length === 0) {
      await closeMySQLPool()
      return successResponse({
        fromDate: syncFromDate.toISOString(),
        toDate: todayIST.toISOString(),
        message: 'No new leads to sync',
        processed: 0,
        synced: 0,
        updated: 0,
        errors: 0,
        executionTimeMs: Date.now() - startTime,
      })
    }

    // Pre-fetch existing leads
    const leadRefs = leads.map((l) => String(l.id))
    const existingLeadsMap = new Map<string, { updatedDate: Date | null; patientName: string; status: string; bdId: string }>()
    
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
        },
      })
      existingLeads.forEach((lead) => {
        existingLeadsMap.set(lead.leadRef, {
          updatedDate: lead.updatedDate,
          patientName: lead.patientName,
          status: lead.status,
          bdId: lead.bdId,
        })
      })
    }

    const lookups = await loadLookupMaps()
    const bdMap = await fetchBDUsersMap()

    let syncedCount = 0
    let updatedCount = 0
    let errorCount = 0
    const syncedLeadIds: number[] = []
    const leadsToCreate: any[] = []
    const leadsToUpdate: Array<{ leadRef: string; data: any }> = []
    const leadDates: Date[] = []
    const leadIds: number[] = []
    const errorDetails: Array<{ leadId: number; error: string }> = []

    // Process leads in parallel with concurrency limit
    const limit = pLimit(CONCURRENCY_LIMIT)

    const processLead = async (mysqlLead: MySQLLeadRow) => {
      try {
        const leadRef = String(mysqlLead.id)
        const leadDate = getLeadReceivedDate(mysqlLead)
        const assignmentDate = getLeadAssignmentDate(mysqlLead)

        leadDates.push(assignmentDate ?? leadDate)
        leadIds.push(mysqlLead.id)

        let leadData = mapMySQLLeadToPrisma(mysqlLead, systemUser.id, lookups, bdMap)
        if (!leadData) {
          leadData = await mapMySQLLeadToPrismaAsyncFallback(mysqlLead, systemUser.id, lookups)
        }

        if (!leadData?.bdId) {
          errorDetails.push({ leadId: mysqlLead.id, error: 'No bdId assigned' })
          errorCount++
          return
        }

        const { updatedDate, ...leadDataForPrisma } = leadData
        const existingLead = existingLeadsMap.get(leadRef)

        if (existingLead) {
          const hasChanged =
            existingLead.patientName !== leadDataForPrisma.patientName ||
            existingLead.status !== leadDataForPrisma.status ||
            existingLead.bdId !== leadDataForPrisma.bdId ||
            (updatedDate && existingLead.updatedDate && updatedDate.getTime() !== existingLead.updatedDate.getTime()) ||
            (!existingLead.updatedDate && updatedDate)

          if (hasChanged) {
            leadsToUpdate.push({
              leadRef,
              data: leadDataForPrisma,
            })
            updatedCount++
            syncedLeadIds.push(mysqlLead.id)
          }
        } else {
          leadsToCreate.push(leadDataForPrisma)
          syncedCount++
          syncedLeadIds.push(mysqlLead.id)
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

    // Batch create new leads
    if (leadsToCreate.length > 0) {
      const CREATE_CHUNK_SIZE = 1000
      for (let i = 0; i < leadsToCreate.length; i += CREATE_CHUNK_SIZE) {
        const chunk = leadsToCreate.slice(i, i + CREATE_CHUNK_SIZE)
        await prisma.lead.createMany({
          data: chunk,
          skipDuplicates: true,
        })
      }
    }

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
          const leadRefsChunk = [...new Set(chunk.map((r) => String(r.RefId)))]
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
            const leadRef = String(remark.RefId)
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

    await closeMySQLPool()

    const executionTime = Date.now() - startTime

    return successResponse({
      fromDate: syncFromDate.toISOString(),
      toDate: todayIST.toISOString(),
      processed: leads.length,
      synced: syncedCount,
      updated: updatedCount,
      errors: errorCount,
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
    await closeMySQLPool().catch(() => {})
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
