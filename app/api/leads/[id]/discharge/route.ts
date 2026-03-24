import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { canMutateLead } from '@/lib/lead-access-api'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { postCaseChatSystemMessage } from '@/lib/case-chat'
import { CaseStage } from '@/generated/prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (user.role !== 'BD' && user.role !== 'TEAM_LEAD' && user.role !== 'ADMIN') {
      return errorResponse('Forbidden: Only BD / TL can mark discharge', 403)
    }

    const { id: leadId } = await params

    // Check if lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        bd: { select: { teamId: true } },
      },
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    if (!(await canMutateLead(user, lead.bdId, lead.bd?.teamId))) {
      return errorResponse('Forbidden', 403)
    }

    if (lead.caseStage !== CaseStage.INITIATED && lead.caseStage !== CaseStage.ADMITTED) {
      return errorResponse(`Cannot mark discharge. Current stage: ${lead.caseStage}`, 400)
    }

    // Update lead case stage
    const previousStage = lead.caseStage
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        caseStage: CaseStage.DISCHARGED,
      },
    })

    // Create stage history entry
    await prisma.caseStageHistory.create({
      data: {
        leadId,
        fromStage: previousStage,
        toStage: CaseStage.DISCHARGED,
        changedById: user.id,
        note: 'Patient discharged',
      },
    })

    await postCaseChatSystemMessage(leadId, 'BD marked patient discharged. Insurance can fill the discharge form.')

    // Create notifications for Insurance team
    const insuranceUsers = await prisma.user.findMany({
      where: {
        role: 'INSURANCE_HEAD',
      },
    })

    await prisma.notification.createMany({
      data: insuranceUsers.map((insuranceUser) => ({
        userId: insuranceUser.id,
        type: 'DISCHARGED',
        title: 'Patient Discharged',
        message: `Patient ${lead.patientName} (${lead.leadRef}) has been discharged`,
        link: `/patient/${leadId}/discharge`,
        relatedId: leadId,
      })),
    })

    return successResponse({ leadId }, 'Discharge marked successfully')
  } catch (error) {
    console.error('Error marking discharge:', error)
    return errorResponse('Failed to mark discharge', 500)
  }
}
