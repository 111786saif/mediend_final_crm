import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { calculateNetPay } from '@/lib/hrms/salary-calculation'
import { z } from 'zod'

const updatePayrollSchema = z.object({
  payableDays: z.number().min(0).optional(),
  adjustedBasic: z.number().min(0).optional(),
  adjustedHra: z.number().min(0).optional(),
  adjustedMedical: z.number().min(0).optional(),
  adjustedConveyance: z.number().min(0).optional(),
  adjustedOther: z.number().min(0).optional(),
  adjustedSpecial: z.number().min(0).optional(),
  adjustedGross: z.number().min(0).optional(),
  epfEmployee: z.number().min(0).optional(),
  applyEsic: z.boolean().optional(),
  esicAmount: z.number().min(0).optional(),
  applyTds: z.boolean().optional(),
  tdsAmount: z.number().min(0).optional(),
  insurance: z.number().min(0).optional(),
  lateFines: z.number().min(0).optional(),
  netPayable: z.number().min(0).optional(),
  status: z.enum(['DRAFT', 'APPROVED', 'PAID']).optional(),
  disbursedAt: z.string().transform((s) => new Date(s)).nullable().optional(),
  paidAt: z.string().transform((s) => new Date(s)).nullable().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:payroll:read')) return errorResponse('Forbidden', 403)

    const { id } = await params
    const payroll = await prisma.monthlyPayroll.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            joinDate: true,
            designation: true,
            panNumber: true,
            bankAccountNumber: true,
            uanNumber: true,
            user: { select: { name: true, email: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
    })
    if (!payroll) return errorResponse('Payroll record not found', 404)
    return successResponse(payroll)
  } catch (error) {
    console.error('Error fetching payroll:', error)
    return errorResponse('Failed to fetch payroll', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:payroll:write')) return errorResponse('Forbidden', 403)

    const { id } = await params
    const existing = await prisma.monthlyPayroll.findUnique({ where: { id } })
    if (!existing) return errorResponse('Payroll record not found', 404)

    const body = await request.json()
    const data = updatePayrollSchema.parse(body)

    const adjustedGross = Math.round(data.adjustedGross ?? existing.adjustedGross)
    const epfEmployee = data.epfEmployee ?? existing.epfEmployee
    const esicAmount = data.applyEsic === false ? 0 : (data.esicAmount ?? existing.esicAmount)
    const applyEsic = data.applyEsic ?? existing.applyEsic
    const tdsAmount = data.applyTds === false ? 0 : (data.tdsAmount ?? existing.tdsAmount)
    const applyTds = data.applyTds ?? existing.applyTds
    const insurance = data.insurance ?? existing.insurance
    const lateFines = data.lateFines ?? existing.lateFines
    const totalDeductions = epfEmployee + esicAmount + insurance + tdsAmount + lateFines
    const netPayable =
      data.netPayable ??
      Math.max(0, Math.ceil(adjustedGross - totalDeductions))

    const finalAdjustedBasic = data.adjustedBasic ?? existing.adjustedBasic
    const epfEmployer = Math.round(finalAdjustedBasic * 0.12)

    const payroll = await prisma.monthlyPayroll.update({
      where: { id },
      data: {
        ...(data.payableDays != null && { payableDays: data.payableDays }),
        ...(data.adjustedBasic != null && { adjustedBasic: data.adjustedBasic }),
        ...(data.adjustedHra != null && { adjustedHra: data.adjustedHra }),
        ...(data.adjustedMedical != null && { adjustedMedical: data.adjustedMedical }),
        ...(data.adjustedConveyance != null && { adjustedConveyance: data.adjustedConveyance }),
        ...(data.adjustedOther != null && { adjustedOther: data.adjustedOther }),
        ...(data.adjustedSpecial != null && { adjustedSpecial: data.adjustedSpecial }),
        ...(data.adjustedGross != null && { adjustedGross: data.adjustedGross }),
        ...(data.epfEmployee != null && { epfEmployee: data.epfEmployee }),
        applyEsic,
        esicAmount,
        applyTds,
        tdsAmount,
        ...(data.insurance != null && { insurance: data.insurance }),
        ...(data.lateFines != null && { lateFines: data.lateFines }),
        totalDeductions,
        epfEmployer,
        netPayable,
        ...(data.status != null && { status: data.status }),
        ...(data.disbursedAt !== undefined && { disbursedAt: data.disbursedAt }),
        ...(data.paidAt !== undefined && { paidAt: data.paidAt }),
        ...(data.status === 'APPROVED' && { approvedById: user.id }),
        ...(data.status === 'PAID' && { paidAt: data.paidAt ?? new Date() }),
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
    return successResponse(payroll, 'Payroll updated')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error updating payroll:', error)
    return errorResponse('Failed to update payroll', 500)
  }
}
