import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { differenceInCalendarDays } from 'date-fns'

const UPCOMING_WINDOW_DAYS = 14

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function nextBirthdayOnOrAfter(dob: Date, from: Date): Date {
  const next = new Date(from.getFullYear(), dob.getMonth(), dob.getDate())
  if (next < from) {
    next.setFullYear(next.getFullYear() + 1)
  }
  return next
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    const upcoming = request.nextUrl.searchParams.get('upcoming') === 'true'
    if (upcoming && !hasPermission(user, 'hrms:employees:read')) {
      return errorResponse('Forbidden', 403)
    }
    const today = startOfLocalDay(new Date())

    const employees = await prisma.employee.findMany({
      where: {
        dateOfBirth: { not: null },
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        department: {
          select: { name: true },
        },
      },
    })

    if (!upcoming) {
      const month = today.getMonth()
      const day = today.getDate()
      const birthdaysToday = employees.filter((emp) => {
        const dob = new Date(emp.dateOfBirth!)
        return dob.getMonth() === month && dob.getDate() === day
      })

      return successResponse(
        birthdaysToday.map((emp) => ({
          id: emp.id,
          userId: emp.userId,
          name: emp.user.name,
          dateOfBirth: emp.dateOfBirth!.toISOString(),
        }))
      )
    }

    const upcomingBirthdays = employees
      .map((emp) => {
        const dob = new Date(emp.dateOfBirth!)
        const next = nextBirthdayOnOrAfter(dob, today)
        const daysUntil = differenceInCalendarDays(next, today)
        return {
          id: emp.id,
          userId: emp.userId,
          name: emp.user.name,
          dateOfBirth: emp.dateOfBirth!.toISOString(),
          birthdayOn: next.toISOString(),
          daysUntil,
          department: emp.department?.name ?? null,
        }
      })
      .filter((item) => item.daysUntil >= 1 && item.daysUntil <= UPCOMING_WINDOW_DAYS)
      .sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name))

    return successResponse(upcomingBirthdays)
  } catch (error) {
    console.error('Error fetching birthdays:', error)
    return errorResponse('Failed to fetch birthdays', 500)
  }
}
