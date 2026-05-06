import 'dotenv/config'
import { queryMySQL, closeMySQLPool, testMySQLConnection } from '@/lib/mysql-source-client'
import { prisma } from '@/lib/prisma'
import { mapMySQLLeadToPrisma, mapMySQLLeadToPrismaAsyncFallback, getLeadLatestActivityDate, type MySQLLeadRow } from '@/lib/sync/mysql-lead-mapper'
import { loadLookupMaps } from '@/lib/sync/mysql-lookup-cache'
import { fetchBDUsersMap } from '@/lib/sync/mysql-bd-map'
import { UserRole } from '@/generated/prisma/client'
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
const DEFAULT_FROM_DATE = '2025-12-01' // Sync from 1st December 2025 onwards

async function updateSyncState(
  lastSyncedDate: Date,
  lastSyncedId: number | null,
  recordsCount: number
) {
  await prisma.syncState.upsert({
    where: { sourceType: SYNC_SOURCE_TYPE },
    update: {
      lastSyncedDate,
      lastSyncedId,
      recordsCount: { increment: recordsCount },
      lastRunAt: new Date(),
    },
    create: {
      sourceType: SYNC_SOURCE_TYPE,
      lastSyncedDate,
      lastSyncedId,
      recordsCount,
      lastRunAt: new Date(),
    },
  })
}

async function fetchExistingLeads(
  leadRefs: string[]
): Promise<Map<string, { updatedDate: Date | null; patientName: string; status: string; bdId: string }>> {
  if (leadRefs.length === 0) return new Map()
  const CHUNK_SIZE = 1000
  const existingLeadsMap = new Map<string, { updatedDate: Date | null; patientName: string; status: string; bdId: string }>()
  for (let i = 0; i < leadRefs.length; i += CHUNK_SIZE) {
    const chunk = leadRefs.slice(i, i + CHUNK_SIZE)
    const leads = await prisma.lead.findMany({
      where: { leadRef: { in: chunk } },
      select: { leadRef: true, updatedDate: true, patientName: true, status: true, bdId: true },
    })
    leads.forEach((lead) => {
      existingLeadsMap.set(lead.leadRef, {
        updatedDate: lead.updatedDate,
        patientName: lead.patientName,
        status: lead.status,
        bdId: lead.bdId,
      })
    })
  }
  return existingLeadsMap
}

async function syncLeadRemarks(
  leadIds: number[],
  /** When true, assume all leadIds exist (e.g. just synced); skip existence check to save a query. */
  assumeExist = false
) {
  if (leadIds.length === 0) return
  try {
    const remarks = await queryMySQL<MySQLRemarkRow>(
      `SELECT * FROM lead_remarks WHERE RefId IN (${leadIds.map(() => '?').join(',')}) ORDER BY UpdateDate`,
      leadIds
    )
    if (remarks.length === 0) return
    const leadRefsSet = new Set(leadIds.map((id) => String(id)))
    const validRemarks = assumeExist
      ? remarks
      : remarks.filter((r) => leadRefsSet.has(String(r.RefId)))
    if (validRemarks.length === 0) return
    const existingRemarkKeys = new Set<string>()
    const REMARK_CHUNK = 500
    const refs = [...new Set(validRemarks.map((r) => String(r.RefId)))]
    for (let i = 0; i < refs.length; i += REMARK_CHUNK) {
      const chunk = refs.slice(i, i + REMARK_CHUNK)
      const existing = await prisma.leadRemark.findMany({
        where: { leadRef: { in: chunk } },
        select: { leadRef: true, updateDate: true, remarks: true },
      })
      existing.forEach((r) => existingRemarkKeys.add(`${r.leadRef}|${r.updateDate.toISOString()}|${r.remarks?.replace(/\x00/g, '') ?? null}`))
    }
    const newRemarks = validRemarks
      .map((r) => {
        const leadRef = String(r.RefId)
        const updateDate = new Date(r.UpdateDate)
        const cleanRemarks = r.Remarks?.replace(/\x00/g, '') ?? null
        if (existingRemarkKeys.has(`${leadRef}|${updateDate.toISOString()}|${cleanRemarks}`)) return null
        return {
          leadRef,
          remarks: cleanRemarks,
          updateBy: r.UpdateBy ?? null,
          updateDate,
          ip: r.IP ?? null,
          leadStatus: r.LeadStatus ?? null,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    if (newRemarks.length > 0) {
      for (let i = 0; i < newRemarks.length; i += 1000) {
        await prisma.leadRemark.createMany({
          data: newRemarks.slice(i, i + 1000),
          skipDuplicates: true,
        })
      }
    }
  } catch (error) {
    log('error', 'Error syncing lead remarks', { leadCount: leadIds.length, err: String(error) })
  }
}

function parseFromDate(arg: string | undefined): Date {
  const raw = arg || process.env.HISTORIC_SYNC_FROM_DATE || DEFAULT_FROM_DATE
  const d = new Date(raw)
  if (isNaN(d.getTime())) {
    console.warn(`[historic-sync] Invalid date "${raw}", using ${DEFAULT_FROM_DATE}`)
    return new Date(DEFAULT_FROM_DATE)
  }
  return d
}

function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
  const ts = new Date().toISOString()
  const prefix = `[${ts}] [historic-sync] [${level.toUpperCase()}]`
  const extra = meta ? ` ${JSON.stringify(meta)}` : ''
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(`${prefix} ${message}${extra}`)
}

async function runHistoricSync() {
  const fromDate = parseFromDate(process.argv[2])
  const startTime = Date.now()
  const sep = '='.repeat(64)

  log('info', `Historic MySQL lead sync starting (from ${fromDate.toISOString().slice(0, 10)} onwards)`)
  log('info', `Batch size: ${BATCH_SIZE}, concurrency: ${CONCURRENCY_LIMIT}`)
  console.log(sep)

  try {
    const isConnected = await testMySQLConnection()
    if (!isConnected) throw new Error('Failed to connect to MySQL database')
    log('info', 'MySQL connection established')

    let systemUser = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } })
    if (!systemUser) systemUser = await prisma.user.findFirst()
    if (!systemUser) throw new Error('No users found in system. Cannot process leads.')
    log('info', 'System user resolved for created/updated by fields')

    // Optional: get approximate total for progress logging (one extra query)
    let approximateTotal: number | null = null
    try {
      const countRows = await queryMySQL<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM lead 
         WHERE COALESCE(LeadEntryDate, create_date, Lead_Date) >= ?`,
        [fromDate]
      )
      if (countRows[0]?.cnt != null) approximateTotal = Number(countRows[0].cnt)
    } catch {
      // non-fatal
    }
    if (approximateTotal != null) {
      log('info', `Approximate leads to sync: ${approximateTotal.toLocaleString()}`)
    }

    log('info', 'Loading MySQL lookup tables...')
    const lookups = await loadLookupMaps()
    log('info', 'Loading BD users map...')
    const bdMap = await fetchBDUsersMap()
    log('info', `BD map loaded — ${bdMap.size} entries`)
    console.log(sep)

    let cursorDate: Date = fromDate
    let cursorId = 0
    let totalSynced = 0
    let totalUpdated = 0
    let totalErrors = 0
    let batchNumber = 0
    const limit = pLimit(CONCURRENCY_LIMIT)
    const errorLeadIds: number[] = [] // keep last 20 for logging

    while (true) {
      batchNumber++
      const batchStart = Date.now()

      const leads = await queryMySQL<MySQLLeadRow>(
        `SELECT * FROM lead 
         WHERE (COALESCE(LeadEntryDate, create_date, Lead_Date) > ? OR (COALESCE(LeadEntryDate, create_date, Lead_Date) = ? AND id > ?))
         ORDER BY COALESCE(LeadEntryDate, create_date, Lead_Date) ASC, id ASC 
         LIMIT ?`,
        [cursorDate, cursorDate, cursorId, BATCH_SIZE]
      )

      if (leads.length === 0) {
        log('info', 'No more leads; historic sync complete.')
        break
      }

      const leadRefs = leads.map((l) => String(l.id))
      const existingLeadsMap = await fetchExistingLeads(leadRefs)
      const leadsToCreate: any[] = []
      const leadsToUpdate: Array<{ leadRef: string; data: any }> = []
      const syncedLeadIds: number[] = []
      const leadDates: Date[] = []
      const leadIds: number[] = []
      let errorCount = 0

      const processLead = async (mysqlLead: MySQLLeadRow) => {
        try {
          const leadRef = String(mysqlLead.id)
          leadDates.push(getLeadLatestActivityDate(mysqlLead))
          leadIds.push(mysqlLead.id)
          let leadData = mapMySQLLeadToPrisma(mysqlLead, systemUser!.id, lookups, bdMap)
          if (!leadData) {
            leadData = await mapMySQLLeadToPrismaAsyncFallback(mysqlLead, systemUser!.id, lookups)
          }
          if (!leadData?.bdId) {
            errorCount++
            if (errorLeadIds.length < 20) errorLeadIds.push(mysqlLead.id)
            return
          }
          const { updatedDate, ...leadDataForPrisma } = leadData
          const existing = existingLeadsMap.get(leadRef)
          if (existing) {
            const hasChanged =
              existing.patientName !== leadDataForPrisma.patientName ||
              existing.status !== leadDataForPrisma.status ||
              existing.bdId !== leadDataForPrisma.bdId ||
              (updatedDate && existing.updatedDate && updatedDate.getTime() !== existing.updatedDate.getTime()) ||
              (!existing.updatedDate && updatedDate)
            if (hasChanged) {
              leadsToUpdate.push({ leadRef, data: leadDataForPrisma })
              syncedLeadIds.push(mysqlLead.id)
            }
          } else {
            leadsToCreate.push(leadDataForPrisma)
            syncedLeadIds.push(mysqlLead.id)
          }
        } catch (err) {
          errorCount++
          if (errorLeadIds.length < 20) errorLeadIds.push(mysqlLead.id)
          log('warn', `Lead ${mysqlLead.id} failed`, { err: err instanceof Error ? err.message : String(err) })
        }
      }

      await Promise.allSettled(leads.map((l) => limit(() => processLead(l))))

      const maxDate = leadDates.length > 0 ? new Date(Math.max(...leadDates.map((d) => d.getTime()))) : cursorDate
      const maxId = leadIds.length > 0 ? Math.max(...leadIds) : cursorId

      if (leadsToCreate.length > 0) {
        for (let i = 0; i < leadsToCreate.length; i += 1000) {
          await prisma.lead.createMany({
            data: leadsToCreate.slice(i, i + 1000),
            skipDuplicates: true,
          })
        }
      }
      if (leadsToUpdate.length > 0) {
        const UPDATE_CHUNK = 25
        for (let i = 0; i < leadsToUpdate.length; i += UPDATE_CHUNK) {
          const chunk = leadsToUpdate.slice(i, i + UPDATE_CHUNK)
          try {
            await prisma.$transaction(
              chunk.map((item) =>
                prisma.lead.update({ where: { leadRef: item.leadRef }, data: item.data })
              )
            )
          } catch {
            for (const item of chunk) {
              try {
                await prisma.lead.update({ where: { leadRef: item.leadRef }, data: item.data })
              } catch {}
            }
          }
        }
      }

      if (syncedLeadIds.length > 0) await syncLeadRemarks(syncedLeadIds, true)

      const batchCreated = leadsToCreate.length
      const batchUpdated = leadsToUpdate.length
      totalSynced += batchCreated
      totalUpdated += batchUpdated
      totalErrors += errorCount

      await updateSyncState(maxDate, maxId, batchCreated + batchUpdated)

      cursorDate = maxDate
      cursorId = maxId

      const batchMs = Date.now() - batchStart
      const processed = batchCreated + batchUpdated
      const rate = batchMs > 0 ? ((leads.length / batchMs) * 1000).toFixed(1) : '0'
      const progress =
        approximateTotal != null
          ? ` ${totalSynced + totalUpdated}/${approximateTotal.toLocaleString()}`
          : ''
      log('info', `Batch ${batchNumber}: ${leads.length} fetched, ${batchCreated} created, ${batchUpdated} updated, ${errorCount} errors, ${batchMs}ms, ${rate}/s${progress}`)

      if (leads.length < BATCH_SIZE) break
    }

    const elapsedSec = (Date.now() - startTime) / 1000
    const totalProcessed = totalSynced + totalUpdated
    const overallRate = elapsedSec > 0 ? (totalProcessed / elapsedSec).toFixed(1) : '0'
    console.log(sep)
    log('info', 'Historic sync completed successfully')
    log('info', `Total: ${totalSynced} created, ${totalUpdated} updated, ${totalErrors} errors, ${elapsedSec.toFixed(1)}s, ${overallRate} leads/s`)
    if (errorLeadIds.length > 0) {
      log('warn', `Sample lead IDs that had errors (max 20): ${errorLeadIds.join(', ')}`)
    }
    console.log(sep)
  } catch (error) {
    log('error', 'Historic sync failed', { err: error instanceof Error ? error.message : String(error) })
    throw error
  } finally {
    await closeMySQLPool()
    await prisma.$disconnect()
  }
}

runHistoricSync()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
