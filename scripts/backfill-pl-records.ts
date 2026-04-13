/**
 * Backfill PLRecord (and DischargeSheet) people/case/date/billing fields
 * for historical rows where they were never populated.
 *
 * Only fills fields that are currently null / empty-string / zero — never
 * overwrites values the PL team has manually entered on the detail page.
 *
 * Usage:
 *   tsx scripts/backfill-pl-records.ts --dry-run
 *   tsx scripts/backfill-pl-records.ts
 */

import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import {
  LEAD_HYDRATE_INCLUDE,
  buildDischargeSheetDefaults,
  buildPlRecordPayload,
} from '@/lib/pl/hydrate-pl-record'

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH_SIZE = 500

type Diff = Record<string, unknown>

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string' && v.trim() === '') return true
  if (typeof v === 'number' && v === 0) return true
  return false
}

/**
 * Build an update diff that only sets fields on the existing row that are
 * currently empty. Keys in `existing` that already have a value are skipped.
 */
function buildEmptyOnlyDiff(
  existing: Record<string, unknown>,
  candidate: Record<string, unknown>,
  skipKeys: string[] = []
): Diff {
  const diff: Diff = {}
  for (const [key, value] of Object.entries(candidate)) {
    if (skipKeys.includes(key)) continue
    if (value === undefined || value === null) continue
    if (!isEmpty(existing[key])) continue
    diff[key] = value
  }
  return diff
}

async function backfillPlRecords() {
  const startTime = Date.now()
  console.log('\n' + '='.repeat(60))
  console.log(`Backfilling PLRecord + DischargeSheet (${DRY_RUN ? 'DRY RUN' : 'LIVE'})`)
  console.log('='.repeat(60))

  let cursor: string | undefined
  let scanned = 0
  let plUpdated = 0
  let dsUpdated = 0
  let errors = 0

  while (true) {
    const batch = await prisma.pLRecord.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: 'asc' },
      include: {
        lead: {
          include: {
            ...LEAD_HYDRATE_INCLUDE,
            dischargeSheet: true,
          },
        },
      },
    })
    if (batch.length === 0) break
    cursor = batch[batch.length - 1].id

    for (const pl of batch) {
      scanned++
      try {
        const lead = pl.lead
        if (!lead) continue
        const ds = (lead as unknown as { dischargeSheet?: Record<string, unknown> | null }).dischargeSheet ?? null

        // 1. DischargeSheet backfill (if one exists)
        if (ds) {
          const dsDefaults = buildDischargeSheetDefaults(lead)
          const dsDiff = buildEmptyOnlyDiff(
            ds as Record<string, unknown>,
            dsDefaults as Record<string, unknown>
          )
          if (Object.keys(dsDiff).length > 0) {
            dsUpdated++
            if (DRY_RUN) {
              console.log(`[DS] ${lead.leadRef}`, dsDiff)
            } else {
              await prisma.dischargeSheet.update({
                where: { id: (ds as { id: string }).id },
                data: dsDiff,
              })
            }
          }
        }

        // 2. PLRecord backfill — compute the fully hydrated payload, then
        //    keep only fields the existing row is missing.
        const payload = buildPlRecordPayload({
          lead,
          dischargeSheet: ds as Record<string, unknown> | null,
          userId: pl.handledById ?? lead.createdById,
        })
        const plDiff = buildEmptyOnlyDiff(
          pl as unknown as Record<string, unknown>,
          payload as unknown as Record<string, unknown>,
          ['leadId', 'handledById']
        )
        if (Object.keys(plDiff).length > 0) {
          plUpdated++
          if (DRY_RUN) {
            console.log(`[PL] ${lead.leadRef}`, plDiff)
          } else {
            await prisma.pLRecord.update({
              where: { id: pl.id },
              data: plDiff,
            })
          }
        }
      } catch (err) {
        errors++
        console.error(`Error on PLRecord ${pl.id}:`, err)
      }
    }

    console.log(
      `  progress: scanned=${scanned} plUpdated=${plUpdated} dsUpdated=${dsUpdated} errors=${errors}`
    )
    if (batch.length < BATCH_SIZE) break
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n' + '-'.repeat(60))
  console.log(`Done in ${elapsed}s`)
  console.log(`  scanned:    ${scanned}`)
  console.log(`  PL updated: ${plUpdated}`)
  console.log(`  DS updated: ${dsUpdated}`)
  console.log(`  errors:     ${errors}`)
  console.log(DRY_RUN ? '(dry run — no writes performed)' : '(writes committed)')
  console.log('='.repeat(60) + '\n')
}

backfillPlRecords()
  .then(() => prisma.$disconnect().then(() => process.exit(0)))
  .catch((err) => {
    console.error(err)
    prisma.$disconnect().then(() => process.exit(1))
  })
