import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { canMutateLead } from '@/lib/lead-access-api'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { isSalesLeadWorkerRole } from '@/lib/sales-hierarchy-roles'
import { z } from 'zod'

const answerQuerySchema = z.object({
  answer: z.string().min(1),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    // Only BD / TL / ACM / CM (or Admin) can answer queries
    if (!isSalesLeadWorkerRole(user.role) && user.role !== 'ADMIN') {
      return errorResponse('Forbidden: Only BD can answer queries', 403)
    }

    const { id } = await params
    const body = await request.json()
    const data = answerQuerySchema.parse(body)

    // Find query
    const query = await prisma.insuranceQuery.findUnique({
      where: { id },
      include: {
        preAuthorization: {
          include: {
            kypSubmission: {
              include: {
                lead: {
                  select: {
                    id: true,
                    leadRef: true,
                    patientName: true,
                    bdId: true,
                    bd: { select: { id: true } },
                  },
                },
              },
            },
          },
        },
        raisedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!query) {
      return errorResponse('Query not found', 404)
    }

    const leadRow = query.preAuthorization.kypSubmission.lead
    if (!(await canMutateLead(user, leadRow.bdId))) {
      return errorResponse('Forbidden: You are not assigned to this lead', 403)
    }

    // Update query with answer
    const updatedQuery = await prisma.insuranceQuery.update({
      where: { id },
      data: {
        answer: data.answer,
        answeredById: user.id,
        answeredAt: new Date(),
        status: 'ANSWERED',
      },
      include: {
        raisedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        answeredBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    // Create notification for Insurance team who raised the query
    await prisma.notification.create({
      data: {
        userId: query.raisedById,
        type: 'QUERY_ANSWERED',
        title: 'Query Answered',
        message: `BD has answered your query for ${query.preAuthorization.kypSubmission.lead.patientName} (${query.preAuthorization.kypSubmission.lead.leadRef})`,
        link: `/patient/${query.preAuthorization.kypSubmission.lead.id}/pre-auth`,
        relatedId: query.id,
      },
    })

    return successResponse(updatedQuery, 'Query answered successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error answering query:', error)
    return errorResponse('Failed to answer query', 500)
  }
}
