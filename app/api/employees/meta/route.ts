import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const canRead =
      hasPermission(user, 'hrms:employees:read') ||
      hasPermission(user, 'hrms:employees:write') ||
      hasPermission(user, 'users:write') ||
      hasPermission(user, 'finance:payroll:read') ||
      hasPermission(user, 'finance:payroll:write')

    if (!canRead) {
      return errorResponse('Forbidden', 403)
    }

    const circles = await prisma.crmCampaignCircle.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    })

    return successResponse({ circles })
  } catch (error) {
    console.error('Error fetching employee metadata:', error)
    return errorResponse('Failed to fetch employee metadata', 500)
  }
}
