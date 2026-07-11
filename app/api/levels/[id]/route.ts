import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'targets:write')) return errorResponse('Forbidden', 403)

    const { id } = await params
    await prisma.tierDefinition.delete({ where: { id } })

    return successResponse(null, 'Level deleted')
  } catch (error) {
    console.error('Error deleting tier definition:', error)
    return errorResponse('Failed to delete level', 500)
  }
}