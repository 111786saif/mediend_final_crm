import { EmployeeStatus, UserRole } from '@/generated/prisma/client'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { hasCrmPermission } from '@/lib/crm-permissions'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'

async function getCapabilityMap(userId: string) {
  const [canViewRules, canManageRules, canDryRun] = await Promise.all([
    hasCrmPermission(userId, 'crm.assignment_rules.view'),
    hasCrmPermission(userId, 'crm.assignment_rules.manage'),
    hasCrmPermission(userId, 'crm.assignment_dry_run.view'),
  ])

  return {
    canViewRules,
    canManageRules,
    canDryRun,
  }
}

export async function GET() {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()

    const capabilities = await getCapabilityMap(currentUser.id)
    if (!capabilities.canViewRules && !capabilities.canManageRules && !capabilities.canDryRun) {
      return errorResponse('Forbidden', 403)
    }

    const [departments, eligibleMembers] = await Promise.all([
      prisma.department.findMany({
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: 'asc',
        },
      }),
      prisma.employee.findMany({
        where: {
          status: EmployeeStatus.ACTIVE,
          user: {
            role: UserRole.BD,
          },
        },
        select: {
          id: true,
          employeeCode: true,
          circle: true,
          designation: true,
          departmentId: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          managerId: true,
          manager: {
            select: {
              id: true,
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
          user: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
        orderBy: {
          user: {
            name: 'asc',
          },
        },
      }),
    ])

    return successResponse({
      currentUser: capabilities,
      departments,
      eligibleMembers,
    })
  } catch (error) {
    console.error('Error fetching CRM assignment options:', error)
    return errorResponse('Failed to fetch CRM assignment options', 500)
  }
}
