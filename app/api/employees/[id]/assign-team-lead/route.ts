import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'
import { isTeamLeadEquivalent } from '@/lib/sales-hierarchy-roles'

const assignTeamLeadSchema = z.object({
  teamLeadId: z.string().nullable().optional(),
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

    if (!hasPermission(user, 'hrms:employees:write')) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const body = await request.json()
    const { teamLeadId } = assignTeamLeadSchema.parse(body)

    // Get the employee being assigned
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        teamId: true,
        departmentId: true,
        user: {
          select: {
            id: true,
            role: true,
          },
        },
        department: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!employee) {
      return errorResponse('Employee not found', 404)
    }

    // Validation: Department Head cannot be assigned to a team lead
    const departmentHeadRoles = ['INSURANCE_HEAD', 'PL_HEAD', 'SALES_HEAD', 'HR_HEAD', 'FINANCE_HEAD', 'MD']
    if (departmentHeadRoles.includes(employee.user.role)) {
      return errorResponse('Department heads cannot be assigned to team leads', 400)
    }

    // Validation: Team Leads / ACM cannot be assigned to other team leads
    if (isTeamLeadEquivalent(employee.user.role)) {
      return errorResponse('Team leads cannot be assigned to other team leads', 400)
    }

    // If teamLeadId is null, just remove the assignment
    if (!teamLeadId) {
      const updated = await prisma.employee.update({
        where: { id },
        data: {
          teamId: null,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          team: {
            include: {
              teamLead: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      role: true,
                    },
                  },
                },
              },
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      return successResponse(updated, 'Team lead assignment removed successfully')
    }

    // Get the team lead being assigned
    const teamLead = await prisma.employee.findUnique({
      where: { id: teamLeadId },
      include: {
        user: {
          select: {
            id: true,
            role: true,
          },
        },
        department: {
          select: {
            id: true,
          },
        },
        teamLeadOf: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!teamLead) {
      return errorResponse('Team lead not found', 404)
    }

    // Validation: Team lead must have TEAM_LEAD or ACM role
    if (!isTeamLeadEquivalent(teamLead.user.role)) {
      return errorResponse('Assigned employee must have TEAM_LEAD or ACM role', 400)
    }

    // Validation: Team lead must be leading a team
    if (!teamLead.teamLeadOf) {
      return errorResponse('Team lead must be assigned to lead a team', 400)
    }

    // Validation: Employee and team lead must be in the same department
    if (!employee.departmentId || !teamLead.departmentId) {
      return errorResponse('Both employee and team lead must be assigned to a department', 400)
    }

    if (employee.departmentId !== teamLead.departmentId) {
      return errorResponse('Employee and team lead must be in the same department', 400)
    }

    // Validation: Prevent circular references (team lead can't be assigned to themselves)
    if (employee.id === teamLead.id) {
      return errorResponse('Employee cannot be assigned to themselves', 400)
    }

    // Validation: Prevent assigning to a team lead that is already a member of this employee's team
    // Check if the employee is already in the team that the team lead leads
    if (employee.teamId === teamLead.teamLeadOf.id) {
      return errorResponse('Employee is already assigned to this team lead', 400)
    }

    // Update the employee's teamId to the team that the team lead leads
    const updated = await prisma.employee.update({
      where: { id },
      data: {
        teamId: teamLead.teamLeadOf.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        team: {
          include: {
            teamLead: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                  },
                },
              },
            },
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return successResponse(updated, 'Team lead assigned successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error assigning team lead:', error)
    return errorResponse('Failed to assign team lead', 500)
  }
}
