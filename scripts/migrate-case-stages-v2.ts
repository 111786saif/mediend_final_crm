/**
 * Migration script for Patient Case Flow v2:
 * - Map old case stages to new (KYP_PENDING -> KYP_BASIC_*, KYP_COMPLETE -> KYP_DETAILED_COMPLETE, etc.)
 * - Update CaseStageHistory fromStage/toStage
 * - Migrate PreAuthorization.hospitalSuggestions JSON to HospitalSuggestion rows
 * - Backfill KYPSubmission.area where null
 *
 * Run after Prisma migrations. Requires DATABASE_URL in .env.
 * Usage: npx tsx scripts/migrate-case-stages-v2.ts
 */

import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { CaseStage, Prisma } from '@/generated/prisma/client'

const OLD_TO_NEW_STAGE: Record<string, CaseStage> = {
  KYP_PENDING: CaseStage.KYP_BASIC_PENDING,
  KYP_COMPLETE: CaseStage.KYP_DETAILED_COMPLETE,
  ADMITTED: CaseStage.INITIATED,
  // IPD_DONE is still a live stage (surgery done, before discharge) — do NOT map to DISCHARGED.
}

async function migrateCaseStagesV2() {
  console.log('Starting case stage migration v2...')

  try {
    // 1. Migrate Lead.caseStage (old -> new)
    const leads = await prisma.lead.findMany({
      where: {
        caseStage: {
          in: ['KYP_PENDING', 'KYP_COMPLETE', 'ADMITTED'] as CaseStage[],
        },
      },
      include: {
        kypSubmission: {
          include: { preAuthData: true },
        },
      },
    })

    for (const lead of leads) {
      let newStage: CaseStage = OLD_TO_NEW_STAGE[lead.caseStage as string]
      if (!newStage) continue

      // KYP_PENDING: if preAuthData exists but BD hasn't raised, treat as KYP_DETAILED_PENDING
      if (lead.caseStage === 'KYP_PENDING' && lead.kypSubmission?.preAuthData && !lead.kypSubmission.preAuthData.preAuthRaisedAt) {
        newStage = CaseStage.KYP_DETAILED_PENDING
      }

      await prisma.lead.update({
        where: { id: lead.id },
        data: { caseStage: newStage },
      })
      console.log(`Lead ${lead.leadRef}: ${lead.caseStage} -> ${newStage}`)
    }
    console.log(`Updated ${leads.length} leads.`)

    // 2. Update CaseStageHistory fromStage and toStage
    const historyRecords = await prisma.caseStageHistory.findMany({
      where: {
        OR: [
          { fromStage: { in: ['KYP_PENDING', 'KYP_COMPLETE', 'ADMITTED'] as CaseStage[] } },
          { toStage: { in: ['KYP_PENDING', 'KYP_COMPLETE', 'ADMITTED'] as CaseStage[] } },
        ],
      },
    })

    for (const h of historyRecords) {
      const fromNew = (h.fromStage && OLD_TO_NEW_STAGE[h.fromStage as string]) ?? h.fromStage
      const toNew = OLD_TO_NEW_STAGE[h.toStage as string] ?? h.toStage
      await prisma.caseStageHistory.update({
        where: { id: h.id },
        data: {
          fromStage: fromNew as CaseStage,
          toStage: toNew,
        },
      })
    }
    console.log(`Updated ${historyRecords.length} CaseStageHistory records.`)

    // 3. Migrate hospitalSuggestions JSON -> HospitalSuggestion rows
    const preAuths = await prisma.preAuthorization.findMany({
      where: { hospitalSuggestions: { not: Prisma.DbNull } },
      include: { suggestedHospitals: true },
    })

    let hospitalsCreated = 0
    for (const preAuth of preAuths) {
      if (preAuth.suggestedHospitals.length > 0) continue // already migrated
      const arr = preAuth.hospitalSuggestions
      if (!Array.isArray(arr)) continue
      for (const name of arr) {
        const n = typeof name === 'string' ? name : (name as { name?: string })?.name ?? String(name)
        if (!n.trim()) continue
        await prisma.hospitalSuggestion.create({
          data: {
            preAuthId: preAuth.id,
            hospitalName: n.trim(),
          },
        })
        hospitalsCreated++
      }
    }
    console.log(`Created ${hospitalsCreated} HospitalSuggestion rows.`)

    // 4. Backfill KYPSubmission.area (set empty string where null)
    const updated = await prisma.kYPSubmission.updateMany({
      where: { area: null },
      data: { area: '' },
    })
    console.log(`Backfilled area for ${updated.count} KYP submissions.`)

    console.log('\nMigration v2 complete.')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

migrateCaseStagesV2()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
