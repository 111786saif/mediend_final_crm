import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { extractIncomingLeadSummary } from '@/lib/crm-incoming-leads'
import { getBusinessMonthRange, getBusinessMonthYear, getCampaignManagementPageData } from '@/lib/crm-campaigns'
import { hasCrmPermission } from '@/lib/crm-permissions'
import { getLeadVisibilityScopeUserIds } from '@/lib/lead-ownership'
import { last10DigitsFromStored, parsePhoneSearchQuery } from '@/lib/phone-search'
import { maskPhoneNumber } from '@/lib/phone-utils'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'

const querySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  searchColumn: z.string().trim().optional(),
  searchValue: z.string().trim().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()

    const hierarchyRoles = new Set([
      'BD',
      'TEAM_LEAD',
      'CATEGORY_MANAGER',
      'ASSISTANT_CATEGORY_MANAGER',
      'SALES_HEAD',
    ])
    const hierarchyScopedUserIds = hierarchyRoles.has(String(currentUser.role))
      ? await getLeadVisibilityScopeUserIds(currentUser)
      : null
    const canView =
      String(currentUser.role) === 'SUPER_ADMIN' ||
      String(currentUser.role) === 'CRM_ADMIN' ||
      (await hasCrmPermission(currentUser.id, 'crm.campaigns.manage')) ||
      hierarchyRoles.has(String(currentUser.role))

    if (!canView) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      month: searchParams.get('month') ?? undefined,
      year: searchParams.get('year') ?? undefined,
      searchColumn: searchParams.get('searchColumn') ?? undefined,
      searchValue: searchParams.get('searchValue') ?? undefined,
    })

    if (!parsed.success) {
      return errorResponse(parsed.error.message, 400)
    }

    const fallback = getBusinessMonthYear()
    const hasExplicitMonthFilter =
      parsed.data.month !== undefined && parsed.data.year !== undefined
    const month = hasExplicitMonthFilter ? parsed.data.month! : fallback.month
    const year = hasExplicitMonthFilter ? parsed.data.year! : fallback.year
    const dateRange = hasExplicitMonthFilter ? getBusinessMonthRange(year, month) : null

    const [campaignData, incomingLeads] = await Promise.all([
      getCampaignManagementPageData(month, year),
      prisma.incomingLead.findMany({
        where: {
          ...(dateRange
            ? {
                receivedAt: {
                  gte: dateRange.start,
                  lte: dateRange.end,
                },
              }
            : {}),
        },
        orderBy: { receivedAt: 'desc' },
        take: 2000,
      }),
    ])

    const processedLeadIds = incomingLeads
      .map((incomingLead) => incomingLead.processedLeadId)
      .filter((value): value is string => Boolean(value))
    const relatedUserIds = incomingLeads
      .flatMap((incomingLead) => [
        incomingLead.selectedTeamLeadUserId,
        incomingLead.selectedBdUserId,
      ])
      .filter((value): value is string => Boolean(value))

    const [processedLeads, relatedUsers] = await Promise.all([
      processedLeadIds.length > 0
        ? prisma.lead.findMany({
            where: { id: { in: processedLeadIds } },
            select: {
              id: true,
              bdId: true,
              leadRef: true,
              patientName: true,
              phoneNumber: true,
              category: true,
              treatment: true,
              assignedDate: true,
              leadEntryDate: true,
              followUpDate: true,
              surgeryDate: true,
            },
          })
        : Promise.resolve([]),
      relatedUserIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: relatedUserIds } },
            select: {
              id: true,
              name: true,
              email: true,
            },
          })
        : Promise.resolve([]),
    ])

    const campaignByExternalId = new Map(
      campaignData.campaigns.map((campaign) => [campaign.externalCampaignId, campaign])
    )
    const processedLeadById = new Map(processedLeads.map((lead) => [lead.id, lead]))
    const userById = new Map(relatedUsers.map((user) => [user.id, user]))
    const visibleScopeUserIds =
      Array.isArray(hierarchyScopedUserIds) && hierarchyScopedUserIds.length > 0
        ? new Set(hierarchyScopedUserIds)
        : null
    const canViewPhone = String(currentUser.role) === 'ADMIN'
    const phoneSearch =
      parsed.data.searchColumn === 'normalizedPhone' && parsed.data.searchValue
        ? parsePhoneSearchQuery(parsed.data.searchValue)
        : null
    const filteredIncomingLeads =
      visibleScopeUserIds === null
        ? incomingLeads
        : incomingLeads.filter((incomingLead) => {
            const processedLead = incomingLead.processedLeadId
              ? processedLeadById.get(incomingLead.processedLeadId)
              : undefined

            return (
              (processedLead?.bdId ? visibleScopeUserIds.has(processedLead.bdId) : false) ||
              (incomingLead.selectedBdUserId
                ? visibleScopeUserIds.has(incomingLead.selectedBdUserId)
                : false) ||
              (incomingLead.selectedTeamLeadUserId
                ? visibleScopeUserIds.has(incomingLead.selectedTeamLeadUserId)
                : false)
            )
          })
    const searchedIncomingLeads =
      phoneSearch == null
        ? filteredIncomingLeads
        : filteredIncomingLeads.filter((incomingLead) => {
            const processedLead = incomingLead.processedLeadId
              ? processedLeadById.get(incomingLead.processedLeadId)
              : undefined
            const summary = extractIncomingLeadSummary(incomingLead.payload)

            return (
              incomingLead.normalizedPhone === phoneSearch.last10 ||
              last10DigitsFromStored(summary.phone) === phoneSearch.last10 ||
              last10DigitsFromStored(processedLead?.phoneNumber) === phoneSearch.last10
            )
          })

    return successResponse({
      month: hasExplicitMonthFilter ? month : null,
      year: hasExplicitMonthFilter ? year : null,
      masters: campaignData.masters,
      campaigns: campaignData.campaigns,
      incomingLeads: searchedIncomingLeads.map((incomingLead) => {
        const summary = extractIncomingLeadSummary(incomingLead.payload)
        const campaign = incomingLead.externalCampaignId
          ? campaignByExternalId.get(incomingLead.externalCampaignId)
          : undefined
        const processedLead = incomingLead.processedLeadId
          ? processedLeadById.get(incomingLead.processedLeadId)
          : undefined
        const teamLead = incomingLead.selectedTeamLeadUserId
          ? userById.get(incomingLead.selectedTeamLeadUserId)
          : undefined
        const bd = incomingLead.selectedBdUserId
          ? userById.get(incomingLead.selectedBdUserId)
          : undefined

        return {
          id: incomingLead.id,
          source: incomingLead.source,
          status: incomingLead.status,
          payload: incomingLead.payload,
          externalCampaignId: incomingLead.externalCampaignId,
          normalizedPhone: canViewPhone
            ? incomingLead.normalizedPhone
            : maskPhoneNumber(incomingLead.normalizedPhone),
          errorMessage: incomingLead.errorMessage,
          processedAt: incomingLead.processedAt,
          receivedAt: incomingLead.receivedAt,
          summary: {
            ...summary,
            phone: canViewPhone ? summary.phone : maskPhoneNumber(summary.phone),
          },
          campaign: campaign
            ? {
                id: campaign.id,
                displayName: campaign.displayName,
                externalCampaignId: campaign.externalCampaignId,
              }
            : null,
          processedLead: processedLead
            ? {
                id: processedLead.id,
                leadRef: processedLead.leadRef,
                patientName: processedLead.patientName,
                phoneNumber: canViewPhone
                  ? processedLead.phoneNumber
                  : maskPhoneNumber(processedLead.phoneNumber),
                category: processedLead.category,
                treatment: processedLead.treatment,
                assignedDate: processedLead.assignedDate,
                leadEntryDate: processedLead.leadEntryDate,
                followUpDate: processedLead.followUpDate,
                surgeryDate: processedLead.surgeryDate,
              }
            : null,
          teamLead: teamLead
            ? {
                id: teamLead.id,
                name: teamLead.name,
                email: teamLead.email,
              }
            : null,
          bd: bd
            ? {
                id: bd.id,
                name: bd.name,
                email: bd.email,
              }
            : null,
        }
      }),
    })
  } catch (error) {
    console.error('Error fetching CRM incoming leads:', error)
    return errorResponse('Failed to fetch CRM incoming leads', 500)
  }
}
