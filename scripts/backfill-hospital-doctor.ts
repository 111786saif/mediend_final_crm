/**
 * Backfill lead.hospitalName (and lead.ipdDrName) from the pre-auth-approved
 * hospital for historical leads. After approval the chosen hospital lives in
 * PreAuthorization.requestedHospitalName, and the doctor is the suggestedDoctor
 * on the matching HospitalSuggestion row — but older leads never had these
 * written back onto the lead. This makes every dashboard show the approved
 * hospital + doctor consistently.
 *
 * Only fills/corrects:
 *   - lead.hospitalName  → the approved hospital (always, when it differs)
 *   - lead.ipdDrName     → matched suggestedDoctor (only when currently empty)
 *
 * Scope: insurance-flow leads at PREAUTH_COMPLETE or beyond that have a
 * requestedHospitalName. Never touches cash-flow leads.
 *
 * Usage:
 *   tsx scripts/backfill-hospital-doctor.ts --dry-run
 *   tsx scripts/backfill-hospital-doctor.ts
 */

import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { CaseStage } from '@/generated/prisma/client'

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH_SIZE = 500

// "PREAUTH_COMPLETE or beyond" — the stages where the hospital/doctor are locked.
const APPROVED_STAGES: CaseStage[] = [
  CaseStage.PREAUTH_COMPLETE,
  CaseStage.INITIATED,
  CaseStage.ADMITTED,
  CaseStage.IPD_DONE,
  CaseStage.DISCHARGED,
  CaseStage.PL_PENDING,
  CaseStage.OUTSTANDING,
]

async function backfillHospitalDoctor() {
  const startTime = Date.now()
  console.log('\n' + '='.repeat(60))
  console.log(`Backfilling lead.hospitalName / ipdDrName (${DRY_RUN ? 'DRY RUN' : 'LIVE'})`)
  console.log('='.repeat(60))

  let cursor: string | undefined
  let scanned = 0
  let hospitalUpdated = 0
  let doctorUpdated = 0
  let errors = 0

  while (true) {
    const batch = await prisma.lead.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: 'asc' },
      where: {
        caseStage: { in: APPROVED_STAGES },
        kypSubmission: { preAuthData: { requestedHospitalName: { not: null } } },
      },
      select: {
        id: true,
        leadRef: true,
        hospitalName: true,
        ipdDrName: true,
        kypSubmission: {
          select: {
            preAuthData: {
              select: {
                requestedHospitalName: true,
                suggestedHospitals: { select: { hospitalName: true, suggestedDoctor: true } },
              },
            },
          },
        },
      },
    })
    if (batch.length === 0) break
    cursor = batch[batch.length - 1].id

    for (const lead of batch) {
      scanned++
      try {
        const preAuth = lead.kypSubmission?.preAuthData
        const requestedName = preAuth?.requestedHospitalName?.trim()
        if (!requestedName) continue

        const matched = preAuth?.suggestedHospitals?.find(
          (h) => h.hospitalName.trim().toLowerCase() === requestedName.toLowerCase()
        )
        const approvedHospital = matched?.hospitalName?.trim() || requestedName
        const approvedDoctor = matched?.suggestedDoctor?.trim() || null

        const data: { hospitalName?: string; ipdDrName?: string } = {}
        if (approvedHospital && lead.hospitalName?.trim() !== approvedHospital) {
          data.hospitalName = approvedHospital
        }
        if (approvedDoctor && !lead.ipdDrName?.trim()) {
          data.ipdDrName = approvedDoctor
        }
        if (Object.keys(data).length === 0) continue

        if (data.hospitalName) hospitalUpdated++
        if (data.ipdDrName) doctorUpdated++

        if (DRY_RUN) {
          console.log(`[${lead.leadRef}]`, data)
        } else {
          await prisma.lead.update({ where: { id: lead.id }, data })
        }
      } catch (err) {
        errors++
        console.error(`Error on lead ${lead.id}:`, err)
      }
    }

    console.log(
      `  progress: scanned=${scanned} hospitalUpdated=${hospitalUpdated} doctorUpdated=${doctorUpdated} errors=${errors}`
    )
    if (batch.length < BATCH_SIZE) break
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n' + '-'.repeat(60))
  console.log(`Done in ${elapsed}s`)
  console.log(`  scanned:          ${scanned}`)
  console.log(`  hospital updated: ${hospitalUpdated}`)
  console.log(`  doctor updated:   ${doctorUpdated}`)
  console.log(`  errors:           ${errors}`)
  console.log(DRY_RUN ? '(dry run — no writes performed)' : '(writes committed)')
  console.log('='.repeat(60) + '\n')
}

backfillHospitalDoctor()
  .then(() => prisma.$disconnect().then(() => process.exit(0)))
  .catch((err) => {
    console.error(err)
    prisma.$disconnect().then(() => process.exit(1))
  })
