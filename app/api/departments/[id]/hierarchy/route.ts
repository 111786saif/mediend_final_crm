import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { headcountEmployeeWhere } from '@/lib/hrms/headcount'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'hrms:employees:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params

    // Get department with head
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        head: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    if (!department) {
      return errorResponse('Department not found', 404)
    }

    // Get all teams in this department
    const teams = await prisma.departmentTeam.findMany({
      where: { departmentId: id },
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
        members: {
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
      orderBy: {
        name: 'asc',
      },
    })

    // Active employees in this department (for headcount stats)
    const activeEmployees = await prisma.employee.findMany({
      where: { departmentId: id, ...headcountEmployeeWhere },
      select: { id: true, teamId: true },
    })

    // All employees in this department (for hierarchy display)
    const employees = await prisma.employee.findMany({
      where: { departmentId: id },
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
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Get employees not assigned to any team
    const unassignedEmployees = employees.filter((e) => !e.teamId)
    const activeUnassigned = activeEmployees.filter((e) => !e.teamId)

    // Build hierarchy with teams
    const hierarchy = {
      department: {
        id: department.id,
        name: department.name,
        description: department.description,
      },
      head: department.head,
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        teamLead: team.teamLead
          ? {
              id: team.teamLead.id,
              user: team.teamLead.user,
              employeeCode: team.teamLead.employeeCode,
            }
          : null,
        members: team.members.map((member) => ({
          id: member.id,
          user: member.user,
          employeeCode: member.employeeCode,
        })),
      })),
      // Employees not assigned to any team
      unassignedEmployees: unassignedEmployees.map((e) => ({
        id: e.id,
        user: e.user,
        employeeCode: e.employeeCode,
      })),
      stats: {
        totalEmployees: activeEmployees.length,
        teams: teams.length,
        unassigned: activeUnassigned.length,
      },
    }

    return successResponse(hierarchy)
  } catch (error) {
    console.error('Error fetching department hierarchy:', error)
    return errorResponse('Failed to fetch department hierarchy', 500)
  }
}
