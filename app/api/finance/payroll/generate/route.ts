import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  getCalendarDaysInMonth,
  calculateProRatedSalary,
  calculateEPF,
  calculateESIC,
  calculateTDSAmount,
  calculateEPFEmployer,
  isESICApplicableByRule,
  type SalaryBreakup,
} from '@/lib/hrms/salary-calculation'

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:payroll:write')) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const { employeeId, month, year } = body
    if (!employeeId || !month || !year) {
      return errorResponse('employeeId, month, and year are required', 400)
    }

    const monthNum = Number(month)
    const yearNum = Number(year)
    if (monthNum < 1 || monthNum > 12 || !yearNum) {
      return errorResponse('Invalid month or year', 400)
    }

    const existing = await prisma.monthlyPayroll.findUnique({
      where: {
        employeeId_month_year: { employeeId, month: monthNum, year: yearNum },
      },
    })
    if (existing) {
      return errorResponse('Payroll already exists for this employee and month', 400)
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { department: true },
    })
    if (!employee) return errorResponse('Employee not found', 404)
    const bankTrim = employee.bankAccountNumber?.trim()
    const panTrim = employee.panNumber?.trim()
    if (!bankTrim || !panTrim) {
      return errorResponse('Bank account number and PAN are required to generate payroll', 400)
    }
    // Department is optional: used only for attendance timing defaults when present

    const totalDaysInMonth = getCalendarDaysInMonth(monthNum, yearNum)
    const monthStart = new Date(Date.UTC(yearNum, monthNum - 1, 1, 0, 0, 0, 0))
    const monthEnd = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59, 999))

    const salaryStructure = await prisma.salaryStructure.findFirst({
      where: { employeeId },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    })
    if (!salaryStructure) {
      return errorResponse('No salary structure found for this employee', 400)
    }

    const [leaveRequests, logs, normalizations] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: 'APPROVED',
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart },
        },
        select: { startDate: true, endDate: true, isUnpaid: true },
      }),
      prisma.attendanceLog.findMany({
        where: {
          employeeId,
          logDate: { gte: monthStart, lte: monthEnd },
        },
      }),
      prisma.attendanceNormalization.findMany({
        where: {
          employeeId,
          status: 'APPROVED',
          date: { gte: monthStart, lte: monthEnd },
        },
        select: { date: true, normalizeAs: true },
      }),
    ])

    const { groupAttendanceByDate } = await import('@/lib/hrms/attendance-utils')
    const timing = employee.department
      ? {
          shiftStartHour: employee.department.shiftStartHour,
          shiftStartMinute: employee.department.shiftStartMinute,
          grace1Minutes: employee.department.grace1Minutes,
          grace2Minutes: employee.department.grace2Minutes,
          penaltyMinutes: employee.department.penaltyMinutes,
          penaltyAmount: employee.department.penaltyAmount,
        }
      : undefined
    const grouped = groupAttendanceByDate(logs, timing)

    const normalizedByDate = new Map<string, string>()
    for (const n of normalizations) {
      const dateKey = n.date.toISOString().split('T')[0]
      const normAs = (n as { normalizeAs?: string | null }).normalizeAs
      normalizedByDate.set(dateKey, normAs === 'HALF_DAY' ? 'HALF_DAY' : 'FULL_DAY')
    }

    let fullDays = 0
    let halfDays = 0
    let lateFines = 0
    const attendedDates = new Set<string>()
    const halfDayAttendanceDates = new Set<string>()
    for (const day of grouped) {
      const dateKey = day.date.toISOString().split('T')[0]
      const normAs = normalizedByDate.get(dateKey)
      if (normAs === 'FULL_DAY') {
        attendedDates.add(dateKey)
        fullDays += 1
      } else if (normAs === 'HALF_DAY') {
        attendedDates.add(dateKey)
        halfDays += 1
      } else if (day.status === 'absent') {
        // Under min half-day hours — not added to attendedDates so paid leave can still apply
      } else if (day.isHalfDay) {
        attendedDates.add(dateKey)
        halfDayAttendanceDates.add(dateKey)
        halfDays += 1
        lateFines += day.penalty ?? 0
      } else {
        attendedDates.add(dateKey)
        fullDays += 1
        lateFines += day.penalty ?? 0
      }
    }
    const normalizedOnlyDates = new Set<string>()
    const halfDayNormOnlyDates = new Set<string>()
    for (const [dateKey, normAs] of normalizedByDate) {
      if (!attendedDates.has(dateKey)) {
        normalizedOnlyDates.add(dateKey)
        if (normAs === 'HALF_DAY') {
          halfDays += 1
          halfDayNormOnlyDates.add(dateKey)
        } else {
          fullDays += 1
        }
      }
    }

    const unpaidLeaveDays = new Set<string>()
    const paidLeaveDays = new Set<string>()
    const supplementedDates = new Set<string>()
    let paidLeaveSupplements = 0
    for (const leave of leaveRequests) {
      const start = new Date(leave.startDate)
      const end = new Date(leave.endDate)
      start.setUTCHours(0, 0, 0, 0)
      end.setUTCHours(0, 0, 0, 0)
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0]
        const [y, m] = dateKey.split('-').map(Number)
        if (m !== monthNum || y !== yearNum) continue
        if (attendedDates.has(dateKey) || normalizedOnlyDates.has(dateKey)) {
          if (
            !leave.isUnpaid &&
            !supplementedDates.has(dateKey) &&
            (halfDayAttendanceDates.has(dateKey) || halfDayNormOnlyDates.has(dateKey))
          ) {
            paidLeaveSupplements += 0.5
            supplementedDates.add(dateKey)
          }
          continue
        }
        if (leave.isUnpaid) unpaidLeaveDays.add(dateKey)
        else paidLeaveDays.add(dateKey)
      }
    }
    const unpaidLeaves = unpaidLeaveDays.size
    const paidLeaves = paidLeaveDays.size + paidLeaveSupplements

    const payableDays = Math.min(
      totalDaysInMonth,
      Math.max(0, Math.round((fullDays + halfDays * 0.5 + paidLeaves) * 100) / 100)
    )

    const breakup: SalaryBreakup = {
      basicSalary: salaryStructure.basicSalary,
      hraAllowance: (salaryStructure as { hraAllowance?: number }).hraAllowance ?? salaryStructure.basicSalary * 0.5,
      medicalAllowance: salaryStructure.medicalAllowance,
      conveyanceAllowance: salaryStructure.conveyanceAllowance,
      otherAllowance: salaryStructure.otherAllowance,
      specialAllowance: salaryStructure.specialAllowance,
      monthlyGross: salaryStructure.monthlyGross,
    }
    const proRated = calculateProRatedSalary(breakup, payableDays, totalDaysInMonth)
    const applyPf = (salaryStructure as { applyPf?: boolean }).applyPf ?? true
    const epfEmployee = applyPf ? calculateEPF(proRated.adjustedBasic) : 0
    const applyEsic = isESICApplicableByRule(salaryStructure.monthlyGross)
    const esicAmount = applyEsic
      ? calculateESIC(proRated.adjustedGross, salaryStructure.monthlyGross)
      : 0
    const applyTds = salaryStructure.applyTds
    const tdsAmount = applyTds
      ? calculateTDSAmount(
          proRated.adjustedGross,
          salaryStructure.tdsMonthly,
          salaryStructure.tdsRatePercent
        )
      : 0
    const insurance = salaryStructure.insuranceDeduction
    const totalDeductions = epfEmployee + esicAmount + insurance + tdsAmount + lateFines
    const netPayable = Math.max(
      0,
      Math.round(proRated.adjustedGross - totalDeductions)
    )
    const epfEmployer = applyPf ? calculateEPFEmployer(proRated.adjustedBasic) : 0

    const payroll = await prisma.monthlyPayroll.create({
      data: {
        employeeId,
        month: monthNum,
        year: yearNum,
        totalDaysInMonth,
        payableDays,
        unpaidLeaves,
        paidLeaves,
        halfDays,
        lateFines,
        adjustedBasic: proRated.adjustedBasic,
        adjustedHra: proRated.adjustedHra,
        adjustedMedical: proRated.adjustedMedical,
        adjustedConveyance: proRated.adjustedConveyance,
        adjustedOther: proRated.adjustedOther,
        adjustedSpecial: proRated.adjustedSpecial,
        adjustedGross: Math.round(proRated.adjustedGross),
        epfEmployee,
        applyEsic,
        esicAmount,
        applyTds,
        tdsAmount,
        insurance,
        totalDeductions,
        epfEmployer,
        netPayable,
        status: 'DRAFT',
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            user: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
    })

    return successResponse(payroll, 'Payroll generated')
  } catch (error) {
    console.error('Error generating payroll:', error)
    return errorResponse('Failed to generate payroll', 500)
  }
}
