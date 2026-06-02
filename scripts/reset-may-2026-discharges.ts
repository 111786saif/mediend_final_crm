/**
 * Script: Reset May 2026 discharges back to IPD_DONE
 *
 * Reverts leads whose discharge was initiated (marked or finalized) in May 2026,
 * returning them to IPD_DONE so Insurance can redo the discharge process.
 *
 * Usage:
 *   docker compose --profile tools run --rm reset-discharges -- --profile
 *   docker compose --profile tools run --rm reset-discharges -- --dry-run
 *   docker compose --profile tools run --rm reset-discharges
 */

import 'dotenv/config'
import { prisma } from '@/lib/prisma'

const MAY_START = new Date('2026-05-01T00:00:00.000Z')
const MAY_END = new Date('2026-06-01T00:00:00.000Z')
const DRY_RUN = process.argv.includes('--dry-run')
const PROFILE = process.argv.includes('--profile')

function leadRef(id: string) {
  return id.slice(0, 8)
}

async function main() {
  console.log('')
  console.log(DRY_RUN ? 'DRY RUN — no changes' : 'LIVE RUN — applying changes')
  console.log(`Window: ${MAY_START.toISOString().slice(0, 10)} → ${MAY_END.toISOString().slice(0, 10)}`)
  console.log('')

  if (PROFILE) {
    const leads = await prisma.lead.findMany({
      where: {
        dischargeSheet: {
          OR: [
            { finalizedAt: { gte: MAY_START, lt: MAY_END } },
            { markedAt: { gte: MAY_START, lt: MAY_END }, finalizedAt: null },
          ],
        },
      },
      select: {
        leadRef: true, patientName: true, caseStage: true, pipelineStage: true,
        dischargeSheet: { select: { isFinalized: true, markedAt: true, finalizedAt: true, plRecord: { select: { id: true } } } },
      },
      orderBy: { leadRef: 'asc' },
    })

    let fin = 0, mark = 0
    for (const p of leads) {
      const ds = p.dischargeSheet!
      if (ds.isFinalized) fin++; else mark++
      const tag = ds.isFinalized ? `FINALIZED ${ds.finalizedAt?.toISOString()?.slice(0, 10) ?? ''}` : `MARKED ${ds.markedAt?.toISOString()?.slice(0, 10) ?? ''}`
      console.log(`  ${p.leadRef}  ${(p.patientName ?? '').padEnd(20)}  ${p.caseStage}  ${p.pipelineStage}  ${tag}${ds.plRecord ? ' [PL]' : ''}`)
    }
    console.log(`\n  Finalized: ${fin}  |  Marked only: ${mark}  |  Total: ${leads.length}`)
    return
  }

  // ── Phase 1: Finalized sheets ──────────────────────────────────────────
  const finalizedRows = await prisma.dischargeSheet.findMany({
    where: { finalizedAt: { gte: MAY_START, lt: MAY_END } },
    select: { id: true, leadId: true, plRecordId: true, plRecord: { select: { id: true } }, lead: { select: { caseStage: true, leadRef: true } } },
  })

  // ── Phase 2: Marked-only sheets ────────────────────────────────────────
  const markedRows = await prisma.dischargeSheet.findMany({
    where: { markedAt: { gte: MAY_START, lt: MAY_END }, finalizedAt: null },
    select: { id: true, leadId: true, lead: { select: { caseStage: true, leadRef: true } } },
  })

  console.log(`Finalized: ${finalizedRows.length}  |  Marked-only: ${markedRows.length}`)
  console.log('')

  let countFinalized = 0, countMarked = 0

  for (const s of finalizedRows) {
    const ref = s.lead?.leadRef ?? s.leadId
    if (!s.lead || s.lead.caseStage === 'IPD_DONE') continue
    console.log(`${DRY_RUN ? '[DRY]' : '✅'} ${ref} (finalized) — ${leadRef(s.leadId)}`)
    if (!DRY_RUN) {
      // Delete PLRecord
      if (s.plRecordId || s.plRecord?.id) {
        await prisma.pLRecord.deleteMany({ where: { leadId: s.leadId } })
      }
      // Remove plRecordId and unfinalize the sheet
      await prisma.dischargeSheet.update({
        where: { id: s.id },
        data: { isFinalized: false, finalizedAt: null, finalizedById: null, plRecordId: null },
      })
      // Revert lead stage
      await prisma.lead.update({
        where: { id: s.leadId },
        data: { caseStage: 'IPD_DONE', pipelineStage: 'INSURANCE' },
      })
    }
    countFinalized++
  }

  for (const s of markedRows) {
    const ref = s.lead?.leadRef ?? s.leadId
    if (!s.lead || s.lead.caseStage !== 'DISCHARGED') continue
    console.log(`${DRY_RUN ? '[DRY]' : '✅'} ${ref} (marked) — ${leadRef(s.leadId)}`)
    if (!DRY_RUN) {
      await prisma.dischargeSheet.delete({ where: { id: s.id } })
      await prisma.lead.update({ where: { id: s.leadId }, data: { caseStage: 'IPD_DONE' } })
    }
    countMarked++
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  const totalIpd = await prisma.lead.count({
    where: { caseStage: { in: ['IPD_DONE', 'CASH_IPD_DONE'] }, dischargeSheet: null },
  })
  const mayIpd = await prisma.lead.count({
    where: {
      caseStage: { in: ['IPD_DONE', 'CASH_IPD_DONE'] }, dischargeSheet: null,
      caseStageHistory: { some: { toStage: { in: ['IPD_DONE', 'CASH_IPD_DONE'] }, changedAt: { gte: MAY_START, lt: MAY_END } } },
    },
  })

  console.log('')
  console.log('═══════════════════════════════════════════')
  console.log(`  Finalized reverted:    ${countFinalized}`)
  console.log(`  Marked-only reverted:  ${countMarked}`)
  console.log(`  Total reverted:        ${countFinalized + countMarked}`)
  console.log(`  Total IPD_DONE (no sheet):    ${totalIpd}`)
  console.log(`  May 2026 IPD_DONE (no sheet): ${mayIpd}`)
  console.log('═══════════════════════════════════════════')
  console.log('')
}

main()
  .catch((e) => { console.error('Fatal:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
