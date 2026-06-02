/**
 * Script: Reset May 2026 discharges back to IPD_DONE
 *
 * Reverts leads whose discharge was initiated (marked or finalized) in May 2026,
 * returning them to IPD_DONE so Insurance can redo the discharge process.
 *
 * What it reverts:
 *   - Finalized sheets: Deletes PLRecord, sets lead caseStage → IPD_DONE and pipelineStage → INSURANCE
 *   - Marked-only sheets: Deletes the minimal DischargeSheet, sets lead caseStage → IPD_DONE
 *
 * Usage:
 *   tsx scripts/reset-may-2026-discharges.ts --dry-run
 *   tsx scripts/reset-may-2026-discharges.ts
 *
 * Profile tools requirement:
 *   tsx scripts/reset-may-2026-discharges.ts --profile
 *   tsx scripts/reset-may-2026-discharges.ts --dry-run --profile
 */

import 'dotenv/config'
import { prisma } from '@/lib/prisma'

const MAY_START = new Date('2026-05-01T00:00:00.000Z')
const MAY_END = new Date('2026-06-01T00:00:00.000Z')
const DRY_RUN = process.argv.includes('--dry-run')
const PROFILE = process.argv.includes('--profile')

async function main() {
  console.log('')
  console.log(DRY_RUN ? '🧪 DRY RUN — no changes will be made' : '⚠️  LIVE RUN — changes WILL be applied')
  console.log(`   Window: ${MAY_START.toISOString()} → ${MAY_END.toISOString()}`)
  console.log('')

  if (PROFILE) {
    const profiles = await prisma.lead.findMany({
      where: {
        dischargeSheet: {
          OR: [
            { finalizedAt: { gte: MAY_START, lt: MAY_END } },
            { markedAt: { gte: MAY_START, lt: MAY_END }, finalizedAt: null },
          ],
        },
      },
      select: {
        id: true,
        leadRef: true,
        patientName: true,
        caseStage: true,
        pipelineStage: true,
        dischargeSheet: {
          select: {
            id: true,
            isFinalized: true,
            markedAt: true,
            finalizedAt: true,
            plRecord: { select: { id: true } },
          },
        },
      },
      orderBy: { leadRef: 'asc' },
    })

    console.log(`\n📊 PROFILE — Leads with discharge in May 2026 (${profiles.length}):`)
    console.log('')
    let finalized = 0
    let markedOnly = 0
    let alreadyIpdDone = 0
    for (const p of profiles) {
      const ds = p.dischargeSheet
      if (!ds) { alreadyIpdDone++; continue }
      if (ds.isFinalized) finalized++
      else markedOnly++

      const status = ds.isFinalized
        ? `FINALIZED (${ds.finalizedAt?.toISOString()?.slice(0, 10) ?? '?'})`
        : `MARKED   (${ds.markedAt?.toISOString()?.slice(0, 10) ?? '?'})`
      const pl = ds.plRecord ? ' [has PLRecord]' : ''
      console.log(`  ${p.leadRef}  ${(p.patientName ?? '').padEnd(20)}  stage=${p.caseStage}  pipe=${p.pipelineStage}  ${status}${pl}`)
    }
    console.log('')
    console.log(`  Finalized: ${finalized}  |  Marked only: ${markedOnly}  |  Already IPD_DONE (no sheet): ${alreadyIpdDone}`)
    console.log(`  Total: ${profiles.length}`)
    return
  }

  // ── Step 1: Find all finalized discharge sheets from May 2026 ──────────
  const finalizedSheets = await prisma.dischargeSheet.findMany({
    where: {
      finalizedAt: { gte: MAY_START, lt: MAY_END },
    },
    select: {
      id: true,
      leadId: true,
      plRecordId: true,
      plRecord: { select: { id: true } },
      lead: {
        select: {
          id: true,
          leadRef: true,
          patientName: true,
          caseStage: true,
          pipelineStage: true,
        },
      },
    },
  })

  // ── Step 2: Find all marked-only discharge sheets from May 2026 ────────
  const markedSheets = await prisma.dischargeSheet.findMany({
    where: {
      markedAt: { gte: MAY_START, lt: MAY_END },
      finalizedAt: null,
    },
    select: {
      id: true,
      leadId: true,
      lead: {
        select: {
          id: true,
          leadRef: true,
          patientName: true,
          caseStage: true,
          pipelineStage: true,
        },
      },
    },
  })

  console.log(`\n📊 Found ${finalizedSheets.length} finalized sheets in May 2026`)
  console.log(`📊 Found ${markedSheets.length} marked-only sheets in May 2026`)
  console.log('')

  let finalizedReverted = 0
  let markedReverted = 0

  // ── Revert finalized sheets ─────────────────────────────────────────────
  // Get any valid user ID for the caseStageHistory audit trail
  const anyUser = await prisma.user.findFirst({
    select: { id: true },
  })
  if (!anyUser && !DRY_RUN) {
    throw new Error('No users found in the database — cannot record stage history')
  }
  const changedById = anyUser?.id ?? '00000000-0000-0000-0000-000000000001'

  for (const sheet of finalizedSheets) {
    const ref = sheet.lead?.leadRef ?? sheet.leadId
    // Skip if already reverted (no sheet or already at IPD_DONE)
    if (!sheet.lead || sheet.lead.caseStage === 'IPD_DONE') continue

    console.log(`${DRY_RUN ? '[DRY]' : '✅'} ${ref} (finalized, stage=${sheet.lead.caseStage}) — revert ${sheet.leadId.slice(0, 8)}…`)

    if (!DRY_RUN) {
      await prisma.$transaction(async (tx) => {
        // Delete the PLRecord created during finalization
        if (sheet.plRecordId || sheet.plRecord?.id) {
          await tx.pLRecord.deleteMany({
            where: { leadId: sheet.leadId },
          })
        }

        // Revert the discharge sheet: clear finalized fields but keep the row
        await tx.dischargeSheet.update({
          where: { id: sheet.id },
          data: {
            isFinalized: false,
            finalizedAt: null,
            finalizedById: null,
            plRecordId: null,
          },
        })

        // Revert the lead
        await tx.lead.update({
          where: { id: sheet.leadId },
          data: {
            caseStage: 'IPD_DONE',
            pipelineStage: 'INSURANCE',
          },
        })

        // Record the reversion in case stage history
        await tx.caseStageHistory.create({
          data: {
            leadId: sheet.leadId,
            fromStage: 'DISCHARGED',
            toStage: 'IPD_DONE',
            changedById,
            note: 'May 2026 discharge reset — Insurance will redo',
          },
        })
      })
    }
    finalizedReverted++
  }

  // ── Revert marked-only sheets ───────────────────────────────────────────
  for (const sheet of markedSheets) {
    const ref = sheet.lead?.leadRef ?? sheet.leadId
    if (sheet.lead?.caseStage !== 'DISCHARGED') continue

    console.log(`${DRY_RUN ? '[DRY]' : '✅'} ${ref} (marked) — delete sheet for ${sheet.leadId.slice(0, 8)}…`)

    if (!DRY_RUN) {
      await prisma.$transaction(async (tx) => {
        // Delete the minimal sheet
        await tx.dischargeSheet.delete({
          where: { id: sheet.id },
        })

        // Revert the lead
        await tx.lead.update({
          where: { id: sheet.leadId },
          data: {
            caseStage: 'IPD_DONE',
          },
        })

        // Record the reversion
        await tx.caseStageHistory.create({
          data: {
            leadId: sheet.leadId,
            fromStage: 'DISCHARGED',
            toStage: 'IPD_DONE',
            changedById,
            note: 'May 2026 marked-discharged reset — Insurance will redo',
          },
        })
      })
    }
    markedReverted++
  }

  // ── Final counts ────────────────────────────────────────────────────────
  console.log('')
  console.log('═══════════════════════════════════════════')
  console.log(`  Finalized reverted:    ${finalizedReverted}`)
  console.log(`  Marked-only reverted:  ${markedReverted}`)
  console.log(`  Total reverted:        ${finalizedReverted + markedReverted}`)

  const totalIpdDone = await prisma.lead.count({
    where: {
      caseStage: { in: ['IPD_DONE', 'CASH_IPD_DONE'] },
      dischargeSheet: null,
    },
  })

  // Count IPD_DONE leads whose IPD was marked in May 2026
  const mayIpdDone = await prisma.lead.count({
    where: {
      caseStage: { in: ['IPD_DONE', 'CASH_IPD_DONE'] },
      dischargeSheet: null,
      caseStageHistory: {
        some: {
          toStage: { in: ['IPD_DONE', 'CASH_IPD_DONE'] },
          changedAt: { gte: MAY_START, lt: MAY_END },
        },
      },
    },
  })

  console.log(`  Total IPD_DONE (no sheet):    ${totalIpdDone}`)
  console.log(`  May 2026 IPD_DONE (no sheet): ${mayIpdDone}`)
  console.log('═══════════════════════════════════════════')
  console.log('')
}

main()
  .catch((e) => {
    console.error('Fatal:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
