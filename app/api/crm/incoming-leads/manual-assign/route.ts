import { NextRequest } from 'next/server'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { manuallyAssignIncomingLeads } from '@/lib/incoming-leads/manual-assign'
import { getBulkReassignableBdUsersForActor } from '@/lib/lead-ownership'
import { getSessionWithFreshUser } from '@/lib/session'

type ManualAssignBody = {
  incomingLeadIds?: unknown
  bdUserIds?: unknown
}

function isSuperAdmin(role: string | null | undefined) {
  return role === 'SUPER_ADMIN'
}

export async function GET() {
  const currentUser = await getSessionWithFreshUser()
  if (!currentUser) {
    return unauthorizedResponse()
  }

  if (!isSuperAdmin(String(currentUser.role))) {
    return errorResponse('Forbidden', 403)
  }

  const assignableUsers = await getBulkReassignableBdUsersForActor(currentUser)

  return successResponse({
    canManualAssign: assignableUsers.length > 0,
    assignableUsers,
  })
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) {
      return unauthorizedResponse()
    }

    if (!isSuperAdmin(String(currentUser.role))) {
      return errorResponse('Forbidden', 403)
    }

    const body = (await request.json()) as ManualAssignBody
    const incomingLeadIds = Array.isArray(body.incomingLeadIds)
      ? body.incomingLeadIds.filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0
        )
      : []
    const bdUserIds = Array.isArray(body.bdUserIds)
      ? body.bdUserIds.filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0
        )
      : []

    const result = await manuallyAssignIncomingLeads(incomingLeadIds, bdUserIds)

    return successResponse(
      result,
      `Assigned ${result.processedCount} incoming lead${result.processedCount === 1 ? '' : 's'}`
    )
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to manually assign incoming leads',
      400
    )
  }
}
