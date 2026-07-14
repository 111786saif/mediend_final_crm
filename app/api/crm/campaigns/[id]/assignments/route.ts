import { UserRole } from '@/generated/prisma/client'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { logCrmActivity } from '@/lib/crm-activity'
import { isSuperAdmin } from '@/lib/crm-campaigns'
import { hasCrmPermission } from '@/lib/crm-permissions'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'

const assignmentMemberSchema = z.object({
  teamLeadEmployeeId: z.string().min(1),
  weight: z.number().int().min(1).default(1),
  priority: z.number().int().min(0).default(100),
  isActive: z.boolean().default(true),
})

const assignmentSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  assignments: z.array(assignmentMemberSchema),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()
    const canManage =
      isSuperAdmin(currentUser) ||
      String(currentUser.role) === 'CRM_ADMIN' ||
      (await hasCrmPermission(currentUser.id, 'crm.campaigns.manage'))
    if (!canManage) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const parsed = assignmentSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.message, 400)
    }

    const { id } = await params
    const campaign = await prisma.crmCampaign.findUnique({
      where: { id },
      select: {
        id: true,
        externalCampaignId: true,
        displayName: true,
        departmentId: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })
    if (!campaign) {
      return errorResponse('Campaign not found', 404)
    }

    const uniqueAssignments = [
      ...new Map(
        parsed.data.assignments.map((assignment) => [assignment.teamLeadEmployeeId, assignment])
      ).values(),
    ]

    const employees = uniqueAssignments.length
      ? await prisma.employee.findMany({
          where: {
            id: {
              in: uniqueAssignments.map((assignment) => assignment.teamLeadEmployeeId),
            },
          },
          include: {
            user: true,
          },
        })
      : []

    if (employees.length !== uniqueAssignments.length) {
      return errorResponse('One or more Team Lead employees were not found.', 400)
    }

    const invalid = employees.find(
      (employee) =>
        employee.user.role !== UserRole.TEAM_LEAD || employee.status !== 'ACTIVE'
    )
    if (invalid) {
      return errorResponse('All assignments must point to active Team Lead employees.', 400)
    }

    if (campaign.departmentId) {
      const mismatchedDepartment = employees.find(
        (employee) => employee.departmentId !== campaign.departmentId
      )
      if (mismatchedDepartment) {
        return errorResponse(
          campaign.department?.name
            ? `All assigned Team Leads must belong to the "${campaign.department.name}" department for this campaign.`
            : 'All assigned Team Leads must belong to the campaign department.',
          400
        )
      }
    }

    const employeeMap = new Map(employees.map((employee) => [employee.id, employee]))

    await prisma.$transaction(async (tx) => {
      await tx.crmCampaignTeamLeadAssignment.deleteMany({
        where: {
          campaignId: campaign.id,
          month: parsed.data.month,
          year: parsed.data.year,
        },
      })

      if (uniqueAssignments.length > 0) {
        await tx.crmCampaignTeamLeadAssignment.createMany({
          data: uniqueAssignments.map((assignment) => {
            const employee = employeeMap.get(assignment.teamLeadEmployeeId)!
            return {
              campaignId: campaign.id,
              teamLeadEmployeeId: employee.id,
              teamLeadUserId: employee.userId,
              month: parsed.data.month,
              year: parsed.data.year,
              weight: assignment.weight,
              priority: assignment.priority,
              isActive: assignment.isActive,
            }
          }),
        })
      }
    })

    const updatedAssignments = await prisma.crmCampaignTeamLeadAssignment.findMany({
      where: {
        campaignId: campaign.id,
        month: parsed.data.month,
        year: parsed.data.year,
      },
      include: {
        teamLeadEmployee: {
          include: {
            department: true,
            user: true,
          },
        },
        teamLeadUser: true,
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    })

    await logCrmActivity({
      action: 'CRM_CAMPAIGN_ASSIGNMENTS_REPLACED',
      entityType: 'CRM_CAMPAIGN_ASSIGNMENT',
      entityId: `${campaign.id}:${parsed.data.month}:${parsed.data.year}`,
      entityLabel: `${campaign.externalCampaignId} · ${parsed.data.month}/${parsed.data.year}`,
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      request,
      summary: `Replaced Team Lead assignments for campaign ${campaign.externalCampaignId} (${parsed.data.month}/${parsed.data.year})`,
      metadata: {
        campaignId: campaign.id,
        externalCampaignId: campaign.externalCampaignId,
        displayName: campaign.displayName,
        month: parsed.data.month,
        year: parsed.data.year,
        assignmentCount: updatedAssignments.length,
        assignments: updatedAssignments.map((assignment) => ({
          id: assignment.id,
          teamLeadEmployeeId: assignment.teamLeadEmployeeId,
          teamLeadUserId: assignment.teamLeadUserId,
          teamLeadName: assignment.teamLeadEmployee.user.name,
          departmentName: assignment.teamLeadEmployee.department?.name ?? null,
          weight: assignment.weight,
          priority: assignment.priority,
          isActive: assignment.isActive,
        })),
      },
    })

    return successResponse(
      {
        campaign,
        month: parsed.data.month,
        year: parsed.data.year,
        assignments: updatedAssignments,
      },
      'Campaign assignments updated successfully'
    )
  } catch (error) {
    console.error('Error updating campaign assignments:', error)
    return errorResponse('Failed to update campaign assignments', 500)
  }
}
