import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission, canCreateRole } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getComputedBalancesForEmployee } from '@/lib/hrms/leave-policy-calculator'
import { z } from 'zod'
import { Prisma } from '@/generated/prisma/client'
import { UserRole } from '@/generated/prisma/enums'
import { isTeamLeadEquivalent } from '@/lib/sales-hierarchy-roles'
import { parseEmployeeCircleList, serializeEmployeeCircleList } from '@/lib/employee-circles'

const updateEmployeeSchema = z.object({
  employeeCode: z.string().optional(),
  circle: z.string().trim().max(100).optional().nullable(),
  circles: z.array(z.string().trim().min(1).max(100)).optional(),
  joinDate: z.string().transform((str) => new Date(str)).optional().nullable(),
  salary: z.number().positive().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  teamLeadId: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
  bdNumber: z.number().int().positive().optional().nullable(),
  dateOfBirth: z.string().transform((str) => new Date(str)).optional().nullable(),
  aadharNumber: z.string().max(12).optional().nullable(),
  panNumber: z.string().max(10).optional().nullable(),
  aadharDocUrl: z.string().url().optional().nullable().or(z.literal('')),
  panDocUrl: z.string().url().optional().nullable().or(z.literal('')),
  designation: z.string().max(200).optional().nullable(),
  bankAccountName: z.string().max(100).optional().nullable(),
  bankAccountNumber: z.string().max(50).optional().nullable(),
  ifscCode: z.string().max(11).optional().nullable(),
  uanNumber: z.string().max(50).optional().nullable(),
  role: z.nativeEnum(UserRole).optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(_request)
    if (!user) return unauthorizedResponse()

    const canRead =
      hasPermission(user, 'hrms:employees:read') || hasPermission(user, 'finance:payroll:read')
    if (!canRead) return errorResponse('Forbidden', 403)

    const { id } = await params
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            phoneNumber: true,
            address: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        manager: {
          select: {
            id: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!employee) return errorResponse('Employee not found', 404)

    const [leaveBalances, documents] = await Promise.all([
      getComputedBalancesForEmployee(employee.id),
      prisma.employeeDocument.findMany({
        where: { employeeId: employee.id },
        orderBy: { generatedAt: 'desc' },
      }),
    ])

    const knowlarityRows = await prisma.$queryRaw<
      Array<{
        knowlarityPhoneNumber: string | null
        knowlarityCallerId: string | null
        knowlarityNotificationsEnabled: boolean
      }>
    >(Prisma.sql`
      SELECT
        "knowlarityPhoneNumber",
        "knowlarityCallerId",
        "knowlarityNotificationsEnabled"
      FROM "Employee"
      WHERE "id" = ${employee.id}
      LIMIT 1
    `)

    const knowlarity = knowlarityRows[0] ?? {
      knowlarityPhoneNumber: null,
      knowlarityCallerId: null,
      knowlarityNotificationsEnabled: false,
    }

    return successResponse({
      ...employee,
      ...knowlarity,
      leaveBalances: leaveBalances.map((b) => ({
        leaveTypeId: b.leaveTypeId,
        leaveTypeName: b.leaveTypeName,
        allocated: b.allocated,
        used: b.used,
        remaining: b.remaining,
      })),
      documents,
    })
  } catch (error) {
    console.error('Error fetching employee:', error)
    return errorResponse('Failed to fetch employee', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const canWriteFull = hasPermission(user, 'hrms:employees:write')
    const canWritePayrollDetails = hasPermission(user, 'finance:payroll:write')
    if (!canWriteFull && !canWritePayrollDetails) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const body = await request.json()
    const data = updateEmployeeSchema.parse(body)
    const normalizedCircles =
      data.circles !== undefined
        ? parseEmployeeCircleList(data.circles)
        : data.circle !== undefined
          ? parseEmployeeCircleList(data.circle)
          : undefined

    // Finance can only update payroll-related fields
    const payrollOnlyFields = ['joinDate', 'designation', 'panNumber', 'bankAccountName', 'bankAccountNumber', 'ifscCode', 'uanNumber']
    if (canWritePayrollDetails && !canWriteFull) {
      const disallowed = Object.keys(data).filter((k) => !payrollOnlyFields.includes(k))
      if (disallowed.length > 0) {
        return errorResponse('Only payroll details (designation, PAN, bank account, IFSC, UAN, join date) can be updated', 403)
      }
    }

    // Check if employee code is being updated and is unique
    if (data.employeeCode) {
      const existing = await prisma.employee.findFirst({
        where: {
          employeeCode: data.employeeCode,
          id: { not: id },
        },
      })

      if (existing) {
        return errorResponse('Employee code already exists', 400)
      }
    }

    // Get current employee for validation (include bdNumber/employeeCode for re-sync detection)
    const currentEmployee = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        teamId: true,
        departmentId: true,
        bdNumber: true,
        circle: true,
        employeeCode: true,
        user: {
          select: {
            id: true,
            name: true,
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

    if (!currentEmployee) {
      return errorResponse('Employee not found', 404)
    }

    if (data.bdNumber !== undefined && data.bdNumber != null) {
      const bdNumExists = await prisma.employee.findFirst({
        where: {
          bdNumber: data.bdNumber,
          id: { not: id },
        },
      })
      if (bdNumExists) {
        return errorResponse('CRM Number already assigned to another employee', 400)
      }
    }

    if (normalizedCircles !== undefined && normalizedCircles.length > 0) {
      const circles = await prisma.crmCampaignCircle.findMany({
        where: {
          name: {
            in: normalizedCircles,
          },
        },
        select: { name: true },
      })
      const foundNames = new Set(circles.map((circle) => circle.name.trim().toLowerCase()))
      const missingCircles = normalizedCircles.filter(
        (circle) => !foundNames.has(circle.trim().toLowerCase())
      )
      if (missingCircles.length > 0) {
        return errorResponse(
          missingCircles.length === 1
            ? `Selected circle "${missingCircles[0]}" was not found in CRM masters`
            : `Selected circles were not found in CRM masters: ${missingCircles.join(', ')}`,
          400
        )
      }
    }

    // Validate teamLeadId if being updated
    if (data.teamLeadId !== undefined) {
      // Validation: Department Head cannot be assigned to a team lead
      const departmentHeadRoles = ['INSURANCE_HEAD', 'PL_HEAD', 'SALES_HEAD', 'HR_HEAD', 'FINANCE_HEAD', 'MD']
      if (departmentHeadRoles.includes(currentEmployee.user.role)) {
        return errorResponse('Department heads cannot be assigned to team leads', 400)
      }

      // Validation: Team Leads / ACM cannot be assigned to other team leads
      if (isTeamLeadEquivalent(currentEmployee.user.role)) {
        return errorResponse('Team leads cannot be assigned to other team leads', 400)
      }

      // If teamLeadId is not null, validate the team lead
      if (data.teamLeadId) {
        const teamLead = await prisma.employee.findUnique({
          where: { id: data.teamLeadId },
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
        if (!currentEmployee.departmentId || !teamLead.departmentId) {
          return errorResponse('Both employee and team lead must be assigned to a department', 400)
        }

        if (currentEmployee.departmentId !== teamLead.departmentId) {
          return errorResponse('Employee and team lead must be in the same department', 400)
        }

        // Validation: Prevent circular references
        if (currentEmployee.id === teamLead.id) {
          return errorResponse('Employee cannot be assigned to themselves', 400)
        }

        // Validation: Prevent assigning to a team lead if employee is already in that team
        if (currentEmployee.teamId === teamLead.teamLeadOf.id) {
          return errorResponse('Employee is already assigned to this team lead', 400)
        }
      }
    }

    const updateData: Prisma.EmployeeUpdateInput = {}
    if (data.employeeCode !== undefined) updateData.employeeCode = data.employeeCode
    if (normalizedCircles !== undefined) {
      updateData.circle = serializeEmployeeCircleList(normalizedCircles)
    } else if (data.circle !== undefined) {
      updateData.circle = data.circle?.trim() || null
    }
    if (data.joinDate !== undefined) updateData.joinDate = data.joinDate
    if (data.salary !== undefined) updateData.salary = data.salary
    if (data.departmentId !== undefined) {
      updateData.department = data.departmentId 
        ? { connect: { id: data.departmentId } }
        : { disconnect: true }
    }
    if (data.managerId !== undefined) {
      if (data.managerId === id) {
        return errorResponse('Employee cannot be their own manager', 400)
      }
      if (data.managerId) {
        const manager = await prisma.employee.findUnique({
          where: { id: data.managerId },
        })
        if (!manager) {
          return errorResponse('Manager not found', 400)
        }
      }
    }

    if (data.managerId !== undefined) {
      updateData.manager = data.managerId
        ? { connect: { id: data.managerId } }
        : { disconnect: true }
    }
    if (data.bdNumber !== undefined) {
      updateData.bdNumber = data.bdNumber
    }
    if (data.teamLeadId !== undefined) {
      if (data.teamLeadId) {
        // Find the team that the team lead leads
        const teamLead = await prisma.employee.findUnique({
          where: { id: data.teamLeadId },
          select: {
            teamLeadOf: {
              select: {
                id: true,
              },
            },
          },
        })
        
        if (!teamLead?.teamLeadOf) {
          return errorResponse('Team lead must be assigned to lead a team', 400)
        }
        
        updateData.team = { connect: { id: teamLead.teamLeadOf.id } }
      } else {
        updateData.team = { disconnect: true }
      }
    }
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth
    if (data.aadharNumber !== undefined) updateData.aadharNumber = data.aadharNumber
    if (data.panNumber !== undefined) updateData.panNumber = data.panNumber
    if (data.aadharDocUrl !== undefined) updateData.aadharDocUrl = data.aadharDocUrl || null
    if (data.panDocUrl !== undefined) updateData.panDocUrl = data.panDocUrl || null
    if (data.designation !== undefined) updateData.designation = data.designation || null
    if (data.bankAccountName !== undefined) updateData.bankAccountName = data.bankAccountName || null
    if (data.bankAccountNumber !== undefined) updateData.bankAccountNumber = data.bankAccountNumber || null
    if (data.ifscCode !== undefined) updateData.ifscCode = data.ifscCode || null
    if (data.uanNumber !== undefined) updateData.uanNumber = data.uanNumber || null

    if (data.role !== undefined && data.role !== currentEmployee.user.role) {
      if (!hasPermission(user, 'users:write')) {
        return errorResponse('Forbidden', 403)
      }
      if (user.id === currentEmployee.user.id) {
        return errorResponse('Cannot change your own role', 400)
      }
      if (data.role === 'MD') {
        return errorResponse('Cannot assign MD role', 400)
      }
      if (currentEmployee.user.role === 'MD') {
        return errorResponse('Cannot change role of MD user', 400)
      }
      if (!canCreateRole(user, data.role)) {
        return errorResponse(`You do not have permission to assign role: ${data.role}`, 403)
      }
      updateData.user = { update: { role: data.role } }
    }

    const { clearBdNumberCache } = await import('@/lib/sync/bd-number-map')
    if (data.bdNumber !== undefined) {
      clearBdNumberCache()
    }
    const updated = await prisma.employee.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
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
      },
    })

    // Clear stale records when identifiers change. The frontend will then
    // trigger /api/employees/sync to re-populate via SyncProgressModal.
    const bdNumberChanged = data.bdNumber !== undefined && data.bdNumber !== currentEmployee.bdNumber
    if (bdNumberChanged) {
      try {
        const result = await prisma.lead.deleteMany({ where: { bdId: currentEmployee.user.id } })
        console.log(`Deleted ${result.count} leads for user ${currentEmployee.user.id} (old bdNumber: ${currentEmployee.bdNumber})`)
      } catch (err) {
        console.error('Failed to delete old leads:', err)
      }
    }

    const employeeCodeChanged = data.employeeCode !== undefined && data.employeeCode !== currentEmployee.employeeCode
    if (employeeCodeChanged) {
      try {
        const result = await prisma.attendanceLog.deleteMany({ where: { employeeId: id } })
        console.log(`Deleted ${result.count} attendance logs for employee ${id} (old code: ${currentEmployee.employeeCode})`)
      } catch (err) {
        console.error('Failed to delete old attendance:', err)
      }
    }

    return successResponse(updated, 'Employee updated successfully.')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error updating employee:', error)
    return errorResponse('Failed to update employee', 500)
  }
}
