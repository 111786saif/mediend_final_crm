/**
 * Export old-workspace lead snapshot + new-workspace comparison to Excel.
 *
 * Use this to audit sync quality: original data (old DB) vs current prod (new DB)
 * for leads with activity in a date range.
 *
 * Env:
 *   SOURCE_DATABASE_URL — old workspace Postgres (via SSH tunnel :5433)
 *   DATABASE_URL          — new workspace Postgres (:5432)
 *
 * Usage:
 *   bun scripts/export-old-workspace-lead-compare.ts --from 2026-08-08 --to 2026-08-14
 *   bun scripts/export-old-workspace-lead-compare.ts --from 2026-08-08 --to 2026-08-14 --out data/lead-compare.xlsx
 *
 * Docker (host network + tunnel):
 *   docker run --rm --network host \
 *     -e DATABASE_URL="postgresql://postgres:PASS@127.0.0.1:5432/mediend_crm" \
 *     -e SOURCE_DATABASE_URL="postgresql://postgres:PASS@127.0.0.1:5433/mediend_crm" \
 *     --entrypoint bun \
 *     mediendworkspace-sync-old-workspace-leads \
 *     scripts/export-old-workspace-lead-compare.ts --from 2026-08-08 --to 2026-08-14
 */

import 'dotenv/config'
import * as path from 'node:path'
import { prisma } from '@/lib/prisma'
import {
  fetchLeadCompareRows,
  writeLeadCompareWorkbook,
} from '@/lib/sync/export-lead-compare'
import {
  createSourcePrisma,
  findLeadRefsInRange,
  parseCliDates,
  parseLeadRefFilter,
  SourceSchemaGuard,
} from '@/lib/sync/old-workspace-sync'

const argv = process.argv.slice(2)

function resolveOutputPath(from: Date, toExclusive: Date): string {
  const fromArg = argv.indexOf('--out')
  if (fromArg >= 0 && argv[fromArg + 1]) {
    return path.resolve(argv[fromArg + 1])
  }
  const toInclusive = new Date(toExclusive.getTime() - 24 * 60 * 60 * 1000)
  const stamp = `${from.toISOString().slice(0, 10)}_to_${toInclusive.toISOString().slice(0, 10)}`
  return path.resolve(process.cwd(), `data/lead-compare-${stamp}.xlsx`)
}

async function main() {
  const { from, toExclusive } = parseCliDates(argv)
  const leadRefFilter = parseLeadRefFilter(argv)
  const outputPath = resolveOutputPath(from, toExclusive)

  console.log(`\n${'='.repeat(60)}`)
  console.log('Old vs New workspace lead comparison export')
  console.log(
    `Range (IST): ${from.toISOString().slice(0, 10)} → ${new Date(toExclusive.getTime() - 1).toISOString().slice(0, 10)} inclusive`
  )
  console.log(`${'='.repeat(60)}\n`)

  const source = createSourcePrisma()

  try {
    await source.$queryRaw`SELECT 1`
    console.log('✅ Source DB connected')
    await prisma.$queryRaw`SELECT 1`
    console.log('✅ Target DB connected')

    const sourceSchema = await SourceSchemaGuard.load(source)
    sourceSchema.logSummary()

    const leadRefs = await findLeadRefsInRange(source, from, toExclusive, leadRefFilter, sourceSchema)
    console.log(`📋 Leads in range: ${leadRefs.length}`)
    if (leadRefs.length === 0) {
      console.log('Nothing to export.')
      return
    }

    console.log('⏳ Fetching old workspace rows…')
    const oldRows = await fetchLeadCompareRows(source, leadRefs)
    console.log(`   Old rows: ${oldRows.size}`)

    console.log('⏳ Fetching new workspace rows…')
    const newRows = await fetchLeadCompareRows(prisma, leadRefs)
    console.log(`   New rows: ${newRows.size}`)

    writeLeadCompareWorkbook(outputPath, leadRefs, oldRows, newRows)

    const missingOnNew = leadRefs.filter((ref) => oldRows.has(ref) && !newRows.has(ref)).length
    const statusMismatch = leadRefs.filter((ref) => {
      const o = oldRows.get(ref)
      const n = newRows.get(ref)
      return o && n && o.status !== n.status
    }).length

    console.log(`\n✅ Wrote ${outputPath}`)
    console.log(`   Missing on new server: ${missingOnNew}`)
    console.log(`   Status mismatches (old vs new): ${statusMismatch}`)
    console.log('\nSheets:')
    console.log('   1. Old Workspace (Original) — source of truth from old DB')
    console.log('   2. New Workspace (Current) — what is on prod now')
    console.log('   3. Comparison — side-by-side match flags')
    console.log('   4. Summary — counts')
  } finally {
    await source.$disconnect()
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('\n❌ Export failed:', e)
  process.exit(1)
})
