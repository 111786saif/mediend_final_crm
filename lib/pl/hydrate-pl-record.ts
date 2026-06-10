import type { Prisma } from '@/generated/prisma/client'

/**
 * Prisma include for fetching a Lead with every relation needed to hydrate
 * a DischargeSheet / PLRecord. Use in any API route or script that will
 * call the helpers below.
 */
export const LEAD_HYDRATE_INCLUDE = {
  bd: {
    include: {
      employee: {
        include: {
          team: {
            include: {
              teamLead: { include: { user: { select: { name: true } } } },
              department: { include: { head: { select: { name: true } } } },
            },
          },
          manager: {
            select: {
              user: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  },
  admissionRecord: true,
  kypSubmission: {
    select: {
      preAuthData: {
        select: {
          requestedHospitalName: true,
          suggestedHospitals: {
            select: {
              hospitalName: true,
              suggestedDoctor: true,
            },
          },
        },
      },
    },
  },
} as const

export type LeadWithHydrate = Prisma.LeadGetPayload<{
  include: typeof LEAD_HYDRATE_INCLUDE
}>

type AnyRecord = Record<string, unknown>

const PLACEHOLDER_VALUES = new Set(['not specified', 'n/a', 'na', 'none', 'null', '-', '--', 'tbd'])

function pickFirst<T>(...values: Array<T | null | undefined>): T | null {
  for (const v of values) {
    if (v === null || v === undefined || v === '') continue
    if (typeof v === 'string' && PLACEHOLDER_VALUES.has(v.toLowerCase())) continue
    return v
  }
  return null
}

function pickFirstNumber(...values: Array<unknown>): number {
  for (const v of values) {
    if (v === null || v === undefined) continue
    const n = typeof v === 'number' ? v : Number(v)
    if (!Number.isNaN(n) && n !== 0) return n
  }
  // Return 0 if nothing found / all zeros — preserves existing semantics for
  // fields that default to 0 on the schema.
  return 0
}

function resolveManagerName(lead: LeadWithHydrate | null | undefined): string | null {
  if (!lead?.bd) return null
  const bd = lead.bd as AnyRecord
  const employee = bd.employee as AnyRecord | null | undefined
  const team = employee?.team as AnyRecord | null | undefined
  const teamLead = team?.teamLead as AnyRecord | null | undefined
  const teamLeadUser = teamLead?.user as AnyRecord | null | undefined
  const department = team?.department as AnyRecord | null | undefined
  const departmentHead = department?.head as AnyRecord | null | undefined
  const manager = employee?.manager as AnyRecord | null | undefined
  const managerUser = manager?.user as AnyRecord | null | undefined
  return (
    (teamLeadUser?.name as string | undefined) ??
    (departmentHead?.name as string | undefined) ??
    (managerUser?.name as string | undefined) ??
    null
  )
}

function resolvePreAuth(lead: LeadWithHydrate | null | undefined): {
  hospital: string | null
  doctor: string | null
} {
  const kyp = (lead as AnyRecord | undefined)?.kypSubmission as AnyRecord | undefined
  const preAuth = kyp?.preAuthData as AnyRecord | undefined
  if (!preAuth) return { hospital: null, doctor: null }
  const hospital =
    (preAuth.requestedHospitalName as string | undefined) ??
    (preAuth.hospitalNameSuggestion as string | undefined) ??
    null
  const suggestions =
    (preAuth.suggestedHospitals as Array<AnyRecord> | undefined) ?? []
  const matched = hospital
    ? suggestions.find((s) => (s.hospitalName as string | undefined) === hospital)
    : undefined
  const doctor = (matched?.suggestedDoctor as string | undefined) ?? null
  const firstSuggested = suggestions[0]
  return {
    hospital: hospital ?? (firstSuggested?.hospitalName as string | undefined) ?? null,
    doctor: doctor ?? (firstSuggested?.suggestedDoctor as string | undefined) ?? null,
  }
}

function firstOfMonth(d: Date | null | undefined): Date | null {
  if (!d) return null
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/**
 * Compute the default DischargeSheet people/case/date fields from a Lead.
 * Caller should spread these, then overwrite with whatever the client sent:
 *
 *    const data = { ...buildDischargeSheetDefaults(lead), ...clientProvided }
 *
 * All fields are optional. Returns nulls where no value is known — Prisma
 * will accept those for nullable columns.
 */
export function buildDischargeSheetDefaults(lead: LeadWithHydrate) {
  const admission = lead.admissionRecord
  const leadSource = lead.source ?? (lead.leadSource != null ? String(lead.leadSource) : null)
  const preAuth = resolvePreAuth(lead)
  return {
    month: firstOfMonth(new Date()),
    admissionDate: admission?.admissionDate ?? lead.arrivalDate ?? null,
    surgeryDate: admission?.surgeryDate ?? lead.surgeryDate ?? null,
    managerName: resolveManagerName(lead),
    bdmName: lead.bd?.name ?? null,
    patientName: lead.patientName ?? null,
    patientPhone: lead.phoneNumber ?? null,
    doctorName: preAuth.doctor ?? lead.ipdDrName ?? lead.surgeonName ?? null,
    hospitalName: preAuth.hospital ?? lead.hospitalName ?? null,
    category: lead.category ?? null,
    treatment: lead.treatment ?? null,
    circle: lead.circle ?? null,
    leadSource,
  }
}

type DischargeSheetLike = AnyRecord | null | undefined

type BuildPlRecordArgs = {
  lead: LeadWithHydrate
  dischargeSheet?: DischargeSheetLike
  userId: string
  overrides?: AnyRecord
}

/**
 * Build a fully-hydrated PLRecord create payload by merging values from
 * (in priority order): overrides > dischargeSheet > lead > admissionRecord.
 *
 * The returned object is shaped as Prisma.PLRecordUncheckedCreateInput so the
 * caller can pass it straight into `prisma.pLRecord.create({ data })`.
 *
 * Pure function — no DB access inside.
 */
export function buildPlRecordPayload(
  args: BuildPlRecordArgs
): Prisma.PLRecordUncheckedCreateInput {
  const { lead, dischargeSheet: dsRaw, userId, overrides = {} } = args
  const ds = (dsRaw ?? {}) as AnyRecord
  const admission = lead.admissionRecord
  const ov = overrides

  const managerName =
    (ov.managerName as string | undefined) ??
    (ds.managerName as string | undefined) ??
    resolveManagerName(lead) ??
    null

  const leadSourceFromLead =
    lead.source ?? (lead.leadSource != null ? String(lead.leadSource) : null)

  const preAuth = resolvePreAuth(lead)

  const payload: Prisma.PLRecordUncheckedCreateInput = {
    leadId: lead.id,

    // Core Identification
    month: pickFirst(
      ov.month as Date | undefined,
      ds.month as Date | undefined,
      firstOfMonth((ds.surgeryDate as Date | undefined) ?? lead.surgeryDate) ?? firstOfMonth(new Date())
    ),
    admissionDate: pickFirst(
      ov.admissionDate as Date | undefined,
      ds.admissionDate as Date | undefined,
      admission?.admissionDate ?? undefined,
      lead.arrivalDate ?? undefined
    ),
    surgeryDate: pickFirst(
      ov.surgeryDate as Date | undefined,
      ds.surgeryDate as Date | undefined,
      admission?.surgeryDate ?? undefined,
      lead.surgeryDate ?? undefined
    ),
    status: pickFirst(
      ov.status as string | undefined,
      ds.status as string | undefined,
      'DISCHARGED'
    ),
    paymentType: pickFirst(
      ov.paymentType as string | undefined,
      ds.paymentType as string | undefined
    ),
    approvedOrCash: pickFirst(
      ov.approvedOrCash as string | undefined,
      ds.approvedOrCash as string | undefined
    ),
    paymentCollectedAt: pickFirst(
      ov.paymentCollectedAt as string | undefined,
      ds.paymentCollectedAt as string | undefined
    ),

    // People & Ownership
    managerRole: pickFirst(
      ov.managerRole as string | undefined,
      ds.managerRole as string | undefined
    ),
    managerName,
    bdmName: pickFirst(
      ov.bdmName as string | undefined,
      ds.bdmName as string | undefined,
      lead.bd?.name
    ),
    patientName: pickFirst(
      ov.patientName as string | undefined,
      ds.patientName as string | undefined,
      lead.patientName
    ),
    patientPhone: pickFirst(
      ov.patientPhone as string | undefined,
      ds.patientPhone as string | undefined,
      lead.phoneNumber
    ),
    doctorName: pickFirst(
      ov.doctorName as string | undefined,
      ds.doctorName as string | undefined,
      preAuth.doctor,
      lead.ipdDrName,
      lead.surgeonName
    ),
    hospitalName: pickFirst(
      ov.hospitalName as string | undefined,
      ds.hospitalName as string | undefined,
      preAuth.hospital,
      lead.hospitalName
    ),

    // Case Details
    category: pickFirst(
      ov.category as string | undefined,
      ds.category as string | undefined,
      lead.category
    ),
    treatment: pickFirst(
      ov.treatment as string | undefined,
      ds.treatment as string | undefined,
      lead.treatment
    ),
    circle: pickFirst(
      ov.circle as string | undefined,
      ds.circle as string | undefined,
      lead.circle
    ),
    leadSource: pickFirst(
      ov.leadSource as string | undefined,
      ds.leadSource as string | undefined,
      leadSourceFromLead
    ),

    // Financials
    totalAmount: pickFirstNumber(
      ov.totalAmount,
      ds.totalAmount,
      ds.finalApprovedAmount
    ),
    billAmount: pickFirstNumber(
      ov.billAmount,
      ds.billAmount,
      ds.totalFinalBill,
      lead.billAmount
    ),
    cashPaidByPatient: pickFirstNumber(ov.cashPaidByPatient, ds.cashPaidByPatient),
    cashOrDedPaid: pickFirstNumber(
      ov.cashOrDedPaid,
      ds.cashOrDedPaid,
      ds.deductionAmount,
      lead.deduction
    ),
    referralAmount: pickFirstNumber(ov.referralAmount, ds.referralAmount),
    cabCharges: pickFirstNumber(ov.cabCharges, ds.cabCharges),
    implantCost: pickFirstNumber(ov.implantCost, ds.implantCost, lead.implantAmount),
    instrumentsCost: pickFirstNumber(ov.instrumentsCost, ds.instrumentsCost),
    implantPaidBy:
      (ov.implantPaidBy as Prisma.PLRecordUncheckedCreateInput['implantPaidBy']) ??
      (ds.implantPaidBy as Prisma.PLRecordUncheckedCreateInput['implantPaidBy']) ??
      null,
    instrumentsPaidBy:
      (ov.instrumentsPaidBy as Prisma.PLRecordUncheckedCreateInput['instrumentsPaidBy']) ??
      (ds.instrumentsPaidBy as Prisma.PLRecordUncheckedCreateInput['instrumentsPaidBy']) ??
      null,
    dcCharges: pickFirstNumber(ov.dcCharges, ds.dcCharges),
    doctorCharges: pickFirstNumber(ov.doctorCharges, ds.doctorCharges),

    // Revenue Split
    hospitalSharePct:
      (ov.hospitalSharePct as number | undefined) ??
      (ds.hospitalSharePct as number | undefined) ??
      null,
    hospitalShareAmount: pickFirstNumber(ov.hospitalShareAmount, ds.hospitalShareAmount),
    mediendSharePct:
      (ov.mediendSharePct as number | undefined) ??
      (ds.mediendSharePct as number | undefined) ??
      null,
    mediendShareAmount: pickFirstNumber(ov.mediendShareAmount, ds.mediendShareAmount),
    mediendNetProfit: pickFirstNumber(ov.mediendNetProfit, ds.mediendNetProfit),
    finalProfit: pickFirstNumber(
      ov.finalProfit,
      ov.mediendNetProfit,
      ds.mediendNetProfit,
      lead.netProfit
    ),
    mediendProfit: pickFirstNumber(ov.mediendProfit),

    // Status defaults
    outstandingStatus: 'NEW',
    hospitalPayoutStatus: (ov.hospitalPayoutStatus as string | undefined) ?? 'PENDING',
    doctorPayoutStatus: (ov.doctorPayoutStatus as string | undefined) ?? 'PENDING',
    mediendInvoiceStatus: (ov.mediendInvoiceStatus as string | undefined) ?? 'PENDING',

    // Meta
    remarks: pickFirst(
      ov.remarks as string | undefined,
      ds.remarks as string | undefined
    ),
    doctorRemarks: pickFirst(
      ov.doctorRemarks as string | undefined,
      ds.doctorRemarks as string | undefined
    ),
    costBreakdownRemarks: pickFirst(
      ov.costBreakdownRemarks as string | undefined,
      ds.costBreakdownRemarks as string | undefined
    ),
    handledById: (ov.handledById as string | undefined) ?? userId,
  }

  return payload
}
