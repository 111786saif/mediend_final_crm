import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import {
  errorResponse,
  successResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(request)
    if (!session) return unauthorizedResponse()

    const { id } = await params
    const status = await prisma.userStatus.findUnique({ where: { id } })
    if (!status) return errorResponse('Status not found', 404)
    if (status.userId !== session.id) return errorResponse('Forbidden', 403)

    await prisma.userStatus.delete({ where: { id } })
    return successResponse({ id }, 'Status removed')
  } catch (error) {
    console.error('Error deleting status:', error)
    return errorResponse('Failed to delete status', 500)
  }
}
