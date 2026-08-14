import { NextRequest } from 'next/server'
import { EmployeeStatus, UserRole } from '@/generated/prisma/client'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { manuallyAssignIncomingLeads } from '@/lib/incoming-leads/manual-assign'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'

type ManualAssignBody = {
  incomingLeadIds?: unknown
  assigneeUserIds?: unknown
  bdUserIds?: unknown
}

function isSuperAdmin(role: string | null | undefined) {
  return role === 'SUPER_ADMIN'
}

const INCOMING_LEAD_MANUAL_ASSIGNABLE_ROLES = [
  UserRole.BD,
  UserRole.EXECUTIVE_ASSISTANT,
  UserRole.SALES_HEAD,
  UserRole.CATEGORY_MANAGER,
  UserRole.TEAM_LEAD,
  UserRole.MD,
] as const

export async function GET() {
  const currentUser = await getSessionWithFreshUser()
  if (!currentUser) {
    return unauthorizedResponse()
  }

  if (!isSuperAdmin(String(currentUser.role))) {
    return errorResponse('Forbidden', 403)
  }

  const assignableUsers = await prisma.user.findMany({
    where: {
      role: { in: [...INCOMING_LEAD_MANUAL_ASSIGNABLE_ROLES] },
      employee: {
        is: {
          status: EmployeeStatus.ACTIVE,
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: 'asc' },
  })

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
    const assigneeUserIds = Array.isArray(body.assigneeUserIds)
      ? body.assigneeUserIds.filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0
        )
      : Array.isArray(body.bdUserIds)
      ? body.bdUserIds.filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0
        )
      : []

    const result = await manuallyAssignIncomingLeads(incomingLeadIds, assigneeUserIds, {
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
    })

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
