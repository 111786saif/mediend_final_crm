/**
 * Backfill lead.hospitalName / ipdDrName / surgeonName for leads where
 * hospitalName = "Not Specified" but a real hospital exists in related records.
 *
 * Priority chain mirrors lib/lead-display.ts resolveLeadHospitalDoctor:
 *   hospital: PL record → discharge sheet → pre-auth requested → 1st suggested hospital
 *   doctor:   PL record → discharge sheet → pre-auth matched doctor → 1st suggested doctor
 *
 * Usage:
 *   npx tsx scripts/backfill-all-hospitals.ts --dry-run
 *   npx tsx scripts/backfill-all-hospitals.ts
 */

import 'dotenv/config'
import { prisma } from '@/lib/prisma'

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH_SIZE = 500

function firstNonEmpty(...values: (string | null | undefined)[]): string | null {
  for (const v of values) {
    if (v == null) continue
    const s = String(v).trim()
    if (!s) continue
    return s
  }
  return null
}

async function backfillAllHospitals() {
  const startTime = Date.now()
  console.log('\n' + '='.repeat(60))
  console.log(`Backfilling hospital + doctor on leads (${DRY_RUN ? 'DRY RUN' : 'LIVE'})`)
  console.log('='.repeat(60))

  let cursor: number | undefined
  let scanned = 0
  let hospitalUpdated = 0
  let doctorUpdated = 0
  let skippedNoData = 0
  let errors = 0

  while (true) {
    const batch = await prisma.lead.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: 'asc' },
      where: {
        hospitalName: { equals: 'Not Specified' },
      },
      select: {
        id: true,
        leadRef: true,
        hospitalName: true,
        ipdDrName: true,
        surgeonName: true,
        flowType: true,
        caseStage: true,
        dischargeSheet: {
          select: { hospitalName: true, doctorName: true },
        },
        plRecord: {
          select: { hospitalName: true, doctorName: true },
        },
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
        const suggested = preAuth?.suggestedHospitals ?? []
        const requestedName = preAuth?.requestedHospitalName?.trim()
        const matched =
          requestedName != null
            ? suggested.find((h: { hospitalName: string }) =>
                h.hospitalName.trim().toLowerCase() === requestedName.toLowerCase()
              )
            : undefined
        const firstSuggested = suggested[0]

        const resolvedHospital = firstNonEmpty(
          lead.plRecord?.hospitalName ?? undefined,
          lead.dischargeSheet?.hospitalName ?? undefined,
          requestedName ?? undefined,
          matched?.hospitalName?.trim() ?? undefined,
          firstSuggested?.hospitalName?.trim() ?? undefined,
        )

        const resolvedDoctor = firstNonEmpty(
          lead.plRecord?.doctorName ?? undefined,
          lead.dischargeSheet?.doctorName ?? undefined,
          matched?.suggestedDoctor?.trim() ?? undefined,
          firstSuggested?.suggestedDoctor?.trim() ?? undefined,
        )

        const data: { hospitalName?: string; ipdDrName?: string; surgeonName?: string } = {}

        if (resolvedHospital) {
          data.hospitalName = resolvedHospital
        }

        if (resolvedDoctor) {
          data.ipdDrName = resolvedDoctor
          data.surgeonName = resolvedDoctor
        }

        if (Object.keys(data).length === 0) {
          skippedNoData++
          continue
        }

        if (data.hospitalName) hospitalUpdated++
        if (data.ipdDrName || data.surgeonName) doctorUpdated++

        if (DRY_RUN) {
          console.log(`[${lead.leadRef}] stage=${lead.caseStage} flow=${lead.flowType}`, data)
        } else {
          await prisma.lead.update({ where: { id: lead.id }, data })
        }
      } catch (err) {
        errors++
        console.error(`Error on lead ${lead.id}:`, err)
      }
    }

    console.log(
      `  scanned=${scanned} hospital=${hospitalUpdated} doctor=${doctorUpdated} skipped=${skippedNoData} errors=${errors}`
    )
    if (batch.length < BATCH_SIZE) break
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n' + '-'.repeat(60))
  console.log(`Done in ${elapsed}s`)
  console.log(`  scanned:          ${scanned}`)
  console.log(`  hospital updated: ${hospitalUpdated}`)
  console.log(`  doctor updated:   ${doctorUpdated}`)
  console.log(`  skipped (no data): ${skippedNoData}`)
  console.log(`  errors:           ${errors}`)
  console.log(DRY_RUN ? '(dry run — no writes performed)' : '(writes committed)')
  console.log('='.repeat(60) + '\n')
}

backfillAllHospitals()
  .then(() => prisma.$disconnect().then(() => process.exit(0)))
  .catch((err) => {
    console.error(err)
    prisma.$disconnect().then(() => process.exit(1))
  })
