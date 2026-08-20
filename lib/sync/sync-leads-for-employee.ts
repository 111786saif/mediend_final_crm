import { prisma } from '@/lib/prisma'
import { queryMySQL, testMySQLConnection } from '@/lib/mysql-source-client'
import {
  getLeadLatestActivityDate,
  getMySQLSourceLeadRef,
  mapMySQLLeadToPrisma,
  mapMySQLLeadToPrismaAsyncFallback,
  type MySQLLeadRow,
} from '@/lib/sync/mysql-lead-mapper'
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

export interface LeadSyncProgress {
  employeeId: string
  employeeName: string
  bdNumber: number
  status: 'pending' | 'syncing' | 'done' | 'error'
  created: number
  updated: number
  errors: number
  message?: string
}

const BATCH_SIZE = 2500
const CONCURRENCY_LIMIT = 15

async function fetchExistingLeads(
  leadRefs: string[]
): Promise<Map<string, { updatedDate: Date | null; patientName: string; status: string; bdId: string }>> {
  if (leadRefs.length === 0) return new Map()
  const existingLeadsMap = new Map<string, { updatedDate: Date | null; patientName: string; status: string; bdId: string }>()
  for (let i = 0; i < leadRefs.length; i += 1000) {
    const chunk = leadRefs.slice(i, i + 1000)
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

async function syncLeadRemarks(leadIds: number[], leadRefsById: Map<number, string>) {
  if (leadIds.length === 0) return
  try {
    const remarks = await queryMySQL<MySQLRemarkRow>(
      `SELECT * FROM lead_remarks WHERE RefId IN (${leadIds.map(() => '?').join(',')}) ORDER BY UpdateDate`,
      leadIds
    )
    if (remarks.length === 0) return
    const validRemarks = remarks.filter((r) => leadRefsById.has(r.RefId))
    if (validRemarks.length === 0) return
    const existingRemarkKeys = new Set<string>()
    const refs = [
      ...new Set(
        validRemarks
          .map((r) => leadRefsById.get(r.RefId))
          .filter((leadRef): leadRef is string => Boolean(leadRef))
      ),
    ]
    for (let i = 0; i < refs.length; i += 500) {
      const chunk = refs.slice(i, i + 500)
      const existing = await prisma.leadRemark.findMany({
        where: { leadRef: { in: chunk } },
        select: { leadRef: true, updateDate: true, remarks: true },
      })
      existing.forEach((r) => existingRemarkKeys.add(`${r.leadRef}|${r.updateDate.toISOString()}|${r.remarks?.replace(/\x00/g, '') ?? null}`))
    }
    const newRemarks = validRemarks
      .map((r) => {
        const leadRef = leadRefsById.get(r.RefId)
        if (!leadRef) return null
        const updateDate = new Date(r.UpdateDate)
        const cleanRemarks = r.Remarks?.replace(/\x00/g, '') ?? null
        if (existingRemarkKeys.has(`${leadRef}|${updateDate.toISOString()}|${cleanRemarks}`)) return null
        return { leadRef, remarks: cleanRemarks, updateBy: r.UpdateBy ?? null, updateDate, ip: r.IP ?? null, leadStatus: r.LeadStatus ?? null }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    if (newRemarks.length > 0) {
      for (let i = 0; i < newRemarks.length; i += 1000) {
        await prisma.leadRemark.createMany({ data: newRemarks.slice(i, i + 1000), skipDuplicates: true })
      }
    }
  } catch (error) {
    console.error('[lead-sync] Error syncing remarks', error)
  }
}

/**
 * Sync leads from MySQL for a specific employee (by bdNumber).
 * fromDate defaults to 2025-01-01.
 */
export async function syncLeadsForEmployee(
  employeeId: string,
  employeeName: string,
  bdNumber: number,
  fromDateStr = '2025-01-01',
  onProgress?: (progress: LeadSyncProgress) => void
): Promise<LeadSyncProgress> {
  const progress: LeadSyncProgress = {
    employeeId,
    employeeName,
    bdNumber,
    status: 'syncing',
    created: 0,
    updated: 0,
    errors: 0,
  }
  onProgress?.(progress)

  try {
    const isConnected = await testMySQLConnection()
    if (!isConnected) throw new Error('Failed to connect to MySQL')

    let systemUser = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } })
    if (!systemUser) systemUser = await prisma.user.findFirst()
    if (!systemUser) throw new Error('No users found in system')

    const lookups = await loadLookupMaps()
    const bdMap = await fetchBDUsersMap()

    const fromDate = new Date(fromDateStr)
    let cursorDate = fromDate
    let cursorId = 0
    const limit = pLimit(CONCURRENCY_LIMIT)

    while (true) {
      const leads = await queryMySQL<MySQLLeadRow>(
        `SELECT * FROM \`lead\`
         WHERE BDM = ?
         AND (COALESCE(LeadEntryDate, create_date, Lead_Date) > ? OR (COALESCE(LeadEntryDate, create_date, Lead_Date) = ? AND id > ?))
         ORDER BY COALESCE(LeadEntryDate, create_date, Lead_Date) ASC, id ASC
         LIMIT ?`,
        [bdNumber, cursorDate, cursorDate, cursorId, BATCH_SIZE]
      )

      if (leads.length === 0) break

      const leadRefs = leads.map((l) => getMySQLSourceLeadRef(l))
      const existingLeadsMap = await fetchExistingLeads(leadRefs)
      const leadsToCreate: any[] = []
      const leadsToUpdate: Array<{ leadRef: string; data: any }> = []
      const syncedLeadIds: number[] = []
      const syncedLeadRefsById = new Map<number, string>()
      const leadDates: Date[] = []
      const leadIds: number[] = []

      const processLead = async (mysqlLead: MySQLLeadRow) => {
        try {
          const leadRef = getMySQLSourceLeadRef(mysqlLead)
          syncedLeadRefsById.set(mysqlLead.id, leadRef)
          leadDates.push(getLeadLatestActivityDate(mysqlLead))
          leadIds.push(mysqlLead.id)
          let leadData = mapMySQLLeadToPrisma(mysqlLead, systemUser!.id, lookups, bdMap)
          if (!leadData) leadData = await mapMySQLLeadToPrismaAsyncFallback(mysqlLead, systemUser!.id, lookups)
          if (!leadData?.bdId) {
            progress.errors++
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
        } catch {
          progress.errors++
        }
      }

      await Promise.allSettled(leads.map((l) => limit(() => processLead(l))))

      const maxDate = leadDates.length > 0 ? new Date(Math.max(...leadDates.map((d) => d.getTime()))) : cursorDate
      const maxId = leadIds.length > 0 ? Math.max(...leadIds) : cursorId

      if (leadsToCreate.length > 0) {
        for (let i = 0; i < leadsToCreate.length; i += 1000) {
          await prisma.lead.createMany({ data: leadsToCreate.slice(i, i + 1000), skipDuplicates: true })
        }
      }
      if (leadsToUpdate.length > 0) {
        for (let i = 0; i < leadsToUpdate.length; i += 25) {
          const chunk = leadsToUpdate.slice(i, i + 25)
          try {
            await prisma.$transaction(chunk.map((item) => prisma.lead.update({ where: { leadRef: item.leadRef }, data: item.data })))
          } catch {
            for (const item of chunk) {
              try { await prisma.lead.update({ where: { leadRef: item.leadRef }, data: item.data }) } catch {}
            }
          }
        }
      }

      if (syncedLeadIds.length > 0) await syncLeadRemarks(syncedLeadIds, syncedLeadRefsById)

      progress.created += leadsToCreate.length
      progress.updated += leadsToUpdate.length
      onProgress?.(progress)

      cursorDate = maxDate
      cursorId = maxId

      if (leads.length < BATCH_SIZE) break
    }

    progress.status = 'done'
    progress.message = `Synced ${progress.created} created, ${progress.updated} updated`
    onProgress?.(progress)
    return progress
  } catch (error) {
    progress.status = 'error'
    progress.message = error instanceof Error ? error.message : 'Unknown error'
    onProgress?.(progress)
    return progress
  }
}
