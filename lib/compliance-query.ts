import { Prisma } from '@/generated/prisma/client'
import { stripDrPrefix } from '@/lib/lead-display'

export interface ComplianceListFilters {
  dischargeStart?: string | null
  dischargeEnd?: string | null
  hospitalName?: string | null
  surgeonName?: string | null
  bdId?: string | null
  circle?: string | null
  treatment?: string | null
  q?: string | null
}

/** Build lead-level filters shared by compliance calls list and stats. */
export function buildComplianceLeadWhere(
  filters: ComplianceListFilters,
): Prisma.LeadWhereInput | undefined {
  const leadFilters: Prisma.LeadWhereInput = {}
  const leadAnd: Prisma.LeadWhereInput[] = []

  if (filters.dischargeStart || filters.dischargeEnd) {
    const dateFilter: Prisma.DateTimeFilter = {}
    if (filters.dischargeStart) dateFilter.gte = new Date(filters.dischargeStart)
    if (filters.dischargeEnd) dateFilter.lt = new Date(filters.dischargeEnd)
    leadAnd.push({
      dischargeSheet: { dischargeDate: dateFilter },
    })
  }

  const hospitalName = filters.hospitalName?.trim() ?? ''
  if (hospitalName) {
    leadAnd.push({
      OR: [
        { hospitalName: { contains: hospitalName, mode: 'insensitive' } },
        { dischargeSheet: { hospitalName: { contains: hospitalName, mode: 'insensitive' } } },
      ],
    })
  }

  const surgeonName = filters.surgeonName?.trim() ?? ''
  if (surgeonName) {
    const core = stripDrPrefix(surgeonName)
    leadAnd.push({
      OR: [
        { surgeonName: { contains: core, mode: 'insensitive' } },
        { ipdDrName: { contains: core, mode: 'insensitive' } },
        { dischargeSheet: { doctorName: { contains: core, mode: 'insensitive' } } },
      ],
    })
  }

  const bdId = filters.bdId?.trim() ?? ''
  if (bdId) leadFilters.bdId = bdId

  const circle = filters.circle?.trim() ?? ''
  if (circle) {
    leadAnd.push({ circle: { equals: circle, mode: 'insensitive' } })
  }

  const treatment = filters.treatment?.trim() ?? ''
  if (treatment) {
    leadAnd.push({ treatment: { contains: treatment, mode: 'insensitive' } })
  }

  const q = filters.q?.trim() ?? ''
  if (q) {
    leadAnd.push({
      OR: [
        { patientName: { contains: q, mode: 'insensitive' } },
        { phoneNumber: { contains: q } },
        { leadRef: { contains: q, mode: 'insensitive' } },
      ],
    })
  }

  if (leadAnd.length > 0) leadFilters.AND = leadAnd
  if (Object.keys(leadFilters).length === 0) return undefined
  return leadFilters
}

export function buildComplianceCallWhere(
  filters: ComplianceListFilters & {
    status?: string | null
    rating?: number | null
    startDate?: string | null
    endDate?: string | null
  },
): Prisma.ComplianceCallWhereInput {
  const where: Prisma.ComplianceCallWhereInput = {}

  if (filters.status) {
    where.status = filters.status as Prisma.EnumComplianceCallStatusFilter['equals']
  }
  if (filters.rating != null && !Number.isNaN(filters.rating)) {
    where.rating = filters.rating
  }
  if (filters.startDate || filters.endDate) {
    where.createdAt = {}
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate)
    if (filters.endDate) where.createdAt.lte = new Date(filters.endDate)
  }

  const leadWhere = buildComplianceLeadWhere(filters)
  if (leadWhere) where.lead = leadWhere

  return where
}
