/**
 * Delta sync from old mediend workspace Postgres → new workspace Postgres.
 *
 * Matches leads by leadRef (MySQL lead id). Old DB wins: target lead + all
 * related Sales/Insurance/compliance data is replaced for matched leads.
 *
 * Env:
 *   DATABASE_URL          — target (new workspace)
 *   SOURCE_DATABASE_URL   — source (old workspace at 93.127.195.235 or backup)
 *
 * Usage:
 *   bun run scripts/sync-leads-from-old-workspace.ts --dry-run
 *   bun run scripts/sync-leads-from-old-workspace.ts --from 2026-08-08 --to 2026-08-13
 *   bun run scripts/sync-leads-from-old-workspace.ts --commit --create-missing --from 2026-08-08 --to 2026-08-13
 *   bun run scripts/sync-leads-from-old-workspace.ts --commit --lead-only --concurrency 8
 *   bun run scripts/sync-leads-from-old-workspace.ts --commit --lead-ref 118454,118500
 *
 * Docker (on prod server):
 *   docker compose --profile tools build sync-old-workspace-leads
 *   docker compose --profile tools run --rm sync-old-workspace-leads -- --dry-run
 *   docker compose --profile tools run --rm sync-old-workspace-leads -- --commit
 */

import 'dotenv/config'
import pLimit from 'p-limit'
import { prisma } from '@/lib/prisma'
import {
  buildUserIdMap,
  copyLeadBundle,
  createSourcePrisma,
  findLeadRefsInRange,
  loadTreatmentMasterIds,
  parseCliDates,
  parseLeadRefFilter,
  SourceSchemaGuard,
} from '@/lib/sync/old-workspace-sync'

const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run') || !argv.includes('--commit')
const CREATE_MISSING = argv.includes('--create-missing')
const LEAD_ONLY = argv.includes('--lead-only')

function parseConcurrency(): number {
  const idx = argv.indexOf('--concurrency')
  if (idx === -1) return 6
  const n = Number.parseInt(argv[idx + 1] ?? '', 10)
  if (!Number.isFinite(n) || n < 1) return 6
  return Math.min(n, 16)
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

async function main() {
  const { from, toExclusive } = parseCliDates(argv)
  const leadRefFilter = parseLeadRefFilter(argv)
  const concurrency = parseConcurrency()

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Old workspace → new workspace lead sync`)
  console.log(`Range (IST): ${from.toISOString().slice(0, 10)} → ${new Date(toExclusive.getTime() - 1).toISOString().slice(0, 10)} inclusive`)
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (pass --commit to write)' : 'COMMIT'}`)
  console.log(`Create missing on target: ${CREATE_MISSING ? 'YES' : 'NO (pass --create-missing)'}`)
  console.log(`Lead fields only (skip child tables): ${LEAD_ONLY ? 'YES' : 'NO (pass --lead-only for speed)'}`)
  console.log(`Parallel workers: ${concurrency}`)
  console.log(`${'='.repeat(60)}\n`)

  const source = createSourcePrisma()

  try {
    await source.$queryRaw`SELECT 1`
    console.log('✅ Source DB connected')

    const sourceSchema = await SourceSchemaGuard.load(source)
    sourceSchema.logSummary()

    const [{ map: userMap, fallbackUserId }, treatmentMasterIds] = await Promise.all([
      buildUserIdMap(source, prisma),
      loadTreatmentMasterIds(prisma),
    ])
    console.log(`✅ User map: ${userMap.size} emails matched (fallback admin: ${fallbackUserId})`)

    const leadRefs = await findLeadRefsInRange(source, from, toExclusive, leadRefFilter, sourceSchema)
    console.log(`📋 Leads to sync: ${leadRefs.length}`)

    if (leadRefs.length === 0) {
      console.log('Nothing to do.')
      return
    }

    const preview = leadRefs.slice(0, 20)
    console.log(`   Sample leadRefs: ${preview.join(', ')}${leadRefs.length > 20 ? '…' : ''}`)

    if (DRY_RUN) {
      let foundOnTarget = 0
      let missingOnTarget = 0
      for (let i = 0; i < leadRefs.length; i += 500) {
        const chunk = leadRefs.slice(i, i + 500)
        const found = await prisma.lead.findMany({
          where: { leadRef: { in: chunk } },
          select: { leadRef: true },
        })
        foundOnTarget += found.length
        missingOnTarget += chunk.length - found.length
      }
      console.log(`\nDry-run summary:`)
      console.log(`   On target (will update): ${foundOnTarget}`)
      console.log(`   Missing on target: ${missingOnTarget}`)
      if (CREATE_MISSING) {
        console.log(`   Would create ${missingOnTarget} new lead(s) + update ${foundOnTarget}`)
      } else {
        console.log(`\nRe-run with --commit to overwrite ${foundOnTarget} lead(s).`)
        console.log(`   Add --create-missing to also insert the ${missingOnTarget} missing lead(s).`)
      }
      return
    }

    let synced = 0
    let created = 0
    let skipped = 0
    let errors = 0
    let completed = 0
    const startedAt = Date.now()
    const limit = pLimit(concurrency)
    const bundleOptions = {
      createMissing: CREATE_MISSING,
      leadOnly: LEAD_ONLY,
      treatmentMasterIds,
    }

    await Promise.all(
      leadRefs.map((leadRef) =>
        limit(async () => {
          try {
            const result = await copyLeadBundle(
              source,
              prisma,
              leadRef,
              userMap,
              fallbackUserId,
              sourceSchema,
              bundleOptions
            )
            if (result === 'synced') synced++
            else if (result === 'created') created++
            else skipped++
          } catch (e) {
            errors++
            console.error(`❌ leadRef ${leadRef}:`, e instanceof Error ? e.message : e)
          } finally {
            completed++
            if (completed % 25 === 0 || completed === leadRefs.length) {
              const elapsedSec = (Date.now() - startedAt) / 1000
              const rate = completed / Math.max(elapsedSec, 0.001)
              const remainingSec = (leadRefs.length - completed) / Math.max(rate, 0.001)
              console.log(
                `   Progress: ${completed}/${leadRefs.length} (synced=${synced}, created=${created}, skipped=${skipped}, errors=${errors}) ~${formatEta(remainingSec)} left`
              )
            }
          }
        })
      )
    )

    const totalSec = ((Date.now() - startedAt) / 1000).toFixed(0)
    console.log(`\n✅ Done in ${totalSec}s — synced=${synced}, created=${created}, skipped=${skipped}, errors=${errors}`)
  } finally {
    await source.$disconnect()
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('\n❌ Sync failed:', e)
  process.exit(1)
})
