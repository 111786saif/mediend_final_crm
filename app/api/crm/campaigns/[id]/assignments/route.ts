import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { logCrmActivity } from '@/lib/crm-activity'
import {
  CAMPAIGN_ASSIGNMENT_SENTINEL_MONTH,
  CAMPAIGN_ASSIGNMENT_SENTINEL_YEAR,
  isSuperAdmin,
} from '@/lib/crm-campaigns'
import { hasCrmPermission } from '@/lib/crm-permissions'
import { prisma } from '@/lib/prisma'
import { isTeamLeadEquivalent } from '@/lib/sales-hierarchy-roles'
import { getSessionWithFreshUser } from '@/lib/session'

const assignmentMemberSchema = z.object({
  teamLeadEmployeeId: z.string().min(1),
  weight: z.number().int().min(1).default(1),
  priority: z.number().int().min(0).default(100),
  isActive: z.boolean().default(true),
  bdLimits: z
    .array(
      z.object({
        bdEmployeeId: z.string().min(1),
        maxLeadsPerDay: z.number().int().min(1),
      })
    )
    .default([]),
})

const assignmentSchema = z.object({
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
        circleSelections: {
          include: {
            circle: true,
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
        !isTeamLeadEquivalent(employee.user.role) || employee.status !== 'ACTIVE'
    )
    if (invalid) {
      return errorResponse(
        'All assignments must point to active Team Lead or Assistant Category Manager employees.',
        400
      )
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
    const bdLimitAssignments = uniqueAssignments.flatMap((assignment) =>
      assignment.bdLimits.map((bdLimit) => ({
        teamLeadEmployeeId: assignment.teamLeadEmployeeId,
        bdEmployeeId: bdLimit.bdEmployeeId,
        maxLeadsPerDay: bdLimit.maxLeadsPerDay,
      }))
    )
    const bdEmployees = bdLimitAssignments.length
      ? await prisma.employee.findMany({
          where: {
            id: {
              in: [...new Set(bdLimitAssignments.map((assignment) => assignment.bdEmployeeId))],
            },
          },
          include: {
            department: true,
            user: true,
          },
        })
      : []
    const bdEmployeeMap = new Map(bdEmployees.map((employee) => [employee.id, employee]))
    const campaignCircleNames = campaign.circleSelections
      .map((selection) => selection.circle.name.trim().toLowerCase())
      .filter(Boolean)

    await prisma.$transaction(async (tx) => {
      await tx.crmCampaignTeamLeadAssignment.deleteMany({
        where: {
          campaignId: campaign.id,
        },
      })
      await tx.crmCampaignBdDailyLimit.deleteMany({
        where: {
          campaignId: campaign.id,
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
              month: CAMPAIGN_ASSIGNMENT_SENTINEL_MONTH,
              year: CAMPAIGN_ASSIGNMENT_SENTINEL_YEAR,
              weight: assignment.weight,
              priority: assignment.priority,
              isActive: assignment.isActive,
            }
          }),
        })

        const bdLimitRows = bdLimitAssignments.flatMap((assignment) => {
          const teamLeadEmployee = employeeMap.get(assignment.teamLeadEmployeeId)
          const bdEmployee = bdEmployeeMap.get(assignment.bdEmployeeId)

          if (!teamLeadEmployee || !bdEmployee) {
            throw new Error('One or more BDs configured in the daily limit list were not found.')
          }

          if (bdEmployee.user.role !== 'BD' || bdEmployee.status !== 'ACTIVE') {
            throw new Error('Only active BDs can be configured with daily lead limits.')
          }

          if (bdEmployee.managerId !== teamLeadEmployee.id) {
            throw new Error(
              `BD "${bdEmployee.user.name}" does not report to Team Lead "${teamLeadEmployee.user.name}".`
            )
          }

          if (campaign.departmentId && bdEmployee.departmentId !== campaign.departmentId) {
            throw new Error(
              campaign.department?.name
                ? `BD "${bdEmployee.user.name}" does not belong to the "${campaign.department.name}" department.`
                : `BD "${bdEmployee.user.name}" does not belong to the campaign department.`
            )
          }

          const bdCircleNames = (bdEmployee.circle ?? '')
            .split(',')
            .map((circle) => circle.trim().toLowerCase())
            .filter(Boolean)

          if (
            campaignCircleNames.length > 0 &&
            !bdCircleNames.some((circle) => campaignCircleNames.includes(circle))
          ) {
            throw new Error(
              `BD "${bdEmployee.user.name}" does not match the selected campaign circles.`
            )
          }

          return [
            {
              campaignId: campaign.id,
              teamLeadEmployeeId: teamLeadEmployee.id,
              bdEmployeeId: bdEmployee.id,
              bdUserId: bdEmployee.userId,
              maxLeadsPerDay: assignment.maxLeadsPerDay,
            },
          ]
        })

        if (bdLimitRows.length > 0) {
          await tx.crmCampaignBdDailyLimit.createMany({
            data: bdLimitRows,
          })
        }
      }
    })

    const updatedAssignments = await prisma.crmCampaignTeamLeadAssignment.findMany({
      where: {
        campaignId: campaign.id,
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
    const updatedBdDailyLimits = await prisma.crmCampaignBdDailyLimit.findMany({
      where: {
        campaignId: campaign.id,
      },
      include: {
        bdEmployee: {
          include: {
            department: true,
            user: true,
          },
        },
      },
      orderBy: [
        {
          bdEmployee: {
            user: {
              name: 'asc',
            },
          },
        },
      ],
    })

    await logCrmActivity({
      action: 'CRM_CAMPAIGN_ASSIGNMENTS_REPLACED',
      entityType: 'CRM_CAMPAIGN_ASSIGNMENT',
      entityId: campaign.id,
      entityLabel: `${campaign.externalCampaignId} · Active assignment pool`,
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      request,
      summary: `Replaced Team Lead assignments for campaign ${campaign.externalCampaignId}`,
      metadata: {
        campaignId: campaign.id,
        externalCampaignId: campaign.externalCampaignId,
        displayName: campaign.displayName,
        assignmentCount: updatedAssignments.length,
        bdDailyLimitCount: updatedBdDailyLimits.length,
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
        bdDailyLimits: updatedBdDailyLimits.map((limit) => ({
          id: limit.id,
          teamLeadEmployeeId: limit.teamLeadEmployeeId,
          bdEmployeeId: limit.bdEmployeeId,
          bdUserId: limit.bdUserId,
          bdName: limit.bdEmployee.user.name,
          departmentName: limit.bdEmployee.department?.name ?? null,
          maxLeadsPerDay: limit.maxLeadsPerDay,
        })),
      },
    })

    return successResponse(
      {
        campaign,
        assignments: updatedAssignments,
        bdDailyLimits: updatedBdDailyLimits,
      },
      'Campaign assignments updated successfully'
    )
  } catch (error) {
    console.error('Error updating campaign assignments:', error)
    return errorResponse('Failed to update campaign assignments', 500)
  }
}
