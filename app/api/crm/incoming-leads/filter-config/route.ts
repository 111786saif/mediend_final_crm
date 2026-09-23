import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { hasCrmPermission } from '@/lib/crm-permissions'
import { UserRole } from '@/generated/prisma/client'

function toOptions(values: Array<string | null | undefined>): Array<{ label: string; value: string }> {
  return [...new Set(values.filter((v): v is string => !!v && v.trim() !== '' && v !== '—'))]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ label: name, value: name }))
}

const INCOMING_LEAD_VIEW_ROLES = new Set([
  'SUPER_ADMIN',
  'CRM_ADMIN',
  'BD',
  'TEAM_LEAD',
  'CATEGORY_MANAGER',
  'ASSISTANT_CATEGORY_MANAGER',
  'SALES_HEAD',
])

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()

    const canView =
      String(currentUser.role) === 'SUPER_ADMIN' ||
      String(currentUser.role) === 'CRM_ADMIN' ||
      (await hasCrmPermission(currentUser.id, 'crm.campaigns.manage')) ||
      INCOMING_LEAD_VIEW_ROLES.has(String(currentUser.role))

    if (!canView) {
      return errorResponse('Forbidden', 403)
    }

    const [
      sourceMasters,
      leadSourceMasters,
      circleMasters,
      cityMasters,
      treatmentCategoryMasters,
      treatmentMasters,
      campaigns,
      teamLeadUsers,
      bdUsers,
      incomingSources,
      incomingStatuses,
      leadCategories,
      leadTreatments,
      leadCircles,
    ] = await Promise.all([
      prisma.crmCampaignSource.findMany({ select: { name: true } }),
      prisma.crmCampaignLeadSource.findMany({ select: { name: true } }),
      prisma.crmCampaignCircle.findMany({ select: { name: true } }),
      prisma.crmCampaignCity.findMany({ select: { name: true } }),
      prisma.treatmentCategoryMaster.findMany({ select: { name: true } }),
      prisma.treatmentMaster.findMany({ select: { name: true } }),
      prisma.crmCampaign.findMany({ select: { displayName: true } }),
      prisma.user.findMany({
        where: { role: UserRole.TEAM_LEAD },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.user.findMany({
        where: { role: UserRole.BD },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.incomingLead.groupBy({
        by: ['source'],
      }),
      prisma.incomingLead.groupBy({
        by: ['status'],
      }),
      prisma.lead.groupBy({
        where: { category: { not: null } },
        by: ['category'],
      }),
      prisma.lead.groupBy({
        where: { treatment: { not: '' } },
        by: ['treatment'],
      }),
      prisma.lead.groupBy({
        where: { circle: { not: '' } },
        by: ['circle'],
      }),
    ])

    const knownStatuses = ['PROCESSED', 'DUPLICATE', 'FAILED', 'BUCKET', 'PENDING']
    const statusOptions = toOptions([
      ...knownStatuses,
      ...incomingStatuses.map((s) => s.status),
    ])

    const sourceOptions = toOptions([
      ...sourceMasters.map((s) => s.name),
      ...incomingSources.map((s) => s.source),
    ])

    const campaignSourceOptions = toOptions(sourceMasters.map((s) => s.name))
    const leadSourceOptions = toOptions(leadSourceMasters.map((s) => s.name))
    const campaignNameOptions = toOptions(campaigns.map((c) => c.displayName))
    const categoryOptions = toOptions([
      ...treatmentCategoryMasters.map((c) => c.name),
      ...leadCategories.map((l) => l.category),
    ])
    const treatmentOptions = toOptions([
      ...treatmentMasters.map((t) => t.name),
      ...leadTreatments.map((l) => l.treatment),
    ])
    const circleOptions = toOptions([
      ...circleMasters.map((c) => c.name),
      ...leadCircles.map((l) => l.circle),
    ])
    const cityOptions = toOptions(cityMasters.map((c) => c.name))
    const teamLeadOptions = toOptions(teamLeadUsers.map((u) => u.name))
    const bdOptions = toOptions(bdUsers.map((u) => u.name))

    return successResponse({
      filters: [
        { field: 'receivedAt', label: 'Received', filterType: 'dateRange', filterable: true },
        { field: 'processedAt', label: 'Processed', filterType: 'dateRange', filterable: true },
        { field: 'status', label: 'Status', filterType: 'multiSelect', filterable: true, options: statusOptions },
        { field: 'source', label: 'Source', filterType: 'multiSelect', filterable: true, options: sourceOptions },
        { field: 'campaignName', label: 'Campaign Name', filterType: 'multiSelect', filterable: true, options: campaignNameOptions },
        { field: 'campaignSource', label: 'Campaign Source', filterType: 'multiSelect', filterable: true, options: campaignSourceOptions },
        { field: 'leadSource', label: 'Lead Source', filterType: 'multiSelect', filterable: true, options: leadSourceOptions },
        { field: 'category', label: 'Category', filterType: 'multiSelect', filterable: true, options: categoryOptions },
        { field: 'treatment', label: 'Treatment', filterType: 'multiSelect', filterable: true, options: treatmentOptions },
        { field: 'circle', label: 'Circle', filterType: 'multiSelect', filterable: true, options: circleOptions },
        { field: 'city', label: 'City', filterType: 'multiSelect', filterable: true, options: cityOptions },
        { field: 'patientName', label: 'Patient', filterType: 'search', filterable: true },
        { field: 'email', label: 'Email', filterType: 'search', filterable: true },
        { field: 'normalizedPhone', label: 'Phone', filterType: 'search', filterable: true },
        { field: 'assignedDate', label: 'Assign Date', filterType: 'dateRange', filterable: true },
        { field: 'leadDate', label: 'Lead Date', filterType: 'dateRange', filterable: true },
        { field: 'followUpDate', label: 'Follow up Date', filterType: 'dateRange', filterable: true },
        { field: 'surgeryDate', label: 'Surgery Date', filterType: 'dateRange', filterable: true },
        { field: 'processedLeadRef', label: 'Lead Ref', filterType: 'search', filterable: true },
        { field: 'teamLeadName', label: 'Team Lead', filterType: 'multiSelect', filterable: true, options: teamLeadOptions },
        { field: 'bdName', label: 'BD', filterType: 'multiSelect', filterable: true, options: bdOptions },
      ],
    })
  } catch (error) {
    console.error('[crm-incoming-leads/filter-config] Error:', error)
    return errorResponse('Failed to fetch filter config', 500)
  }
}
