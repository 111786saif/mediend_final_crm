/**
 * One-time backfill: copy implantCost → actualImplantCost and
 * instrumentsCost → actualInstrumentCost for every existing PLRecord row.
 *
 * safe to re-run (only touches rows where the actual value is still 0).
 *
 * Usage:
 *   tsx scripts/backfill-actual-costs.ts --dry-run
 *   tsx scripts/backfill-actual-costs.ts
 */

import 'dotenv/config'
import { prisma } from '@/lib/prisma'

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  const start = Date.now()

  console.log(
    `\nBackfilling PLRecord actual costs (${DRY_RUN ? 'DRY RUN' : 'LIVE'})`
  )

  /* ── how many rows are still unpopulated? ── */
  const toUpdate = await prisma.pLRecord.findMany({
    where: { OR: [{ actualImplantCost: 0 }, { actualInstrumentCost: 0 }] },
    select: { id: true, implantCost: true, instrumentsCost: true },
  })

  if (toUpdate.length === 0) {
    console.log('No rows to back fill — already done.\n')
    return
  }

  console.log(`${toUpdate.length} row${toUpdate.length === 1 ? '' : 's'} to update\n`)

  let errors = 0
  const BATCH = 200

  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const batch = toUpdate.slice(i, i + BATCH)
    if (DRY_RUN) {
      batch.forEach((r) =>
        console.log(
          `[DRY] ${r.id}  actualImplant=${r.implantCost}  actualInstr=${r.instrumentsCost}`
        )
      )
      continue
    }
    const writes = await Promise.allSettled(
      batch.map((r) =>
        prisma.pLRecord.update({
          where: { id: r.id },
          data: {
            actualImplantCost: r.implantCost,
            actualInstrumentCost: r.instrumentsCost,
          },
        })
      )
    )
    writes.forEach((w, idx) => {
      if (w.status === 'rejected') {
        errors++
        console.error(`Failed to update ${batch[idx].id}:`, w.reason)
      }
    })
    console.log(`  batch ${Math.floor(i / BATCH) + 1} done (${batch.length} rows)`)
  }

  console.log(`\nDone in ${((Date.now() - start) / 1000).toFixed(1)}s  | errors: ${errors}\n`)
}

main()
  .then(() => prisma.$disconnect().then(() => process.exit(0)))
  .catch((err) => {
    console.error(err)
    prisma.$disconnect().then(() => process.exit(1))
  })