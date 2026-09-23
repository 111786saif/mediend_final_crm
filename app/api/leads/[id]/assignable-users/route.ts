import { leadIdSchema } from '@/lib/lead-id'
import { NextRequest } from 'next/server'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  canUserEditLeadProfile,
  canUserEditLeadRemarks,
  canUserReassignLead,
  canUserUpdateLeadStatus,
  canUserViewLeadOwner,
  getAssignableLeadUsersForActor,
} from '@/lib/lead-ownership'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import { getSessionFromRequest } from '@/lib/session'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getSessionFromRequest(request)
  if (!user) {
    return unauthorizedResponse()
  }

  if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, 'leads:read')) {
    return errorResponse('Forbidden', 403)
  }

  const { id: rawLeadId } = await params
    const parsedLeadId = leadIdSchema.safeParse(rawLeadId)
    if (!parsedLeadId.success) return errorResponse('Invalid lead ID', 400)
    const id = parsedLeadId.data
  const lead = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      bdId: true,
    },
  })

  if (!lead) {
    return errorResponse('Lead not found', 404)
  }

  if (!(await canUserViewLeadOwner(user, lead.bdId))) {
    return errorResponse('Forbidden', 403)
  }

  const canUpdateStatus = await canUserUpdateLeadStatus(user, lead.bdId)
  const canEditLeadProfile = await canUserEditLeadProfile(user, lead.bdId)
  const canEditRemarks = await canUserEditLeadRemarks(user, lead.bdId)
  const assignableUsers = canUpdateStatus
    ? await getAssignableLeadUsersForActor(user)
    : []

  const reassignableUsers = []
  for (const assignableUser of assignableUsers) {
    if (await canUserReassignLead(user, lead.bdId, assignableUser.id)) {
      reassignableUsers.push(assignableUser)
    }
  }

  return successResponse({
    canEditLeadProfile,
    canEditRemarks,
    canUpdateStatus,
    canReassign: reassignableUsers.length > 0,
    currentAssigneeId: lead.bdId,
    assignableUsers: reassignableUsers,
  })
}
