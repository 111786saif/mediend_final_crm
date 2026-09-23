import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'

export async function GET() {
  try {
    if (!await getSessionWithFreshUser()) return unauthorizedResponse()

    const categories = await prisma.statusCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        groups: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            statuses: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
              select: { id: true, status: true, code: true, categoryId: true, groupId: true },
            },
          },
        },
      },
    })
    return successResponse(categories)
  } catch (error) {
    console.error('GET /api/leads/statuses error:', error)
    return errorResponse('Failed to load lead statuses', 500)
  }
}
