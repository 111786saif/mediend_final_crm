import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

/**
 * Returns distinct hospital names, surgeon names, and BD users that appear on
 * leads with at least one ComplianceCall. Drives the search/filter dropdowns
 * on the compliance officer dashboard.
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
        bdId: true,
        bd: { select: { id: true, name: true } },
      },
    })

    const hospitalSet = new Set<string>()
    const surgeonSet = new Set<string>()
    const bdMap = new Map<string, string>()

    for (const l of leads) {
      if (l.hospitalName) hospitalSet.add(l.hospitalName.trim())
      if (l.surgeonName) surgeonSet.add(l.surgeonName.trim())
      if (l.bd?.id && l.bd.name) bdMap.set(l.bd.id, l.bd.name)
    }

    const collator = new Intl.Collator(undefined, { sensitivity: 'base' })
    const hospitals = [...hospitalSet].filter(Boolean).sort((a, b) => collator.compare(a, b))
    const surgeons = [...surgeonSet].filter(Boolean).sort((a, b) => collator.compare(a, b))
    const bds = [...bdMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => collator.compare(a.name, b.name))

    return successResponse({ hospitals, surgeons, bds })
  } catch (error) {
    console.error('Error fetching compliance filter options:', error)
    return errorResponse('Failed to fetch filter options', 500)
  }
}
