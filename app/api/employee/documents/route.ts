import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    // Get employee record for user
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
    })

    if (!employee) {
      return errorResponse('Employee record not found', 404)
    }

    const documents = await prisma.employeeDocument.findMany({
      where: { employeeId: employee.id },
      orderBy: {
        generatedAt: 'desc',
      },
      select: {
        id: true,
        documentType: true,
        documentUrl: true,
        title: true,
        generatedAt: true,
        ackToken: true,
        acknowledgedAt: true,
      },
    })

    return successResponse(documents)
  } catch (error) {
    console.error('Error fetching documents:', error)
    return errorResponse('Failed to fetch documents', 500)
  }
}

