import 'dotenv/config'
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
import { syncStaffFromMySQL } from '@/lib/sync/mysql-staff-sync'
import { Prisma, UserRole } from '@/generated/prisma/client'

interface MySQLRemarkRow {
  id: number
  RefId: number
  Remarks: string
  UpdateBy: number | null
  UpdateDate: Date | string
  IP: string | null
  LeadStatus: number | null
}

const BATCH_SIZE = 5000
const SYNC_SOURCE_TYPE = 'mysql_leads'
const CREATE_CHUNK_SIZE = 2000
const UPDATE_CHUNK_SIZE = 100

/** Parse --from YYYY-MM-DD from argv; returns null if absent. */
function parseFromArg(): Date | null {
  const idx = process.argv.indexOf('--from')
  if (idx === -1 || idx + 1 >= process.argv.length) return null
  const d = new Date(process.argv[idx + 1] + 'T00:00:00Z')
  if (isNaN(d.getTime())) {
    console.error(`Invalid --from date: ${process.argv[idx + 1]}  (expected YYYY-MM-DD)`)
    process.exit(1)
  }
  return d
}

/**
 * Get or create sync state
 */
async function getSyncState() {
  let syncState = await prisma.syncState.findUnique({
    where: { sourceType: SYNC_SOURCE_TYPE },
  })

  if (!syncState) {
    // Initialize with a default date (e.g., 1 day ago if no state exists)
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

  return syncState
}

/**
 * Update sync state
 */
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
      recordsCount: {
        increment: recordsCount,
      },
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

/**
 * Batch fetch existing leads by leadRef with key fields for comparison
 */
async function fetchExistingLeads(
  leadRefs: string[]
): Promise<Map<string, { updatedDate: Date | null; patientName: string; status: string; pipelineStage: string; bdId: string }>> {
  if (leadRefs.length === 0) return new Map()

  // Prisma has a limit on the 'in' clause, so we need to chunk
  const CHUNK_SIZE = 1000
  const existingLeadsMap = new Map<string, { updatedDate: Date | null; patientName: string; status: string; pipelineStage: string; bdId: string }>()

  for (let i = 0; i < leadRefs.length; i += CHUNK_SIZE) {
    const chunk = leadRefs.slice(i, i + CHUNK_SIZE)
    const leads = await prisma.lead.findMany({
      where: { leadRef: { in: chunk } },
      select: {
        leadRef: true,
        updatedDate: true,
        patientName: true,
        status: true,
        pipelineStage: true,
        bdId: true,
      },
    })
    leads.forEach((lead) => {
      existingLeadsMap.set(lead.leadRef, {
        updatedDate: lead.updatedDate,
        patientName: lead.patientName,
        status: lead.status,
        pipelineStage: lead.pipelineStage,
        bdId: lead.bdId,
      })
    })
  }

  return existingLeadsMap
}

/**
 * Optimized sync lead remarks using batch operations
 */
async function syncLeadRemarks(leadIds: number[]) {
  if (leadIds.length === 0) return

  try {
    // Fetch all remarks in one query
    const remarks = await queryMySQL<MySQLRemarkRow>(
      `SELECT * FROM lead_remarks WHERE RefId IN (${leadIds.map(() => '?').join(',')}) ORDER BY UpdateDate`,
      leadIds
    )

    if (remarks.length === 0) {
      return
    }

    // Get all leadRefs that exist
    const leadRefs = leadIds.map((id) => String(id))
    const existingLeads = await fetchExistingLeads(leadRefs)
    const existingLeadRefsSet = existingLeads

    // Filter remarks to only those for existing leads
    const validRemarks = remarks.filter((remark) =>
      existingLeadRefsSet.has(String(remark.RefId))
    )

    if (validRemarks.length === 0) {
      return
    }

    // Batch fetch existing remarks to avoid duplicates
    // Create a set of existing remark keys (leadRef + updateDate + remarks)
    const existingRemarkKeys = new Set<string>()

    // Chunk the remarks check to avoid query size limits
    const CHUNK_SIZE = 500
    for (let i = 0; i < validRemarks.length; i += CHUNK_SIZE) {
      const chunk = validRemarks.slice(i, i + CHUNK_SIZE)
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

    // Prepare new remarks for batch insert
    const newRemarks = validRemarks
      .map((remark) => {
        const leadRef = String(remark.RefId)
        const updateDate = new Date(remark.UpdateDate)
        const cleanRemarks = remark.Remarks?.replace(/\x00/g, '') ?? null
        const key = `${leadRef}|${updateDate.toISOString()}|${cleanRemarks}`

        if (existingRemarkKeys.has(key)) {
          return null // Skip duplicate
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

    // Batch create new remarks
    if (newRemarks.length > 0) {
      // Prisma createMany has limitations, so we'll chunk it
      const REMARK_CHUNK_SIZE = 1000
      for (let i = 0; i < newRemarks.length; i += REMARK_CHUNK_SIZE) {
        const chunk = newRemarks.slice(i, i + REMARK_CHUNK_SIZE)
        await prisma.leadRemark.createMany({
          data: chunk,
          skipDuplicates: true,
        })
      }
      console.log(`✅ Synced ${newRemarks.length} lead remarks`)
    }
  } catch (error) {
    console.error('Error syncing lead remarks:', error)
  }
}

/**
 * Sync a single batch of leads. Returns the count of leads fetched (0 = done).
 * Uses id-based keyset pagination to guarantee forward progress.
 */
async function syncOneBatch(
  lastSyncedDate: Date,
  lastMaxId: number,
  systemUserId: string,
  totalSyncedSoFar: number,
  lookups: Awaited<ReturnType<typeof loadLookupMaps>>,
  bdMap: Map<string, { id: string }>,
  assignmentDateColumn: string | null
): Promise<{ fetched: number; maxDate: Date; maxId: number; synced: number; updated: number; errors: number }> {
  console.log(`\n📥 Fetching leads from MySQL (batch size: ${BATCH_SIZE})...`)
  const assignmentDateSelect = assignmentDateColumn ? `, \`${assignmentDateColumn}\` AS assignedDate` : ''
  const assignmentDateWhere = assignmentDateColumn ? ` OR (\`${assignmentDateColumn}\` IS NOT NULL AND \`${assignmentDateColumn}\` >= ?)` : ''

  // id > lastMaxId ensures we never re-fetch the same batch (prevents infinite loops).
  // Date conditions filter to new/modified leads; for full re-sync they match everything.
  const baseParams = assignmentDateColumn
    ? [lastMaxId, lastSyncedDate, lastSyncedDate, lastSyncedDate, lastSyncedDate, BATCH_SIZE]
    : [lastMaxId, lastSyncedDate, lastSyncedDate, lastSyncedDate, BATCH_SIZE]
  const leads = await queryMySQL<MySQLLeadRow>(
    `SELECT lead.*${assignmentDateSelect} FROM lead
     WHERE id > ?
       AND (
         (Lead_Date >= ? OR (Lead_Date IS NULL AND COALESCE(LeadEntryDate, create_date) >= ?))
         OR (update_date IS NOT NULL AND update_date >= ?)${assignmentDateWhere}
       )
     ORDER BY id ASC
     LIMIT ?`,
    baseParams
  )

  if (leads.length === 0) return { fetched: 0, maxDate: lastSyncedDate, maxId: lastMaxId, synced: 0, updated: 0, errors: 0 }

  console.log(`✅ Found ${leads.length} leads to sync`)
  const dateRange = {
    earliest:
      leads[0].Lead_Date != null ? new Date(leads[0].Lead_Date as string | Date).toISOString() : 'N/A',
    latest:
      leads[leads.length - 1].Lead_Date != null
        ? new Date(leads[leads.length - 1].Lead_Date as string | Date).toISOString()
        : 'N/A',
  }
  console.log(`   Date range: ${dateRange.earliest} to ${dateRange.latest}`)

  const leadRefs = leads.map((l) => String(l.id))
  const existingLeadsMap = await fetchExistingLeads(leadRefs)
  console.log(`   Existing: ${existingLeadsMap.size}, New: ${leads.length - existingLeadsMap.size}`)

  let syncedCount = 0
  let updatedCount = 0
  let errorCount = 0
  const syncedLeadIds: number[] = []
  const leadsToCreate: Record<string, unknown>[] = []
  const leadsToUpdate: Array<{ leadRef: string; data: Record<string, unknown> }> = []
  const leadDates: Date[] = []
  const leadIds: number[] = []
  const updateDates: Date[] = []

  for (const mysqlLead of leads) {
    try {
      const leadRef = String(mysqlLead.id)
      const leadDate = getLeadReceivedDate(mysqlLead)
      const assignmentDate = getLeadAssignmentDate(mysqlLead)
      leadDates.push(leadDate)
      leadIds.push(mysqlLead.id)
      if (mysqlLead.update_date) {
        const ud = new Date(mysqlLead.update_date)
        if (!isNaN(ud.getTime())) updateDates.push(ud)
      }
      if (assignmentDate) {
        updateDates.push(assignmentDate)
      }

      let leadData = mapMySQLLeadToPrisma(mysqlLead, systemUserId, lookups, bdMap)
      if (!leadData) {
        leadData = await mapMySQLLeadToPrismaAsyncFallback(mysqlLead, systemUserId, lookups)
      }
      if (!leadData?.bdId) {
        errorCount++
        continue
      }

      const { updatedDate, ...leadDataForPrisma } = leadData
      const existingLead = existingLeadsMap.get(leadRef)

      if (existingLead) {
        const hasChanged =
          existingLead.patientName !== leadDataForPrisma.patientName ||
          existingLead.status !== leadDataForPrisma.status ||
          existingLead.pipelineStage !== leadDataForPrisma.pipelineStage ||
          existingLead.bdId !== leadDataForPrisma.bdId ||
          (updatedDate && existingLead.updatedDate && updatedDate.getTime() !== existingLead.updatedDate.getTime()) ||
          (!existingLead.updatedDate && updatedDate)

        if (hasChanged) {
          leadsToUpdate.push({ leadRef, data: leadDataForPrisma })
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
      console.error(`Error processing lead ${mysqlLead.id}:`, error)
    }
  }

  // Cursor advances by max(id) — guaranteed unique and forward-progressing.
  // maxDate is computed for the final sync state record only.
  const maxId = Math.max(...leadIds)
  const maxLeadDate =
    leadDates.length > 0
      ? new Date(Math.max(...leadDates.map((d) => d.getTime())))
      : lastSyncedDate
  const maxDate = maxLeadDate > lastSyncedDate ? maxLeadDate : lastSyncedDate
  console.log(`   Cursor: id ${lastMaxId} → ${maxId}, Lead_Date max=${maxLeadDate.toISOString().slice(0,10)}`)

  // Batch create
  if (leadsToCreate.length > 0) {
    for (let i = 0; i < leadsToCreate.length; i += CREATE_CHUNK_SIZE) {
      const chunk = leadsToCreate.slice(i, i + CREATE_CHUNK_SIZE)
      await prisma.lead.createMany({
        data: chunk as Prisma.LeadCreateManyInput[],
        skipDuplicates: true,
      })
    }
    console.log(`   ✅ Created ${leadsToCreate.length} new leads`)
  }

  // Batch update
  if (leadsToUpdate.length > 0) {
    let updated = 0
    for (let i = 0; i < leadsToUpdate.length; i += UPDATE_CHUNK_SIZE) {
      const chunk = leadsToUpdate.slice(i, i + UPDATE_CHUNK_SIZE)
      try {
        await prisma.$transaction(
          chunk.map((item) => prisma.lead.update({ where: { leadRef: item.leadRef }, data: item.data }))
        )
        updated += chunk.length
      } catch {
        for (const item of chunk) {
          try {
            await prisma.lead.update({ where: { leadRef: item.leadRef }, data: item.data })
            updated++
          } catch (e) {
            console.error(`❌ Failed to update lead ${item.leadRef}:`, e)
          }
        }
      }
    }
    console.log(`   🔄 Updated ${updated} existing leads`)
  }

  // Remarks
  if (syncedLeadIds.length > 0) {
    await syncLeadRemarks(syncedLeadIds)
  }

  // Persist sync state
  await updateSyncState(maxDate, maxId, syncedCount + updatedCount)

  console.log(`   📊 Batch result: +${syncedCount} created, ${updatedCount} updated, ${errorCount} errors  (total so far: ${totalSyncedSoFar + syncedCount + updatedCount})`)

  return { fetched: leads.length, maxDate, maxId, synced: syncedCount, updated: updatedCount, errors: errorCount }
}

/**
 * Main sync function — loops through batches until all leads are synced.
 * Usage: bun run scripts/sync-mysql-leads.ts [--from YYYY-MM-DD]
 */
async function syncLeads() {
  const startTime = Date.now()
  const fromDate = parseFromArg()
  console.log(`\n${'='.repeat(60)}`)
  console.log(`[${new Date().toISOString()}] 🔄 Starting MySQL lead sync...`)
  if (fromDate) console.log(`   --from override: ${fromDate.toISOString().slice(0, 10)}`)
  console.log(`${'='.repeat(60)}`)

  try {
    console.log('📡 Testing MySQL connection...')
    const isConnected = await testMySQLConnection()
    if (!isConnected) throw new Error('Failed to connect to MySQL database')
    console.log('✅ MySQL connection established')

    // If --from is given, reset sync state to that date
    if (fromDate) {
      await prisma.syncState.upsert({
        where: { sourceType: SYNC_SOURCE_TYPE },
        update: { lastSyncedDate: fromDate, lastSyncedId: null, recordsCount: 0, lastRunAt: new Date() },
        create: { sourceType: SYNC_SOURCE_TYPE, lastSyncedDate: fromDate, lastSyncedId: null, recordsCount: 0, lastRunAt: new Date() },
      })
      console.log(`📅 Sync state reset to ${fromDate.toISOString().slice(0, 10)}`)
    }

    let systemUser = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } })
    if (!systemUser) systemUser = await prisma.user.findFirst()
    if (!systemUser) throw new Error('No users found in system. Cannot process leads.')

    console.log('📋 Loading MySQL lookup tables...')
    const lookups = await loadLookupMaps()
    console.log(
      `✅ Lookups loaded — sources: ${lookups.source.size}, campaigns: ${lookups.campaign.size}, ` +
        `treatments: ${lookups.treatment.size}, circles: ${lookups.circle.size}, statuses: ${lookups.status.size}`
    )

    // Sync staff first so BD numbers and team structure are available for lead mapping
    console.log('👥 Syncing staff from tblstaff (BDs, TLs, hierarchy)...')
    await syncStaffFromMySQL()

    console.log('📋 Loading BD users map...')
    const bdMap = await fetchBDUsersMap()
    console.log(`✅ BD map loaded — ${bdMap.size} entries`)
    const assignmentDateColumn = await getMySQLLeadAssignmentDateColumn()
    console.log(`📌 Assignment date column: ${assignmentDateColumn ?? 'not found'}`)

    let totalSynced = 0
    let totalUpdated = 0
    let totalErrors = 0
    let batchNum = 0

    const syncState = await getSyncState()
    const syncFromDate = syncState.lastSyncedDate
    let lastMaxId = 0 // always start from id 0 so we scan all matching leads

    // Loop: keep fetching batches until MySQL returns fewer than BATCH_SIZE rows
    while (true) {
      batchNum++
      console.log(`\n--- Batch ${batchNum} (date >= ${syncFromDate.toISOString().slice(0, 10)}, id > ${lastMaxId}) ---`)

      const result = await syncOneBatch(
        syncFromDate,
        lastMaxId,
        systemUser.id,
        totalSynced + totalUpdated,
        lookups,
        bdMap,
        assignmentDateColumn
      )
      totalSynced += result.synced
      totalUpdated += result.updated
      totalErrors += result.errors
      lastMaxId = result.maxId

      if (result.fetched < BATCH_SIZE) {
        console.log('\nAll batches processed.')
        break
      }
    }

    // Store final sync state: date = now so next incremental picks up from here
    await updateSyncState(new Date(), lastMaxId, 0)

    const seconds = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`\n${'='.repeat(60)}`)
    console.log(`✅ Sync completed in ${seconds}s  (${batchNum} batch(es))`)
    console.log(`   Created: ${totalSynced}  |  Updated: ${totalUpdated}  |  Errors: ${totalErrors}`)
    console.log(`${'='.repeat(60)}\n`)
  } catch (error) {
    console.error('Sync failed:', error)
    throw error
  } finally {
    await closeMySQLPool()
    await prisma.$disconnect()
  }
}

syncLeads()
  .then(() => { process.exit(0) })
  .catch((error) => {
    console.error('\n❌ Sync script failed:', error)
    process.exit(1)
  })
