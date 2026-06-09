import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  resolveLeadHospitalDoctor,
  normalizeDoctorKey,
  normalizeHospitalKey,
} from '@/lib/lead-display'

/**
 * Collapses raw name variants into one canonical label per normalized key.
 * Picks the longest variant as the representative (so "Dr. Singla" wins over
 * "singla"), keeping the dropdown consistent and free of case/whitespace/"Dr."
 * duplicates.
 */
function dedupeByKey(values: (string | null)[], keyFn: (v: string) => string): string[] {
  const byKey = new Map<string, string>()
  for (const raw of values) {
    if (!raw) continue
    const label = raw.trim()
    if (!label) continue
    const key = keyFn(label)
    if (!key) continue
    const existing = byKey.get(key)
    if (!existing || label.length > existing.length) byKey.set(key, label)
  }
  const collator = new Intl.Collator(undefined, { sensitivity: 'base' })
  return [...byKey.values()].sort((a, b) => collator.compare(a, b))
}

/**
 * Returns distinct hospital names, doctor names, and BD users that appear on
 * leads with at least one ComplianceCall. Drives the filter dropdowns on the
 * compliance officer dashboard. Hospital/doctor are built from the *resolved*
 * values (resolveLeadHospitalDoctor) so the dropdown matches what each row
 * shows, then de-duplicated/standardized via normalization keys.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'compliance:read')) return errorResponse('Forbidden', 403)

    const leads = await prisma.lead.findMany({
      where: { complianceCall: { isNot: null } },
      select: {
        hospitalName: true,
        surgeonName: true,
        ipdDrName: true,
        bdId: true,
        bd: { select: { id: true, name: true } },
        circle: true,
        treatment: true,
        dischargeSheet: { select: { doctorName: true, hospitalName: true } },
        kypSubmission: {
          select: {
            preAuthData: {
              select: { requestedHospitalName: true, suggestedHospitals: true },
            },
          },
        },
        plRecord: { select: { hospitalName: true, doctorName: true } },
      },
    })

    const hospitalValues: (string | null)[] = []
    const doctorValues: (string | null)[] = []
    const bdMap = new Map<string, string>()
    const circleSet = new Set<string>()
    const treatmentSet = new Set<string>()

    for (const l of leads) {
      const { hospital, doctor } = resolveLeadHospitalDoctor(l)
      hospitalValues.push(hospital)
      doctorValues.push(doctor)
      if (l.bd?.id && l.bd.name) bdMap.set(l.bd.id, l.bd.name)
      if (l.circle?.trim()) circleSet.add(l.circle.trim())
      if (l.treatment?.trim()) treatmentSet.add(l.treatment.trim())
    }

    const collator = new Intl.Collator(undefined, { sensitivity: 'base' })
    const hospitals = dedupeByKey(hospitalValues, normalizeHospitalKey)
    const surgeons = dedupeByKey(doctorValues, normalizeDoctorKey)
    const bds = [...bdMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => collator.compare(a.name, b.name))
    const circles = [...circleSet].sort((a, b) => collator.compare(a, b))
    const treatments = [...treatmentSet].sort((a, b) => collator.compare(a, b))

    return successResponse({ hospitals, surgeons, bds, circles, treatments })
  } catch (error) {
    console.error('Error fetching compliance filter options:', error)
    return errorResponse('Failed to fetch filter options', 500)
  }
}
