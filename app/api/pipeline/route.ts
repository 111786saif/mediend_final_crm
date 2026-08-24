import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  getVisibleLatestLeadRemark,
  getVisibleLeadRemarksFallbackContent,
} from '@/lib/lead-remark-visibility'
import { getVisibleLeadFollowUpDate } from '@/lib/lead-follow-up-visibility'
import { mapStatusCode } from '@/lib/mysql-code-mappings'
import { maskPhoneNumber } from '@/lib/phone-utils'
import { normalizeModeOfPaymentLabel } from '@/lib/mode-of-payment'
import {
  buildPipelineFiltersWhere,
  buildPipelineRoleWhere,
  parsePipelineQueryParams,
  pipelineOrderBy,
  type PipelineSelectedLead,
  pipelineTableSelect,
} from '@/lib/pipeline/server-query'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'leads:read')) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const params = parsePipelineQueryParams(searchParams)
    const { where: roleWhere } = await buildPipelineRoleWhere(user)

    const listWhere = buildPipelineFiltersWhere(params, roleWhere, { includeStatusBucket: true })
    const skip = (params.page - 1) * params.pageSize
    const orderBy = pipelineOrderBy(params.sortBy, params.sortDir)

    // Lightning-fast execution: only fetch table rows and count
    const [total, leads]: [number, PipelineSelectedLead[]] = await Promise.all([
      prisma.lead.count({ where: listWhere }),
      prisma.lead.findMany({
        where: listWhere,
        select: pipelineTableSelect,
        orderBy,
        skip,
        take: params.pageSize,
      }),
    ])

    const canViewPhone = user.role === 'ADMIN'
    const mappedLeads = leads.map((lead) => {
      const latestRemark = getVisibleLatestLeadRemark(lead, lead.leadRemarkEntries, user.role) ?? null
      const base = {
        ...lead,
        latestRemark,
        remarks: getVisibleLeadRemarksFallbackContent(lead, lead.remarks, user.role),
        followUpDate: getVisibleLeadFollowUpDate(lead, user.role),
        status: mapStatusCode(lead.status),
        modeOfPayment: normalizeModeOfPaymentLabel(lead.modeOfPayment),
        phoneNumber: canViewPhone
          ? lead.phoneNumber
          : (lead.phoneNumber ? maskPhoneNumber(lead.phoneNumber) : null),
        alternateNumber: canViewPhone
          ? lead.alternateNumber
          : (lead.alternateNumber ? maskPhoneNumber(lead.alternateNumber) : null),
      }
      delete (base as Record<string, unknown>).leadRemarkEntries
      return base
    })

    return successResponse({
      leads: mappedLeads,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
      sortBy: params.sortBy,
      sortDir: params.sortDir,
    })
  } catch (error) {
    console.error('Error fetching pipeline page:', error)
    return errorResponse('Failed to fetch pipeline data', 500)
  }
}
