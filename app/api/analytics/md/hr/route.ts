import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

const SLA_HOURS = 48

function isLate(
  punchDate: Date,
  shiftStartHour: number,
  shiftStartMinute: number,
  grace1Minutes: number
): { late: boolean; minutesLate: number } {
  const cutoffTotalMinutes = shiftStartHour * 60 + shiftStartMinute + grace1Minutes
  const punchTotalMinutes = punchDate.getUTCHours() * 60 + punchDate.getUTCMinutes()
  const minutesLate = punchTotalMinutes - cutoffTotalMinutes
  return { late: minutesLate > 0, minutesLate: Math.max(0, minutesLate) }
}

function formatPunchTime(d: Date): string {
  const h = String(d.getUTCHours()).padStart(2, '0')
  const m = String(d.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return unauthorizedResponse()
    }

    if (user.role !== 'MD' && user.role !== 'ADMIN' && user.role !== 'HR_HEAD' && user.role !== 'EXECUTIVE_ASSISTANT') {
      return errorResponse(`Forbidden: Access denied for role ${user.role}.`, 403)
    }

    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month')
    const yearParam = searchParams.get('year')

    const now = new Date()
    const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1
    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear()

    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999))

    // All employees with shift timing details
    const allEmployees = await prisma.employee.findMany({
      include: {
        user: { select: { id: true, name: true } },
        department: {
          select: {
            id: true,
            name: true,
            shiftStartHour: true,
            shiftStartMinute: true,
            grace1Minutes: true,
          },
        },
        team: { select: { id: true, name: true } },
      },
    })

    const totalHeadcount = allEmployees.length
    const employeeIds = allEmployees.map((e) => e.id)
    const employeeMap = new Map(allEmployees.map((e) => [e.id, e]))

    // Today's IN punches (one per employee - earliest)
    const todayPunchRows = await prisma.attendanceLog.findMany({
      where: {
        employeeId: { in: employeeIds },
        logDate: { gte: todayStart, lte: todayEnd },
        punchDirection: 'IN',
      },
      select: { employeeId: true, logDate: true },
      orderBy: { logDate: 'asc' },
    })

    // Dedupe: first punch per employee today
    const firstPunchToday = new Map<string, Date>()
    for (const row of todayPunchRows) {
      if (!firstPunchToday.has(row.employeeId)) {
        firstPunchToday.set(row.employeeId, row.logDate)
      }
    }

    const todayStrength = firstPunchToday.size

    // Absent today: employees with no punch
    const presentIds = new Set(firstPunchToday.keys())
    const absentToday = allEmployees
      .filter((e) => !presentIds.has(e.id))
      .map((e) => ({
        employeeName: e.user.name,
        employeeCode: e.employeeCode,
        departmentName: e.department?.name || 'No Department',
      }))
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName))

    // Latecomers today
    const latecomersToday: Array<{
      employeeId: string
      employeeName: string
      employeeCode: string
      departmentName: string
      punchTime: string
      minutesLate: number
    }> = []

    for (const [empId, punchDate] of firstPunchToday.entries()) {
      const emp = employeeMap.get(empId)
      if (!emp) continue
      const dept = emp.department
      const shiftHour = dept?.shiftStartHour ?? 10
      const shiftMin = dept?.shiftStartMinute ?? 0
      const grace = dept?.grace1Minutes ?? 15
      const { late, minutesLate } = isLate(punchDate, shiftHour, shiftMin, grace)
      if (late) {
        latecomersToday.push({
          employeeId: empId,
          employeeName: emp.user.name,
          employeeCode: emp.employeeCode,
          departmentName: dept?.name || 'No Department',
          punchTime: formatPunchTime(punchDate),
          minutesLate,
        })
      }
    }
    latecomersToday.sort((a, b) => b.minutesLate - a.minutesLate)

    // Pending leave requests
    const pendingLeaveCount = await prisma.leaveRequest.count({
      where: { status: 'PENDING' },
    })

    // New joiners this month
    const newJoinerEmployees = allEmployees.filter((e) => {
      if (!e.joinDate) return false
      return e.joinDate >= monthStart && e.joinDate <= monthEnd
    })
    const newJoiners = newJoinerEmployees.map((e) => ({
      employeeName: e.user.name,
      employeeCode: e.employeeCode,
      departmentName: e.department?.name || 'No Department',
      joinDate: e.joinDate!.toISOString().split('T')[0],
    }))

    // MonthlyPayroll for selected month
    const payrolls = await prisma.monthlyPayroll.findMany({
      where: { employeeId: { in: employeeIds }, month, year },
      include: {
        employee: {
          include: {
            department: { select: { name: true } },
          },
        },
      },
    })

    const payrollByDept = new Map<string, number>()
    let totalMonthlySalary = 0

    payrolls.forEach((p) => {
      totalMonthlySalary += p.netPayable
      const deptName = p.employee.department?.name || 'No Department'
      payrollByDept.set(deptName, (payrollByDept.get(deptName) || 0) + p.netPayable)
    })

    // Fallback: SalaryStructure when no payroll
    if (payrolls.length === 0) {
      const structures = await prisma.salaryStructure.findMany({
        where: {
          employeeId: { in: employeeIds },
          effectiveFrom: { lte: monthEnd },
          OR: [
            { effectiveTo: { equals: null } },
            { effectiveTo: { gte: monthStart } },
          ],
        },
        include: {
          employee: {
            include: {
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { effectiveFrom: 'desc' },
      })

      const seen = new Set<string>()
      structures.forEach((s) => {
        if (seen.has(s.employeeId)) return
        seen.add(s.employeeId)
        const monthly = s.annualCtc / 12
        totalMonthlySalary += monthly
        const deptName = s.employee.department?.name || 'No Department'
        payrollByDept.set(deptName, (payrollByDept.get(deptName) || 0) + monthly)
      })
    }

    const departmentSalaryBreakdown = Array.from(payrollByDept.entries())
      .map(([name, amount]) => ({ departmentName: name, amount }))
      .sort((a, b) => b.amount - a.amount)

    // Department-wise headcount
    const headcountByDept = new Map<string, number>()
    allEmployees.forEach((e) => {
      const deptName = e.department?.name || 'No Department'
      headcountByDept.set(deptName, (headcountByDept.get(deptName) || 0) + 1)
    })
    const departmentHeadcount = Array.from(headcountByDept.entries())
      .map(([name, count]) => ({ departmentName: name, count }))
      .sort((a, b) => b.count - a.count)

    // Monthly late arrivals — all IN punches in selected month
    const monthlyPunches = await prisma.attendanceLog.findMany({
      where: {
        employeeId: { in: employeeIds },
        logDate: { gte: monthStart, lte: monthEnd },
        punchDirection: 'IN',
      },
      select: { employeeId: true, logDate: true },
      orderBy: { logDate: 'asc' },
    })

    // Dedupe: first punch per employee per day
    const firstPunchPerDay = new Map<string, Date>() // key: empId-dateStr
    for (const row of monthlyPunches) {
      const dayKey = `${row.employeeId}-${row.logDate.toISOString().split('T')[0]}`
      if (!firstPunchPerDay.has(dayKey)) {
        firstPunchPerDay.set(dayKey, row.logDate)
      }
    }

    const monthlyLateMap = new Map<string, number>()
    for (const [key, punchDate] of firstPunchPerDay.entries()) {
      const empId = key.split('-')[0]
      const emp = employeeMap.get(empId)
      if (!emp) continue
      const dept = emp.department
      const shiftHour = dept?.shiftStartHour ?? 10
      const shiftMin = dept?.shiftStartMinute ?? 0
      const grace = dept?.grace1Minutes ?? 15
      const { late } = isLate(punchDate, shiftHour, shiftMin, grace)
      if (late) {
        monthlyLateMap.set(empId, (monthlyLateMap.get(empId) || 0) + 1)
      }
    }

    const monthlyLateArrivals = Array.from(monthlyLateMap.entries())
      .map(([empId, lateCount]) => {
        const emp = employeeMap.get(empId)!
        return {
          employeeId: empId,
          employeeName: emp.user.name,
          employeeCode: emp.employeeCode,
          departmentName: emp.department?.name || 'No Department',
          lateCount,
        }
      })
      .sort((a, b) => b.lateCount - a.lateCount)

    // SupportTicket stats for the month
    const supportTickets = await prisma.supportTicket.findMany({
      where: { createdAt: { gte: monthStart, lte: monthEnd } },
      select: { id: true, status: true, targetHeadRole: true, createdAt: true, respondedAt: true },
    })
    const openSupportTickets = await prisma.supportTicket.count({
      where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
    })
    const resolvedSupportTickets = supportTickets.filter((t) => t.respondedAt != null)
    const supportResponseTimes = resolvedSupportTickets
      .map((t) => (t.respondedAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60))
      .filter((h) => h >= 0)
    const avgSupportResponseHours =
      supportResponseTimes.length > 0
        ? supportResponseTimes.reduce((a, b) => a + b, 0) / supportResponseTimes.length
        : null
    const supportSlaCompliant = resolvedSupportTickets.filter(
      (t) => (t.respondedAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60) <= SLA_HOURS
    ).length
    const supportSlaPercent =
      resolvedSupportTickets.length > 0
        ? (supportSlaCompliant / resolvedSupportTickets.length) * 100
        : null

    // MentalHealthRequest stats
    const mentalHealthRequests = await prisma.mentalHealthRequest.findMany({
      where: { createdAt: { gte: monthStart, lte: monthEnd } },
      select: { id: true, status: true, createdAt: true, respondedAt: true },
    })
    const pendingMentalHealth = await prisma.mentalHealthRequest.count({
      where: { status: 'PENDING' },
    })
    const resolvedMentalHealth = mentalHealthRequests.filter((r) => r.respondedAt != null)
    const mentalHealthResponseTimes = resolvedMentalHealth
      .map((r) => (r.respondedAt!.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60))
      .filter((h) => h >= 0)
    const avgMentalHealthResponseHours =
      mentalHealthResponseTimes.length > 0
        ? mentalHealthResponseTimes.reduce((a, b) => a + b, 0) / mentalHealthResponseTimes.length
        : null
    const mentalHealthSlaCompliant = resolvedMentalHealth.filter(
      (r) => (r.respondedAt!.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60) <= SLA_HOURS
    ).length
    const mentalHealthSlaPercent =
      resolvedMentalHealth.length > 0
        ? (mentalHealthSlaCompliant / resolvedMentalHealth.length) * 100
        : null

    // MDAppointment stats
    const mdAppointments = await prisma.mDAppointment.findMany({
      where: { createdAt: { gte: monthStart, lte: monthEnd } },
      select: { id: true, status: true, createdAt: true },
    })

    const openTicketsCount = openSupportTickets + pendingMentalHealth
    const allResponseTimes = [...supportResponseTimes, ...mentalHealthResponseTimes]
    const avgTicketResponseHours =
      allResponseTimes.length > 0
        ? allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length
        : null

    const ticketAnalytics = [
      {
        type: 'Support Tickets',
        targetRole: 'HR_HEAD',
        totalInMonth: supportTickets.length,
        resolvedCount: resolvedSupportTickets.length,
        avgResponseHours: avgSupportResponseHours,
        slaCompliancePercent: supportSlaPercent,
      },
      {
        type: 'Mental Health',
        targetRole: null,
        totalInMonth: mentalHealthRequests.length,
        resolvedCount: resolvedMentalHealth.length,
        avgResponseHours: avgMentalHealthResponseHours,
        slaCompliancePercent: mentalHealthSlaPercent,
      },
      {
        type: 'MD Appointments',
        targetRole: null,
        totalInMonth: mdAppointments.length,
        resolvedCount: mdAppointments.filter((a) => a.status !== 'PENDING').length,
        avgResponseHours: null,
        slaCompliancePercent: null,
      },
    ]

    return successResponse({
      kpis: {
        todayStrength,
        totalHeadcount,
        monthlySalaryOutgo: totalMonthlySalary,
        openTicketsCount,
        avgTicketResponseHours,
        pendingLeaveCount,
        hasPayrollData: payrolls.length > 0,
        latecomersCountToday: latecomersToday.length,
        absentCountToday: absentToday.length,
        newJoinersCount: newJoiners.length,
      },
      departmentSalaryBreakdown,
      departmentHeadcount,
      ticketAnalytics,
      latecomersToday,
      monthlyLateArrivals,
      absentToday,
      newJoiners,
      month,
      year,
    })
  } catch (error) {
    console.error('Error fetching HR analytics:', error)
    return errorResponse('Failed to fetch HR analytics', 500)
  }
}
