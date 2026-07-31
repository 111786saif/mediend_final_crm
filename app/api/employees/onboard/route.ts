import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { ExperienceType, UserRole } from '@/generated/prisma/enums'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission, canCreateRole } from '@/lib/rbac'
import { hashPassword } from '@/lib/auth'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { sendOnboardingInviteEmail } from '@/lib/resend'
import { z } from 'zod'

const employeeSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  /** Personal inbox for welcome/login credentials email (often Gmail). */
  personalEmail: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(UserRole),
  employeeCode: z.string().min(1),
  experienceType: z.nativeEnum(ExperienceType),
  bdNumber: z.number().int().positive().optional().nullable(),
  circle: z.string().trim().max(100).optional().nullable(),
  departmentId: z.string().optional().nullable(),
  managerId: z.string().nullable().optional(),
  joinDate: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
})

const onboardSchema = z.object({
  employees: z.array(employeeSchema).min(1).max(50),
  /** Send login credentials + portal link + onboarding checklist to personalEmail. */
  sendInviteEmail: z.boolean().optional().default(true),
})

export async function POST(request: NextRequest) {
  try {
    const sessionUser = getSessionFromRequest(request)
    if (!sessionUser) return unauthorizedResponse()
    if (!hasPermission(sessionUser, 'users:write')) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const { employees: employeesData, sendInviteEmail } = onboardSchema.parse(body)

    const results: Array<{
      employeeId: string
      userId: string
      name: string
      email: string
      personalEmail: string
      employeeCode: string
      bdNumber: number | null
      experienceType: ExperienceType
      inviteEmailSent?: boolean
      inviteEmailError?: string
    }> = []
    const errors: Array<{ index: number; name: string; error: string }> = []

    for (let i = 0; i < employeesData.length; i++) {
      const data = employeesData[i]
      try {
        if (data.role === 'MD' as any) {
          errors.push({ index: i, name: data.name, error: 'MD role cannot be created' })
          continue
        }
        if (!canCreateRole(sessionUser, data.role)) {
          errors.push({ index: i, name: data.name, error: `No permission to create role: ${data.role}` })
          continue
        }

        const normalizedEmail = data.email.toLowerCase().trim()
        const normalizedPersonalEmail = data.personalEmail.toLowerCase().trim()

        const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } })
        if (existingUser) {
          errors.push({ index: i, name: data.name, error: 'Login email already exists' })
          continue
        }

        const codeExists = await prisma.employee.findUnique({ where: { employeeCode: data.employeeCode.trim() } })
        if (codeExists) {
          errors.push({ index: i, name: data.name, error: 'Employee code already exists' })
          continue
        }

        if (data.bdNumber != null) {
          const bdNumExists = await prisma.employee.findUnique({ where: { bdNumber: data.bdNumber } })
          if (bdNumExists) {
            errors.push({ index: i, name: data.name, error: 'CRM Number already assigned to another employee' })
            continue
          }
        }

        if (data.managerId) {
          const manager = await prisma.employee.findUnique({ where: { id: data.managerId } })
          if (!manager) {
            errors.push({ index: i, name: data.name, error: 'Manager not found' })
            continue
          }
        }

        if (data.circle) {
          const circle = await prisma.crmCampaignCircle.findFirst({
            where: { name: data.circle.trim() },
            select: { id: true },
          })
          if (!circle) {
            errors.push({ index: i, name: data.name, error: 'Selected circle was not found in CRM masters' })
            continue
          }
        }

        const passwordHash = await hashPassword(data.password)

        const result = await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              email: normalizedEmail,
              passwordHash,
              name: data.name,
              role: data.role,
            },
          })

          const employee = await tx.employee.create({
            data: {
              userId: newUser.id,
              employeeCode: data.employeeCode.trim(),
              departmentId: data.departmentId || null,
              managerId: data.managerId ?? null,
              bdNumber: data.bdNumber ?? null,
              circle: data.circle?.trim() || null,
              joinDate: data.joinDate ? new Date(data.joinDate) : null,
              dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
              experienceType: data.experienceType,
              personalEmail: normalizedPersonalEmail,
              onboardingStatus: 'PENDING_PROFILE',
            },
          })

          return { userId: newUser.id, employeeId: employee.id }
        })

        const created = {
          employeeId: result.employeeId,
          userId: result.userId,
          name: data.name,
          email: normalizedEmail,
          personalEmail: normalizedPersonalEmail,
          employeeCode: data.employeeCode.trim(),
          bdNumber: data.bdNumber ?? null,
          experienceType: data.experienceType,
          inviteEmailSent: false as boolean | undefined,
          inviteEmailError: undefined as string | undefined,
        }

        if (sendInviteEmail) {
          try {
            const emailResult = await sendOnboardingInviteEmail({
              to: normalizedPersonalEmail,
              name: data.name,
              email: normalizedEmail,
              password: data.password,
              employeeCode: data.employeeCode.trim(),
              experienceType: data.experienceType,
            })
            created.inviteEmailSent = emailResult.success
            if (!emailResult.success) {
              created.inviteEmailError = emailResult.error || 'Failed to send invite email'
              console.error(`Onboarding invite email failed for ${normalizedPersonalEmail}:`, emailResult.error)
            }
          } catch (emailErr) {
            created.inviteEmailSent = false
            created.inviteEmailError =
              emailErr instanceof Error ? emailErr.message : 'Failed to send invite email'
            console.error(`Onboarding invite email failed for ${normalizedPersonalEmail}:`, emailErr)
          }
        }

        results.push(created)
      } catch (err) {
        const msg = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
          ? 'Duplicate unique field'
          : (err instanceof Error ? err.message : 'Unknown error')
        errors.push({ index: i, name: data.name, error: msg })
      }
    }

    if (results.length > 0) {
      const { clearBdNumberCache } = await import('@/lib/sync/bd-number-map')
      clearBdNumberCache()

      // Notify finance heads about new employees
      try {
        const financeHeads = await prisma.user.findMany({
          where: { role: 'FINANCE_HEAD' },
          select: { id: true },
        })

        if (financeHeads.length > 0) {
          const names = results.map((r) => r.name)
          const message = names.length === 1
            ? `${names[0]} has been onboarded. Please set up their payroll structure.`
            : `${names.length} employees onboarded (${names.slice(0, 3).join(', ')}${names.length > 3 ? '...' : ''}). Please set up their payroll structures.`

          await prisma.notification.createMany({
            data: financeHeads.map((fh) => ({
              userId: fh.id,
              type: 'EMPLOYEE_ONBOARDED',
              title: 'New Employee Onboarded',
              message,
              link: '/finance/payroll',
            })),
          })
        }
      } catch (notifErr) {
        console.error('Failed to send finance notifications:', notifErr)
      }
    }

    return successResponse({
      created: results,
      errors,
      summary: {
        total: employeesData.length,
        success: results.length,
        failed: errors.length,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(`Invalid request data: ${error.errors.map((e) => e.message).join(', ')}`, 400)
    }
    console.error('Error onboarding employees:', error)
    return errorResponse('Failed to onboard employees', 500)
  }
}
