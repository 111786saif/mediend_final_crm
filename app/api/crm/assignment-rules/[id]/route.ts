import { z } from 'zod'
import { CrmAssignmentStrategy, UserRole } from '@/generated/prisma/client'
import { getSessionWithFreshUser } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { hasCrmPermission } from '@/lib/crm-permissions'
import { prisma } from '@/lib/prisma'
import { logCrmActivity } from '@/lib/crm-activity'

const memberSchema = z.object({
  employeeId: z.string().min(1),
  priority: z.number().int().min(0).default(100),
  weight: z.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
})

const updateRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  priority: z.number().int().min(0).optional().default(100),
  city: z.string().trim().optional().nullable(),
  category: z.string().trim().optional().nullable(),
  departmentId: z.string().trim().optional().nullable(),
  strategy: z.nativeEnum(CrmAssignmentStrategy).optional().default(CrmAssignmentStrategy.ROUND_ROBIN),
  members: z.array(memberSchema).default([]),
})

async function validateMembers(employeeIds: string[]) {
  if (employeeIds.length === 0) return

  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: {
      id: true,
      user: {
        select: {
          role: true,
        },
      },
    },
  })

  if (employees.length !== employeeIds.length) {
    throw new Error('One or more assignment pool employees were not found')
  }

  const invalid = employees.find((employee) => employee.user.role !== UserRole.BD)
  if (invalid) {
    throw new Error('Only BD employees can be added to an assignment pool')
  }
}

async function fetchRule(ruleId: string) {
  return prisma.crmAssignmentRule.findUnique({
    where: { id: ruleId },
    include: {
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      updatedBy: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      members: {
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              circle: true,
              designation: true,
              status: true,
              userId: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                },
              },
            },
          },
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      },
    },
  })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()

    const [canViewRules, canManageRules] = await Promise.all([
      hasCrmPermission(currentUser.id, 'crm.assignment_rules.view'),
      hasCrmPermission(currentUser.id, 'crm.assignment_rules.manage'),
    ])

    if (!canViewRules && !canManageRules) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const rule = await fetchRule(id)
    if (!rule) {
      return errorResponse('CRM assignment rule not found', 404)
    }

    return successResponse(rule)
  } catch (error) {
    console.error('Error fetching CRM assignment rule:', error)
    return errorResponse('Failed to fetch CRM assignment rule', 500)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()

    if (!(await hasCrmPermission(currentUser.id, 'crm.assignment_rules.manage'))) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const parsed = updateRuleSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.message, 400)
    }

    const { id } = await params
    const existing = await prisma.crmAssignmentRule.findUnique({
      where: { id },
      select: { id: true, name: true },
    })
    if (!existing) {
      return errorResponse('CRM assignment rule not found', 404)
    }

    const data = parsed.data
    const uniqueMembers = [...new Map(data.members.map((member) => [member.employeeId, member])).values()]
    try {
      await validateMembers(uniqueMembers.map((member) => member.employeeId))
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'Invalid assignment pool members', 400)
    }

    await prisma.$transaction(async (tx) => {
      await tx.crmAssignmentRule.update({
        where: { id },
        data: {
          name: data.name.trim(),
          description: data.description?.trim() || null,
          isActive: data.isActive,
          priority: data.priority,
          city: data.city?.trim() || null,
          category: data.category?.trim() || null,
          departmentId: data.departmentId || null,
          strategy: data.strategy,
          updatedById: currentUser.id,
        },
      })

      await tx.crmAssignmentRuleMember.deleteMany({
        where: { ruleId: id },
      })

      if (uniqueMembers.length > 0) {
        await tx.crmAssignmentRuleMember.createMany({
          data: uniqueMembers.map((member) => ({
            ruleId: id,
            employeeId: member.employeeId,
            priority: member.priority,
            weight: member.weight,
            isActive: member.isActive,
          })),
        })
      }
    })

    const rule = await fetchRule(id)
    if (rule) {
      await logCrmActivity({
        action: 'CRM_ASSIGNMENT_RULE_UPDATED',
        entityType: 'CRM_ASSIGNMENT_RULE',
        entityId: rule.id,
        entityLabel: rule.name,
        actorUserId: currentUser.id,
        actorRole: currentUser.role,
        request,
        summary: `Updated CRM assignment rule "${rule.name}"`,
        metadata: {
          previousName: existing.name,
          memberCount: rule.members.length,
          priority: rule.priority,
          strategy: rule.strategy,
          city: rule.city,
          category: rule.category,
          departmentId: rule.department?.id ?? null,
          departmentName: rule.department?.name ?? null,
          isActive: rule.isActive,
        },
      })
    }
    return successResponse(rule, 'CRM assignment rule updated successfully')
  } catch (error) {
    console.error('Error updating CRM assignment rule:', error)
    return errorResponse('Failed to update CRM assignment rule', 500)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()

    if (!(await hasCrmPermission(currentUser.id, 'crm.assignment_rules.manage'))) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const existing = await prisma.crmAssignmentRule.findUnique({
      where: { id },
      select: { id: true, name: true },
    })
    if (!existing) {
      return errorResponse('CRM assignment rule not found', 404)
    }

    await prisma.crmAssignmentRule.delete({
      where: { id },
    })

    await logCrmActivity({
      action: 'CRM_ASSIGNMENT_RULE_DELETED',
      entityType: 'CRM_ASSIGNMENT_RULE',
      entityId: existing.id,
      entityLabel: existing.name,
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      request: _request,
      summary: `Deleted CRM assignment rule "${existing.name}"`,
    })

    return successResponse({ id: existing.id, name: existing.name }, 'CRM assignment rule deleted successfully')
  } catch (error) {
    console.error('Error deleting CRM assignment rule:', error)
    return errorResponse('Failed to delete CRM assignment rule', 500)
  }
}
