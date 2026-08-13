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
 *   bun run scripts/sync-leads-from-old-workspace.ts --commit --from 2026-08-08 --to 2026-08-13
 *   bun run scripts/sync-leads-from-old-workspace.ts --commit --lead-ref 118454,118500
 *
 * Docker (on prod server):
 *   docker compose --profile tools build sync-old-workspace-leads
 *   docker compose --profile tools run --rm sync-old-workspace-leads -- --dry-run
 *   docker compose --profile tools run --rm sync-old-workspace-leads -- --commit
 */

import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import {
  buildUserIdMap,
  copyLeadBundle,
  createSourcePrisma,
  findLeadRefsInRange,
  parseCliDates,
  parseLeadRefFilter,
  SourceSchemaGuard,
} from '@/lib/sync/old-workspace-sync'

const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run') || !argv.includes('--commit')

async function main() {
  const { from, toExclusive } = parseCliDates(argv)
  const leadRefFilter = parseLeadRefFilter(argv)

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Old workspace → new workspace lead sync`)
  console.log(`Range (IST): ${from.toISOString().slice(0, 10)} → ${new Date(toExclusive.getTime() - 1).toISOString().slice(0, 10)} inclusive`)
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (pass --commit to write)' : 'COMMIT'}`)
  console.log(`${'='.repeat(60)}\n`)

  const source = createSourcePrisma()

  try {
    await source.$queryRaw`SELECT 1`
    console.log('✅ Source DB connected')

    const sourceSchema = await SourceSchemaGuard.load(source)
    sourceSchema.logSummary()

    const { map: userMap, fallbackUserId } = await buildUserIdMap(source, prisma)
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
      for (const leadRef of leadRefs) {
        const exists = await prisma.lead.findUnique({ where: { leadRef }, select: { id: true } })
        if (exists) foundOnTarget++
        else missingOnTarget++
      }
      console.log(`\nDry-run summary:`)
      console.log(`   On target: ${foundOnTarget}`)
      console.log(`   Missing on target (will skip): ${missingOnTarget}`)
      console.log(`\nRe-run with --commit to overwrite ${foundOnTarget} lead(s).`)
      return
    }

    let synced = 0
    let skipped = 0
    let errors = 0

    for (let i = 0; i < leadRefs.length; i++) {
      const leadRef = leadRefs[i]
      try {
        const result = await copyLeadBundle(source, prisma, leadRef, userMap, fallbackUserId, sourceSchema)
        if (result === 'synced') synced++
        else skipped++
      } catch (e) {
        errors++
        console.error(`❌ leadRef ${leadRef}:`, e instanceof Error ? e.message : e)
      }

      if ((i + 1) % 25 === 0 || i + 1 === leadRefs.length) {
        console.log(`   Progress: ${i + 1}/${leadRefs.length} (synced=${synced}, skipped=${skipped}, errors=${errors})`)
      }
    }

    console.log(`\n✅ Done — synced=${synced}, skipped=${skipped}, errors=${errors}`)
  } finally {
    await source.$disconnect()
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('\n❌ Sync failed:', e)
  process.exit(1)
})
