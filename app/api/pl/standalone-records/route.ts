import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'
import { hasPlOrFinanceRead } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

type Filter = { field?: string; operator?: string; value?: unknown }

const startOfDay = (value: string | null) => value ? new Date(`${value}T00:00:00.000Z`) : undefined
const endOfDay = (value: string | null) => value ? new Date(`${value}T23:59:59.999Z`) : undefined
const valuesFor = (filters: Filter[], field: string) => {
  const value = filters.find((filter) => filter.field === field && filter.operator === 'in')?.value
  return Array.isArray(value) && value.length > 0 ? value.map(String) : undefined
}
const textFor = (filters: Filter[], field: string) => {
  const value = filters.find((filter) => filter.field === field && filter.operator === 'contains')?.value
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** Standalone Excel P&L rows have no CRM Lead yet, so they need their own read path. */
export async function GET(request: NextRequest) {
  const user = await getSessionWithFreshUser()
  if (!user) return unauthorizedResponse()
  if (!hasPlOrFinanceRead(user)) return errorResponse('Forbidden', 403)

  const { searchParams } = new URL(request.url)
  const filters: Filter[] = (() => {
    try { return JSON.parse(searchParams.get('filters') || '[]') as Filter[] } catch { return [] }
  })()
  const startDate = startOfDay(searchParams.get('startDate'))
  const endDate = endOfDay(searchParams.get('endDate'))
  const commonSearch = textFor(filters, 'commonSearch')
  const patient = textFor(filters, 'patient')
  const treatment = textFor(filters, 'treatment')
  const leadRef = textFor(filters, 'leadRef')
  const where: Record<string, unknown> = {
    leadId: null,
    ...(startDate || endDate ? { surgeryDate: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } } : {}),
    ...(valuesFor(filters, 'bdm') ? { bdmName: { in: valuesFor(filters, 'bdm') } } : {}),
    ...(valuesFor(filters, 'manager') ? { managerName: { in: valuesFor(filters, 'manager') } } : {}),
    ...(valuesFor(filters, 'status') ? { status: { in: valuesFor(filters, 'status') } } : {}),
    ...(valuesFor(filters, 'hospital') ? { hospitalName: { in: valuesFor(filters, 'hospital') } } : {}),
    ...(valuesFor(filters, 'doctor') ? { doctorName: { in: valuesFor(filters, 'doctor') } } : {}),
    ...(valuesFor(filters, 'outstandingStatus') ? { outstandingStatus: { in: valuesFor(filters, 'outstandingStatus') } } : {}),
    ...(valuesFor(filters, 'category') ? { category: { in: valuesFor(filters, 'category') } } : {}),
    ...(valuesFor(filters, 'circle') ? { circle: { in: valuesFor(filters, 'circle') } } : {}),
    ...(valuesFor(filters, 'paymentType') ? { paymentType: { in: valuesFor(filters, 'paymentType') } } : {}),
    ...(valuesFor(filters, 'implantPaidBy') ? { implantPaidBy: { in: valuesFor(filters, 'implantPaidBy') } } : {}),
    ...(valuesFor(filters, 'hospPayout') ? { hospitalPayoutStatus: { in: valuesFor(filters, 'hospPayout') } } : {}),
    ...(valuesFor(filters, 'docPayout') ? { doctorPayoutStatus: { in: valuesFor(filters, 'docPayout') } } : {}),
    ...(valuesFor(filters, 'invoice') ? { mediendInvoiceStatus: { in: valuesFor(filters, 'invoice') } } : {}),
    ...(patient ? { patientName: { contains: patient, mode: 'insensitive' } } : {}),
    ...(treatment ? { treatment: { contains: treatment, mode: 'insensitive' } } : {}),
    ...(leadRef ? { leadRef: { contains: leadRef, mode: 'insensitive' } } : {}),
  }
  if (commonSearch) {
    where.OR = ['leadRef', 'patientName', 'hospitalName', 'doctorName', 'managerName', 'bdmName', 'treatment']
      .map((field) => ({ [field]: { contains: commonSearch, mode: 'insensitive' } }))
  }

  const records = await prisma.pLRecord.findMany({ where, orderBy: [{ surgeryDate: 'desc' }, { createdAt: 'desc' }] })
  return successResponse(records.map((record) => ({
    id: `pl:${record.id}`,
    standalonePlRecord: true,
    leadRef: record.leadRef || '—',
    patientName: record.patientName || '—',
    hospitalName: record.hospitalName || '—',
    surgeryDate: record.surgeryDate,
    caseStage: 'PL_PENDING',
    createdDate: record.createdAt,
    plRecord: record,
  })))
}
