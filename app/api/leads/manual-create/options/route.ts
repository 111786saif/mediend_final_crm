import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getCampaignManagementPageData } from '@/lib/crm-campaigns'
import { getManualLeadAssignableUsersForActor } from '@/lib/lead-ownership'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import { getSessionWithFreshUser } from '@/lib/session'

const PIPELINE_MANUAL_CREATE_ROLES = new Set([
  'BD',
  'TEAM_LEAD',
  'ASSISTANT_CATEGORY_MANAGER',
  'CATEGORY_MANAGER',
  'SALES_HEAD',
  'EXECUTIVE_ASSISTANT',
])

export async function GET() {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) {
      return unauthorizedResponse()
    }

    if (!PIPELINE_MANUAL_CREATE_ROLES.has(String(currentUser.role)) || !hasPermission(currentUser, 'leads:write')) {
      return errorResponse('Forbidden', 403)
    }

    const [campaignData, assignableUsers, hospitals, insurance] = await Promise.all([
      getCampaignManagementPageData(),
      getManualLeadAssignableUsersForActor(currentUser),
      prisma.hospitalMaster.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: 'asc' },
        take: 500,
      }),
      prisma.insuranceMaster.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: 'asc' },
        take: 500,
      }),
    ])

    if (assignableUsers.length === 0) {
      return errorResponse('No assignable users available for manual lead creation', 403)
    }

    return successResponse({
      assignableUsers,
      masters: {
        ...campaignData.masters,
        hospitals,
        insurance,
      },
    })
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to load manual lead creation options',
      500,
    )
  }
}
