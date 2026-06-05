/**
 * Backfill pipelineStage → 'PL' and conversionDate → surgeryDate
 * for leads where BD marked IPD_DONE (caseStage is IPD_DONE/CASH_IPD_DONE)
 * but pipelineStage was never advanced by the old code path.
 *
 * Only touches leads where the caseStage CONFIRMS BD's IPD_DONE mark —
 * skips LOST, INSURANCE, SALES, and any other stage that doesn't
 * represent a completed surgery.
 *
 * Usage: bun run scripts/backfill-ipd-stage-and-conversion.ts
 * Docker: docker compose --profile tools run --rm backfill-ipd-stage
 *
 * DRY-RUN: set DRY_RUN=true to see what would change without writing.
 */

import 'dotenv/config'
import { prisma } from '@/lib/prisma'

async function backfill() {
  const dryRun = process.env.DRY_RUN === 'true'

  const leads = await prisma.lead.findMany({
    where: {
      caseStage: { in: ['IPD_DONE', 'CASH_IPD_DONE'] },
      surgeryDate: { not: null },
      pipelineStage: { notIn: ['PL', 'COMPLETED'] },
    },
    select: { id: true, leadRef: true, pipelineStage: true, caseStage: true, surgeryDate: true },
  })

  console.log(`Found ${leads.length} leads to backfill${dryRun ? ' (DRY RUN)' : ''}`)
  for (const l of leads) {
    console.log(`  ${l.leadRef}: stage=${l.pipelineStage} surgery=${l.surgeryDate?.toISOString().slice(0, 10)}`)
  }

  if (dryRun || leads.length === 0) {
    console.log('No changes made.')
    await prisma.$disconnect()
    process.exit(0)
  }

  // Also fix leads where pipelineStage is already PL/COMPLETED but conversionDate is null
  const missingConv = await prisma.lead.findMany({
    where: {
      pipelineStage: { in: ['PL', 'COMPLETED'] },
      conversionDate: null,
    },
      select: { id: true, leadRef: true, surgeryDate: true, createdDate: true },
  })

  console.log(`\nFound ${missingConv.length} leads with missing conversionDate`)

  let updated = 0
  for (const l of leads) {
    await prisma.lead.update({
      where: { id: l.id },
      data: {
        pipelineStage: 'PL',
        conversionDate: l.surgeryDate,
      },
    })
    updated++
  }
  console.log(`Updated pipelineStage → PL for ${updated} leads`)

  let convUpdated = 0
  for (const l of missingConv) {
    await prisma.lead.update({
      where: { id: l.id },
      data: {
        conversionDate: l.surgeryDate ?? l.createdDate,
      },
    })
    convUpdated++
  }
  console.log(`Updated conversionDate for ${convUpdated} leads`)

  await prisma.$disconnect()
  console.log('Done.')
}

backfill().catch((e) => {
  console.error(e)
  prisma.$disconnect().then(() => process.exit(1))
})
