/**
 * One-shot migration for the new IPD_DONE → Insurance handoff flow.
 *
 * Before this change, BDs could mark `admissionRecord.ipdStatus = 'IPD_DONE'`
 * but the lead's `caseStage` stayed at INITIATED. The new insurance dashboard
 * "Ready for Discharge" queue keys off `caseStage === IPD_DONE`, so those
 * historical cases would be invisible to Insurance.
 *
 * This script finds insurance-flow leads that:
 *   - have caseStage = INITIATED
 *   - have admissionRecord.ipdStatus = 'IPD_DONE'
 *   - do not yet have a discharge sheet
 *
 * ...and advances them to caseStage = IPD_DONE, writing a CaseStageHistory row.
 *
 * Run after deploying the code changes. Idempotent — safe to re-run.
 * Usage: npx tsx scripts/migrate-ipd-done-handoff.ts
 */

import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { CaseStage } from '@/generated/prisma/client'

async function migrateIpdDoneHandoff() {
  console.log('[ipd-done-handoff] Scanning candidates...')

  const candidates = await prisma.lead.findMany({
    where: {
      caseStage: CaseStage.INITIATED,
      flowType: { not: 'CASH' },
      admissionRecord: { ipdStatus: 'IPD_DONE' },
      dischargeSheet: null,
    },
    select: { id: true, leadRef: true, patientName: true, bdId: true },
  })

  console.log(`[ipd-done-handoff] Found ${candidates.length} leads to advance.`)

  if (candidates.length === 0) {
    console.log('[ipd-done-handoff] Nothing to do. Exiting.')
    return
  }

  let migrated = 0
  for (const lead of candidates) {
    // Attribute the stage change to the lead's own BD — they were the one who
    // marked IPD_DONE under the old flow; this just brings caseStage in sync.
    await prisma.$transaction([
      prisma.lead.update({
        where: { id: lead.id },
        data: { caseStage: CaseStage.IPD_DONE },
      }),
      prisma.caseStageHistory.create({
        data: {
          leadId: lead.id,
          fromStage: CaseStage.INITIATED,
          toStage: CaseStage.IPD_DONE,
          changedById: lead.bdId,
          note: 'Migration: BD previously marked Surgery Done; advancing case to Insurance discharge queue.',
        },
      }),
    ])
    migrated++
    console.log(`[ipd-done-handoff]   ${lead.leadRef} (${lead.patientName}) → IPD_DONE`)
  }

  console.log(`[ipd-done-handoff] Done. Migrated ${migrated} leads.`)
}

migrateIpdDoneHandoff()
  .catch((err) => {
    console.error('[ipd-done-handoff] FAILED:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
