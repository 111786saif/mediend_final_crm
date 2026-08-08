import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { CaseStage } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { logCrmActivity } from '@/lib/crm-activity'

export async function POST(request: NextRequest) {
  try {
    const currentUser = getSessionFromRequest(request)

    // Find or create TESTER user
    const testerUser = await prisma.user.findUnique({
      where: { email: 'tester@mediend.com' },
    })

    if (!testerUser) {
      return errorResponse('TESTER user (tester@mediend.com) not found', 404)
    }

    // Define early stages - NEW_LEAD or KYP_BASIC_PENDING (before any KYP done)
    const earlyStages = [CaseStage.NEW_LEAD, CaseStage.KYP_BASIC_PENDING]

    // Find all leads in early stage (card details only, no KYP done)
    const leadsToAssign = await prisma.lead.findMany({
      where: {
        caseStage: {
          in: earlyStages,
        },
        bdId: {
          not: testerUser.id,
        },
      },
      select: {
        id: true,
        leadRef: true,
        patientName: true,
        caseStage: true,
        bdId: true,
        assignedDate: true,
        bd: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (leadsToAssign.length === 0) {
      return successResponse({
        message: 'No leads found in early stage (NEW_LEAD, KYP_BASIC_PENDING) that need reassignment',
        reassigned: 0,
        leads: [],
      })
    }

    const assignedAt = new Date()

    await prisma.$transaction(
      leadsToAssign.map((lead) =>
        prisma.lead.update({
          where: { id: lead.id },
          data: {
            bdId: testerUser.id,
            assignedDate: assignedAt,
            updatedById: currentUser?.id ?? testerUser.id,
          },
        })
      )
    )

    await Promise.all(
      leadsToAssign.map((lead) =>
        logCrmActivity({
          action: 'CRM_LEAD_REASSIGNED',
          entityType: 'CRM_LEAD',
          entityId: lead.id,
          entityLabel: `${lead.leadRef} · ${lead.patientName}`,
          actorUserId: currentUser?.id ?? null,
          actorRole: currentUser?.role ?? null,
          request,
          summary: `Reassigned lead ${lead.leadRef} · ${lead.patientName} from ${lead.bd?.name ?? 'Unassigned'} to ${testerUser.name ?? 'TESTER'}`,
          metadata: {
            leadId: lead.id,
            leadRef: lead.leadRef,
            patientName: lead.patientName,
            previousBdId: lead.bdId,
            previousBdName: lead.bd?.name ?? null,
            nextBdId: testerUser.id,
            nextBdName: testerUser.name ?? testerUser.email,
            previousAssignedDate: lead.assignedDate?.toISOString() ?? null,
            nextAssignedDate: assignedAt.toISOString(),
            automatic: false,
          },
        })
      )
    )

    return successResponse({
      message: `Successfully reassigned ${leadsToAssign.length} leads (early stage: NEW_LEAD, KYP_BASIC_PENDING) to TESTER`,
      reassigned: leadsToAssign.length,
      stages: earlyStages,
      description: 'Leads with card details only, no KYP completed',
      testerUser: {
        id: testerUser.id,
        email: testerUser.email,
        name: testerUser.name,
      },
      sampleLeads: leadsToAssign.slice(0, 5),
    })
  } catch (error) {
    console.error('Error assigning leads to TESTER:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse(`Failed to assign leads: ${message}`, 500)
  }
}
