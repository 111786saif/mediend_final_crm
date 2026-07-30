import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionWithFreshUser } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canAccessSalesDashboard } from '@/lib/analytics/sales-dashboard-access'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionWithFreshUser()
    if (!user) return unauthorizedResponse()

    if (!canAccessSalesDashboard(user)) {
      return errorResponse('Forbidden', 403)
    }

    // Base untouched leads filter:
    // caseStage: 'NEW_LEAD', no assignedDate, and no remarks
    let finalWhere: Prisma.LeadWhereInput = {
      caseStage: 'NEW_LEAD' as const,
      assignedDate: null,
      OR: [
        { remarks: null },
        { remarks: '' }
      ]
    }

    let inactiveValues: string[] | null = null

    const { searchParams } = new URL(request.url)
    const filtersParam = searchParams.get('filters')
    if (filtersParam) {
      try {
        const parsedFilters = JSON.parse(filtersParam)
        if (Array.isArray(parsedFilters)) {
          const filterConditions: Prisma.LeadWhereInput[] = []

          for (const f of parsedFilters) {
            const { field, operator, value } = f
            if (!field || value === undefined || value === null) continue

            if (field === 'leadRef') {
              if (typeof value === 'string' && value.trim()) {
                filterConditions.push({
                  leadRef: { contains: value.trim(), mode: 'insensitive' }
                })
              }
            } else if (field === 'patientName') {
              if (typeof value === 'string' && value.trim()) {
                filterConditions.push({
                  patientName: { contains: value.trim(), mode: 'insensitive' }
                })
              }
            } else if (field === 'source') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  source: { in: value }
                })
              }
            } else if (field === 'category') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  category: { in: value }
                })
              }
            } else if (field === 'treatment') {
              if (typeof value === 'string' && value.trim()) {
                filterConditions.push({
                  treatment: { contains: value.trim(), mode: 'insensitive' }
                })
              }
            } else if (field === 'status') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  status: { in: value }
                })
              }
            } else if (field === 'inactive') {
              if (Array.isArray(value) && value.length > 0) {
                inactiveValues = value
              }
            }
          }

          if (filterConditions.length > 0) {
            finalWhere = { AND: [finalWhere, ...filterConditions] }
          }
        }
      } catch (err) {
        console.error('Error parsing filters:', err)
      }
    }

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // Fetch all records matching database criteria first (since alerts list is small, we process inactive in-memory)
    const rawLeads = await prisma.lead.findMany({
      where: finalWhere,
      select: {
        id: true,
        leadRef: true,
        patientName: true,
        source: true,
        category: true,
        treatment: true,
        status: true,
        createdDate: true,
        leadEntryDate: true
      },
      orderBy: {
        createdDate: 'desc'
      }
    })

    // Map age durations
    const now = new Date()
    let leads = rawLeads.map((lead) => {
      const baseDate = lead.leadEntryDate || lead.createdDate
      const diffTime = Math.abs(now.getTime() - new Date(baseDate).getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      const inactive = `${diffDays} Day${diffDays > 1 ? 's' : ''}`
      return {
        ...lead,
        inactive
      }
    })

    // Filter in-memory by inactive filter options if any selected
    if (inactiveValues && inactiveValues.length > 0) {
      leads = leads.filter((lead) => inactiveValues!.includes(lead.inactive))
    }

    const total = leads.length
    const paginatedLeads = leads.slice(skip, skip + limit)

    return successResponse({
      leads: paginatedLeads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('[untouched-leads] Error:', error)
    return errorResponse('Failed to fetch untouched leads', 500)
  }
}
