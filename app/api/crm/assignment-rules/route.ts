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

const createRuleSchema = z.object({
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

export async function GET() {
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

    const rules = await prisma.crmAssignmentRule.findMany({
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
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
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
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    })

    return successResponse(rules)
  } catch (error) {
    console.error('Error fetching CRM assignment rules:', error)
    return errorResponse('Failed to fetch CRM assignment rules', 500)
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()

    if (!(await hasCrmPermission(currentUser.id, 'crm.assignment_rules.manage'))) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const parsed = createRuleSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.message, 400)
    }

    const data = parsed.data
    const uniqueMembers = [...new Map(data.members.map((member) => [member.employeeId, member])).values()]

    if (uniqueMembers.length > 0) {
      const employees = await prisma.employee.findMany({
        where: { id: { in: uniqueMembers.map((member) => member.employeeId) } },
        select: {
          id: true,
          user: {
            select: {
              role: true,
            },
          },
        },
      })

      if (employees.length !== uniqueMembers.length) {
        return errorResponse('One or more assignment pool employees were not found', 400)
      }

      const invalid = employees.find((employee) => employee.user.role !== UserRole.BD)
      if (invalid) {
        return errorResponse('Only BD employees can be added to an assignment pool', 400)
      }
    }

    const rule = await prisma.crmAssignmentRule.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        isActive: data.isActive,
        priority: data.priority,
        city: data.city?.trim() || null,
        category: data.category?.trim() || null,
        departmentId: data.departmentId || null,
        strategy: data.strategy,
        createdById: currentUser.id,
        updatedById: currentUser.id,
        members: uniqueMembers.length
          ? {
              create: uniqueMembers.map((member) => ({
                employeeId: member.employeeId,
                priority: member.priority,
                weight: member.weight,
                isActive: member.isActive,
              })),
            }
          : undefined,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
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

    await logCrmActivity({
      action: 'CRM_ASSIGNMENT_RULE_CREATED',
      entityType: 'CRM_ASSIGNMENT_RULE',
      entityId: rule.id,
      entityLabel: rule.name,
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      request,
      summary: `Created CRM assignment rule "${rule.name}"`,
      metadata: {
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

    return successResponse(rule, 'CRM assignment rule created successfully')
  } catch (error) {
    console.error('Error creating CRM assignment rule:', error)
    return errorResponse('Failed to create CRM assignment rule', 500)
  }
}
