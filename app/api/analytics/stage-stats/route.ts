import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { mapStatusCode } from '@/lib/mysql-code-mappings'

import { getSalesDashboardBdIdFilter } from '@/lib/analytics/sales-dashboard-access'
import { isSubtreeScopedSalesRole } from '@/lib/sales-hierarchy-roles'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'analytics:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateFilter: Prisma.DateTimeFilter = {}
    if (startDate) dateFilter.gte = new Date(startDate)
    if (endDate) dateFilter.lte = new Date(endDate)

    const leadEntryDateFilter: Prisma.LeadWhereInput =
      Object.keys(dateFilter).length > 0
        ? {
            OR: [
              { leadEntryDate: dateFilter },
              { AND: [{ leadEntryDate: { equals: null } }, { createdDate: dateFilter }] },
            ],
          }
        : {}

    const where: Prisma.LeadWhereInput = {
      ...leadEntryDateFilter,
    }

    // Role-based filtering
    if (user.role === 'BD') {
      where.bdId = user.id
    } else if (isSubtreeScopedSalesRole(user.role)) {
      const bdIdFilter = await getSalesDashboardBdIdFilter(user)
      if (bdIdFilter) where.bdId = { in: bdIdFilter }
    }

    // Pipeline stage breakdown
    const pipelineStages = await prisma.lead.groupBy({
      by: ['pipelineStage'],
      where,
      _count: { id: true },
    })

    // Status category breakdown - fetch all leads and categorize client-side
    const allLeads = await prisma.lead.findMany({
      where,
      select: { status: true },
    })

    // Normalize status function (reused from pipeline logic)
    const normalizeStatus = (status: string | null | undefined): string => {
      if (!status) return 'New'

      // First, use the mapping function to convert codes to text
      const mappedStatus = mapStatusCode(status)

      // Then normalize text variations
      const normalized = mappedStatus.trim().toLowerCase()
      const statusMap: Record<string, string> = {
        'new lead': 'New',
        'new': 'New',
        'hot lead': 'Hot Lead',
        'hot': 'Hot Lead',
        'interested': 'Interested',
        'follow-up 1': 'Follow-up (1-3)',
        'follow-up 2': 'Follow-up (1-3)',
        'follow-up 3': 'Follow-up (1-3)',
        'follow-up': 'Follow-up (1-3)',
        'follow-up (1-3)': 'Follow-up (1-3)',
        'follow up (1-3)': 'Follow-up (1-3)',
        'call back (sd)': 'Call Back (SD)',
        'call back (t)': 'Call Back (T)',
        'call back next week': 'Call Back Next Week',
        'call back next month': 'Call Back Next Month',
        'ipd schedule': 'IPD Schedule',
        'ipd done': 'IPD Done',
        'closed': 'Closed',
        'call done': 'Call Done',
        'c/w done': 'C/W Done',
        'wa done': 'C/W Done',
        'scan done': 'C/W Done',
        'lost': 'Lost',
        'ipd lost': 'Lost',
        'dnp-1': 'DNP',
        'dnp-2': 'DNP',
        'dnp-3': 'DNP',
        'dnp-4': 'DNP',
        'dnp-5': 'DNP',
        'dnp': 'DNP',
        'dnp exhausted': 'DNP (1-5, Exhausted)',
        'dnp (1-5, exhausted)': 'DNP (1-5, Exhausted)',
        'junk': 'Junk',
        'invalid number': 'Invalid Number',
        'fund issues': 'Fund Issues',
        'not interested': 'Lost',
        'duplicate lead': 'Lost',
      }
      return statusMap[normalized] || mappedStatus
    }

    const statusStats = {
      new: 0,
      followUps: 0,
      ipdDone: 0,
      dnp: 0,
      lost: 0,
      completed: 0,
    }

    allLeads.forEach((lead) => {
      const status = normalizeStatus(lead.status)
      const statusLower = status.toLowerCase()

      // New & Hot
      if (
        ['New', 'New Lead', 'Hot Lead', 'Interested', 'Nurture'].includes(status) ||
        statusLower.includes('new') ||
        statusLower.includes('hot') ||
        statusLower.includes('interested')
      ) {
        statusStats.new++
      }
      // Follow-ups
      else if (
        [
          'Follow-up (1-3)',
          'Follow-up 1',
          'Follow-up 2',
          'Follow-up 3',
          'Follow-up',
          'Call Back (SD)',
          'Call Back (T)',
          'Call Back Next Week',
          'Call Back Next Month',
          'Out of Station',
          'Out of station follow-up',
          'IPD Schedule',
          'OPD Scheduled',
          'OPD Schedule',
          'OPD Done',
        ].includes(status) ||
        statusLower.includes('follow') ||
        statusLower.includes('call back') ||
        statusLower.includes('schedule')
      ) {
        statusStats.followUps++
      }
      // IPD Done
      else if (status === 'IPD Done' || statusLower.includes('ipd done')) {
        statusStats.ipdDone++
      }
      // DNP
      else if (
        ['DNP', 'DNP-1', 'DNP-2', 'DNP-3', 'DNP-4', 'DNP-5', 'DNP Exhausted', 'DNP (1-5, Exhausted)'].includes(status) ||
        statusLower.includes('dnp')
      ) {
        statusStats.dnp++
      }
      // Lost/Inactive
      else if (
        [
          'Lost',
          'IPD Lost',
          'Junk',
          'Invalid Number',
          'Fund Issues',
          'Not Interested',
          'Duplicate lead',
          'Already Insured',
          'SX Not Suggested',
          'Language Barrier',
        ].includes(status) ||
        statusLower.includes('lost') ||
        statusLower.includes('junk') ||
        statusLower.includes('invalid') ||
        statusLower.includes('duplicate') ||
        statusLower.includes('not interested')
      ) {
        statusStats.lost++
      }
      // Completed
      else if (
        ['Closed', 'Call Done', 'C/W Done', 'WA Done', 'Scan Done', 'Order Booked', 'Policy Booked', 'Policy Issued'].includes(status) ||
        statusLower.includes('closed') ||
        statusLower.includes('done') ||
        statusLower.includes('booked')
      ) {
        statusStats.completed++
      }
    })

    // Format pipeline stages
    const stageBreakdown = {
      SALES: 0,
      INSURANCE: 0,
      PL: 0,
      COMPLETED: 0,
      LOST: 0,
    }

    pipelineStages.forEach((stage) => {
      if (stage.pipelineStage && stage.pipelineStage in stageBreakdown) {
        stageBreakdown[stage.pipelineStage as keyof typeof stageBreakdown] = stage._count.id
      }
    })

    return successResponse({
      pipelineStages: stageBreakdown,
      statusCategories: statusStats,
    })
  } catch (error) {
    console.error('Error fetching stage stats:', error)
    return errorResponse('Failed to fetch stage stats', 500)
  }
}
