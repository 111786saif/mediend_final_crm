import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canAccessSalesDashboard } from '@/lib/analytics/sales-dashboard-access'

function toOptions(values: Array<string | null | undefined>): Array<{ label: string; value: string }> {
  return [...new Set(values.filter((v): v is string => !!v && v.trim() !== ''))]
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ label: name, value: name }))
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionWithFreshUser()
    if (!user) return unauthorizedResponse()

    if (!canAccessSalesDashboard(user)) {
      return errorResponse('Forbidden', 403)
    }

    // Fetch distinct options for filters from leads that match the untouched criteria
    const untouchedWhere = {
      caseStage: 'NEW_LEAD' as const,
      assignedDate: null,
      OR: [
        { remarks: null },
        { remarks: '' }
      ]
    }

    const [sourcesDistinct, categoriesDistinct, statusesDistinct, rawLeadsForInactive] = await Promise.all([
      prisma.lead.findMany({
        where: {
          ...untouchedWhere,
          source: { not: null }
        },
        select: { source: true },
        distinct: ['source']
      }),
      prisma.lead.findMany({
        where: {
          ...untouchedWhere,
          category: { not: null }
        },
        select: { category: true },
        distinct: ['category']
      }),
      prisma.lead.findMany({
        where: untouchedWhere,
        select: { status: true },
        distinct: ['status']
      }),
      prisma.lead.findMany({
        where: untouchedWhere,
        select: {
          createdDate: true,
          leadEntryDate: true
        }
      })
    ])

    const now = new Date()
    const inactiveOpts = [...new Set(rawLeadsForInactive.map((lead) => {
      const baseDate = lead.leadEntryDate || lead.createdDate
      const diffTime = Math.abs(now.getTime() - new Date(baseDate).getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return `${diffDays} Day${diffDays > 1 ? 's' : ''}`
    }))].sort((a, b) => {
      const aDays = parseInt(a, 10)
      const bDays = parseInt(b, 10)
      return aDays - bDays
    }).map(opt => ({ label: opt, value: opt }))

    return successResponse({
      filters: [
        { field: 'leadRef', label: 'Lead Ref', filterType: 'search', filterable: true },
        { field: 'patientName', label: 'Patient Name', filterType: 'search', filterable: true },
        {
          field: 'source',
          label: 'Lead Source',
          filterType: 'multiSelect',
          filterable: true,
          options: toOptions(sourcesDistinct.map(s => s.source))
        },
        {
          field: 'category',
          label: 'Category',
          filterType: 'multiSelect',
          filterable: true,
          options: toOptions(categoriesDistinct.map(c => c.category))
        },
        { field: 'treatment', label: 'Treatment', filterType: 'search', filterable: true },
        {
          field: 'inactive',
          label: 'Inactive',
          filterType: 'multiSelect',
          filterable: true,
          options: inactiveOpts
        },
        {
          field: 'status',
          label: 'Status',
          filterType: 'multiSelect',
          filterable: true,
          options: toOptions(statusesDistinct.map(s => s.status))
        }
      ]
    })
  } catch (error) {
    console.error('[untouched-leads filter-config] Error:', error)
    return errorResponse('Failed to fetch filter config', 500)
  }
}
