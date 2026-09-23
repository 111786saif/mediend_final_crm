import { leadIdSchema } from '@/lib/lead-id'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const { id: rawLeadId } = await params
    const parsedLeadId = leadIdSchema.safeParse(rawLeadId)
    if (!parsedLeadId.success) return errorResponse('Invalid lead ID', 400)
    const leadId = parsedLeadId.data

    // Check if lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    // Get stage history
    const history = await prisma.caseStageHistory.findMany({
      where: { leadId },
      include: {
        changedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        changedAt: 'desc',
      },
    })

    return successResponse(history)
  } catch (error) {
    console.error('Error fetching stage history:', error)
    return errorResponse('Failed to fetch stage history', 500)
  }
}
