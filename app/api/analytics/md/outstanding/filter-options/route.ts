import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (user.role !== 'MD' && user.role !== 'ADMIN') {
      return errorResponse('Forbidden', 403)
    }

    const leads = await prisma.lead.findMany({
      where: {
        pipelineStage: { in: ['PL', 'COMPLETED'] },
        dischargeSheet: { isNot: null },
        plRecord: { isNot: null },
      },
      select: {
        hospitalName: true,
        surgeonName: true,
        ipdDrName: true,
        circle: true,
        treatment: true,
        bdId: true,
        bd: { select: { id: true, name: true } },
        dischargeSheet: {
          select: { doctorName: true, hospitalName: true },
        },
      },
    })

    const hospitalSet = new Set<string>()
    const doctorSet = new Set<string>()
    const circleSet = new Set<string>()
    const treatmentSet = new Set<string>()
    const bdMap = new Map<string, string>()

    for (const l of leads) {
      const hospital = l.dischargeSheet?.hospitalName?.trim() || l.hospitalName?.trim()
      const doctor = l.dischargeSheet?.doctorName?.trim() || l.surgeonName?.trim() || l.ipdDrName?.trim()

      if (hospital) hospitalSet.add(hospital)
      if (doctor) doctorSet.add(doctor)
      if (l.circle?.trim()) circleSet.add(l.circle.trim())
      if (l.treatment?.trim()) treatmentSet.add(l.treatment.trim())
      if (l.bd?.id && l.bd.name) bdMap.set(l.bd.id, l.bd.name)
    }

    const collator = new Intl.Collator(undefined, { sensitivity: 'base' })

    return successResponse({
      hospitals: [...hospitalSet].sort((a, b) => collator.compare(a, b)),
      doctors: [...doctorSet].sort((a, b) => collator.compare(a, b)),
      circles: [...circleSet].sort((a, b) => collator.compare(a, b)),
      treatments: [...treatmentSet].sort((a, b) => collator.compare(a, b)),
      bds: [...bdMap.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => collator.compare(a.name, b.name)),
    })
  } catch (error) {
    console.error('Error fetching outstanding filter options:', error)
    return errorResponse('Failed to fetch filter options', 500)
  }
}
