/**
 * Revert the bad backfill that promoted 318 leads to pipelineStage = 'PL'
 * when their caseStage was NOT IPD_DONE/CASH_IPD_DONE.
 *
 * These leads had a surgeryDate (from MySQL sync) but BD never actually
 * marked them IPD_DONE — they were LOST, NEW_LEAD, INSURANCE-stage, etc.
 *
 * Only reverts leads where:
 *   pipelineStage = 'PL'
 *   AND caseStage NOT IN ('IPD_DONE', 'CASH_IPD_DONE')
 *
 * Restores them to their previous pipelineStage (from caseStageHistory or
 * defaults to 'SALES').
 *
 * Dry run: bun run scripts/revert-ipd-stage-backfill.ts --dry-run
 * Live:    bun run scripts/revert-ipd-stage-backfill.ts
 * Docker:  docker compose --profile tools run --rm revert-ipd-stage
 */

import 'dotenv/config'
import { prisma } from '@/lib/prisma'

async function revert() {
  const dryRun = process.argv.includes('--dry-run')

  const leads = await prisma.lead.findMany({
    where: {
      pipelineStage: 'PL',
      caseStage: { notIn: ['IPD_DONE', 'CASH_IPD_DONE'] },
    },
    select: {
      id: true,
      leadRef: true,
      pipelineStage: true,
      caseStage: true,
      surgeryDate: true,
      conversionDate: true,
    },
  })

  console.log(`Found ${leads.length} leads to revert${dryRun ? ' (DRY RUN)' : ''}`)
  for (const l of leads) {
    console.log(`  ${l.leadRef}: stage=${l.pipelineStage} caseStage=${l.caseStage} surgery=${l.surgeryDate?.toISOString().slice(0, 10)}`)
  }

  if (dryRun || leads.length === 0) {
    console.log('No changes made.')
    await prisma.$disconnect()
    process.exit(0)
  }

  let reverted = 0
  for (const l of leads) {
    await prisma.lead.update({
      where: { id: l.id },
      data: {
        pipelineStage: 'SALES',
        conversionDate: null,
      },
    })
    reverted++
  }

  console.log(`Reverted ${reverted} leads to pipelineStage=SALES`)
  await prisma.$disconnect()
  console.log('Done.')
}

revert().catch((e) => {
  console.error(e)
  prisma.$disconnect().then(() => process.exit(1))
})
