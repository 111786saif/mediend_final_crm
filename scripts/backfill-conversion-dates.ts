/**
 * Backfill conversionDate for IPD Done leads that have no surgery/admission date.
 * Uses MySQL lead_remarks (MIN(UpdateDate) WHERE LeadStatus=13) as the true
 * "when IPD was marked done" timestamp, falling back to lead.update_date.
 *
 * Phase 1: Reset wrong conversionDates (from previous bad backfill) to assignedDate.
 * Phase 2: Query MySQL for true IPD-marked dates and update Postgres.
 *
 * Requires DATABASE_URL and MYSQL_SOURCE_URL in .env.
 * Usage: bun run scripts/backfill-conversion-dates.ts
 * Docker: docker compose --profile tools run --rm backfill-conversion-dates
 */

import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { queryMySQL, closeMySQLPool } from '@/lib/mysql-source-client'

interface MySQLRow {
  id: number
  Lead_Date: Date | string
  update_date: Date | string | null
  ipd_at: Date | string | null
}

function parseDate(val: Date | string | null | undefined): Date | null {
  if (!val) return null
  if (val instanceof Date) return val
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

async function backfillConversionDates() {
  const startTime = Date.now()
  console.log('\n' + '='.repeat(60))
  console.log('Backfilling conversionDate from MySQL lead_remarks for IPD Done leads')
  console.log('='.repeat(60))

  try {
    // Phase 1: Reset wrong conversionDates (from previous bad backfill) to assignedDate
    const resetCount = await prisma.$executeRaw`
      UPDATE "Lead"
      SET "conversionDate" = "assignedDate"
      WHERE "pipelineStage" = 'COMPLETED'
        AND "surgeryDate" IS NULL
        AND "ipdAdmissionDate" IS NULL
    `
    console.log(`\nPhase 1 (reset): Set conversionDate = assignedDate for ${resetCount} leads`)

    // Phase 2: Query MySQL for true IPD-marked dates
    const postgresLeads = await prisma.lead.findMany({
      where: {
        pipelineStage: 'COMPLETED',
        surgeryDate: null,
        ipdAdmissionDate: null,
      },
      select: { leadRef: true },
    })
    const postgresRefs = new Set(postgresLeads.map((l) => l.leadRef))

    const rows = await queryMySQL<MySQLRow>(`
      SELECT
        l.id,
        l.Lead_Date,
        l.update_date,
        MIN(lr.UpdateDate) AS ipd_at
      FROM lead l
      LEFT JOIN lead_remarks lr ON lr.RefId = l.id AND lr.LeadStatus = 13
      WHERE l.Status = 13
        AND l.Surgery_Date IS NULL
        AND l.IPD_AdmisisonDate IS NULL
      GROUP BY l.id, l.Lead_Date, l.update_date
    `)

    const updates: { leadRef: string; conversionDate: Date }[] = []
    for (const row of rows) {
      if (!postgresRefs.has(String(row.id))) continue
      const assignedDate = parseDate(row.Lead_Date)
      const bestDate = parseDate(row.ipd_at) ?? parseDate(row.update_date)
      if (!assignedDate) continue
      // Use bestDate only if it's after assignedDate (IPD marked in a later month)
      const conversionDate = bestDate && bestDate > assignedDate ? bestDate : assignedDate
      updates.push({ leadRef: String(row.id), conversionDate })
    }

    // Batch update Postgres (100 at a time)
    const BATCH = 100
    let updated = 0
    for (let i = 0; i < updates.length; i += BATCH) {
      const batch = updates.slice(i, i + BATCH)
      await prisma.$transaction(
        batch.map(({ leadRef, conversionDate }) =>
          prisma.lead.update({
            where: { leadRef },
            data: { conversionDate },
          })
        )
      )
      updated += batch.length
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`Phase 2 (fix): Updated conversionDate for ${updated} leads from MySQL lead_remarks in ${elapsed}s`)
    console.log('='.repeat(60) + '\n')
  } catch (error) {
    console.error('Backfill failed:', error)
    throw error
  } finally {
    await closeMySQLPool()
    await prisma.$disconnect()
  }
}

backfillConversionDates()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
