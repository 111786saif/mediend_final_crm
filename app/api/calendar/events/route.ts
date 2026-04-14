import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import {
  errorResponse,
  successResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import {
  meetWithRelationsInclude,
  redactMeetForViewer,
  visibleMeetsForUserWhere,
} from '@/lib/meets'

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request)
    if (!session) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('targetUserId') ?? session.id
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')

    if (!fromParam || !toParam) {
      return errorResponse('from and to are required', 400)
    }
    const from = new Date(fromParam)
    const to = new Date(toParam)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return errorResponse('Invalid date range', 400)
    }

    const now = new Date()
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [meetsRaw, upcomingMeets, upcomingInterviews, statuses, employee] =
      await Promise.all([
        prisma.meet.findMany({
          where: {
            AND: [
              visibleMeetsForUserWhere(targetUserId),
              { scheduledAt: { gte: from, lte: to } },
            ],
          },
          include: meetWithRelationsInclude,
          orderBy: { scheduledAt: 'asc' },
          take: 300,
        }),
        prisma.meet.count({
          where: {
            AND: [
              visibleMeetsForUserWhere(session.id),
              { scheduledAt: { gte: now, lte: thirtyDaysAhead } },
            ],
          },
        }),
        prisma.meet.count({
          where: {
            AND: [
              visibleMeetsForUserWhere(session.id),
              { scheduledAt: { gte: now, lte: thirtyDaysAhead } },
              { module: 'INTERVIEW' },
            ],
          },
        }),
        prisma.userStatus.findMany({
          where: {
            userId: targetUserId,
            OR: [
              { startsAt: { gte: from, lte: to } },
              { endsAt: { gte: from, lte: to } },
              { AND: [{ startsAt: { lte: from } }, { endsAt: { gte: to } }] },
            ],
          },
          orderBy: { startsAt: 'asc' },
        }),
        prisma.employee.findUnique({
          where: { userId: targetUserId },
          select: { id: true },
        }),
      ])

    const meets = meetsRaw.map((m) => redactMeetForViewer(m, session.id))

    // Attendance: group biometric punches by day
    const attendance: Array<{
      date: string
      status: 'in' | 'out' | 'leave'
      inTime: string | null
      outTime: string | null
    }> = []

    if (employee) {
      const [logs, leaves] = await Promise.all([
        prisma.attendanceLog.findMany({
          where: {
            employeeId: employee.id,
            logDate: { gte: from, lte: to },
          },
          orderBy: { logDate: 'asc' },
        }),
        prisma.leaveRequest.findMany({
          where: {
            employeeId: employee.id,
            status: 'APPROVED',
            AND: [
              { startDate: { lte: to } },
              { endDate: { gte: from } },
            ],
          },
          select: { startDate: true, endDate: true },
        }),
      ])

      const byDay = new Map<string, { in: Date | null; out: Date | null; count: number }>()
      for (const log of logs) {
        const key = log.logDate.toISOString().split('T')[0]
        const bucket = byDay.get(key) ?? { in: null, out: null, count: 0 }
        if (!bucket.in || log.logDate < bucket.in) bucket.in = log.logDate
        if (!bucket.out || log.logDate > bucket.out) bucket.out = log.logDate
        bucket.count += 1
        byDay.set(key, bucket)
      }
      for (const [date, b] of byDay.entries()) {
        attendance.push({
          date,
          status: 'in',
          inTime: b.in ? b.in.toISOString() : null,
          outTime: b.count >= 2 && b.out ? b.out.toISOString() : null,
        })
      }

      const leaveDates = new Set<string>()
      for (const lr of leaves) {
        const cursor = new Date(lr.startDate)
        const end = new Date(lr.endDate)
        while (cursor <= end) {
          leaveDates.add(cursor.toISOString().split('T')[0])
          cursor.setDate(cursor.getDate() + 1)
        }
      }
      for (const d of leaveDates) {
        if (!byDay.has(d)) {
          attendance.push({ date: d, status: 'leave', inTime: null, outTime: null })
        } else {
          // If both a leave and punches exist, prefer leave label
          const existing = attendance.find((a) => a.date === d)
          if (existing) existing.status = 'leave'
        }
      }
    }

    return successResponse({
      meets,
      attendance,
      statuses,
      counts: {
        upcomingMeets,
        upcomingInterviews,
      },
    })
  } catch (error) {
    console.error('Error fetching calendar events:', error)
    return errorResponse('Failed to fetch calendar events', 500)
  }
}
