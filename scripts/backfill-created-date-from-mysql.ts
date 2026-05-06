/**
 * One-shot backfill: align Postgres Lead.createdDate with MySQL `create_date`
 * (with LeadEntryDate fallback). Required after migration
 * 20260506120000_rename_lead_date_to_assigned_date — historic rows had
 * createdDate populated from MySQL Lead_Date (the assign date) which was the
 * mapper's old, incorrect behaviour.
 *
 * Usage: bun run scripts/backfill-created-date-from-mysql.ts
 * Docker: docker compose --profile tools run --rm backfill-created-date
 */

import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { queryMySQL, closeMySQLPool } from '@/lib/mysql-source-client'

interface MySQLRow {
  id: number
  create_date: Date | string | null
  LeadEntryDate: Date | string | null
}

const CHUNK_SIZE = 5000
const PG_BATCH = 100

function parseDate(val: Date | string | null | undefined): Date | null {
  if (!val) return null
  if (val instanceof Date) return val
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

async function backfill() {
  const startTime = Date.now()
  console.log('\n' + '='.repeat(60))
  console.log('Backfilling Lead.createdDate from MySQL create_date / LeadEntryDate')
  console.log('='.repeat(60))

  let cursorId = 0
  let totalUpdated = 0
  let totalScanned = 0

  try {
    while (true) {
      const rows = await queryMySQL<MySQLRow>(
        `SELECT id, create_date, LeadEntryDate
         FROM lead
         WHERE id > ?
         ORDER BY id ASC
         LIMIT ?`,
        [cursorId, CHUNK_SIZE]
      )
      if (rows.length === 0) break

      const updates: { leadRef: string; createdDate: Date }[] = []
      for (const row of rows) {
        const target = parseDate(row.create_date) ?? parseDate(row.LeadEntryDate)
        if (!target) continue
        updates.push({ leadRef: String(row.id), createdDate: target })
      }
      totalScanned += rows.length
      cursorId = rows[rows.length - 1].id

      // Only update rows that actually exist in PG and whose createdDate differs.
      const refs = updates.map((u) => u.leadRef)
      const existing = await prisma.lead.findMany({
        where: { leadRef: { in: refs } },
        select: { leadRef: true, createdDate: true },
      })
      const existingMap = new Map(existing.map((e) => [e.leadRef, e.createdDate]))
      const toUpdate = updates.filter((u) => {
        const cur = existingMap.get(u.leadRef)
        return cur != null && cur.getTime() !== u.createdDate.getTime()
      })

      for (let i = 0; i < toUpdate.length; i += PG_BATCH) {
        const batch = toUpdate.slice(i, i + PG_BATCH)
        await prisma.$transaction(
          batch.map(({ leadRef, createdDate }) =>
            prisma.lead.update({
              where: { leadRef },
              data: { createdDate },
            })
          )
        )
        totalUpdated += batch.length
      }

      console.log(
        `  scanned=${totalScanned.toLocaleString()} updated=${totalUpdated.toLocaleString()} cursorId=${cursorId}`
      )
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`\nDone — updated ${totalUpdated.toLocaleString()} of ${totalScanned.toLocaleString()} scanned in ${elapsed}s`)
    console.log('='.repeat(60) + '\n')
  } catch (err) {
    console.error('Backfill failed:', err)
    throw err
  } finally {
    await closeMySQLPool()
    await prisma.$disconnect()
  }
}

backfill()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
