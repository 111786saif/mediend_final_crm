/**
 * Shared read-time fallback resolver used by /pl/dashboard and /pl/outstanding.
 * Keeps both pages rendering identically when a PLRecord row is only
 * partially hydrated — the priority chain mirrors the one in
 * `lib/pl/hydrate-pl-record.ts` so write-time and read-time stay in sync.
 */

type AnyRecord = Record<string, unknown>

const PLACEHOLDER_VALUES = new Set(['not specified', 'n/a', 'na', 'none', 'null', '-', '--', 'tbd'])

function pickString(...values: Array<unknown>): string | null {
  for (const v of values) {
    if (v == null) continue
    const s = String(v).trim()
    if (!s) continue
    if (PLACEHOLDER_VALUES.has(s.toLowerCase())) continue
    return s
  }
  return null
}

function pickDate(...values: Array<unknown>): Date | null {
  for (const v of values) {
    if (v == null || v === '') continue
    const d = v instanceof Date ? v : new Date(v as string)
    if (!Number.isNaN(d.getTime())) return d
  }
  return null
}

function pickNumber(...values: Array<unknown>): number | null {
  for (const v of values) {
    if (v == null || v === '') continue
    const n = typeof v === 'number' ? v : Number(v)
    if (!Number.isNaN(n) && n !== 0) return n
  }
  return null
}

function firstOfMonth(d: Date | null): Date | null {
  if (!d) return null
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export type ResolvedPlRow = {
  month: Date | null
  manager: string | null
  bdm: string | null
  patient: string | null
  category: string | null
  treatment: string | null
  doctor: string | null
  hospital: string | null
  admission: Date | null
  surgery: Date | null
  paymentType: string | null
  status: string | null
  totalBill: number | null
  approvedAmount: number | null
  /** Deprecated alias for deductionPaidByPatient — kept for any legacy callers. */
  deductionPatient: number | null
  /** Total deduction (insurer-deducted from approved amount). */
  deductionTotal: number | null
  /** Portion of the deduction the patient paid in cash. */
  deductionPaidByPatient: number | null
  /** Portion of the deduction waived off — auto-derived as total − paid when not stored. */
  deductionWaived: number | null
  /** MediEND's share amount (collected from hospital). */
  mediendShareAmount: number | null
  /** MediEND's net profit (after costs, before 10% deduction). */
  mediendNetProfit: number | null
  /** MediEND's profit after 10% deduction = mediendNetProfit - (10% × mediendShareAmount). */
  mediendProfit: number | null
  /** When insurance team marked the patient discharged (start of PL handoff). */
  leadReceivedFromInsuranceAt: Date | null
}

/**
 * Accepts a `Lead`-shaped record (as returned by /api/leads or /api/outstanding)
 * and returns a normalized set of display fields with all fallbacks applied.
 */
export function resolvePlRow(record: AnyRecord): ResolvedPlRow {
  const pl = (record.plRecord as AnyRecord | undefined) ?? undefined
  const ds = (record.dischargeSheet as AnyRecord | undefined) ?? undefined
  const admission = (record.admissionRecord as AnyRecord | undefined) ?? undefined
  const bd = (record.bd as AnyRecord | undefined) ?? undefined
  const bdEmployee = bd?.employee as AnyRecord | undefined
  const team = bdEmployee?.team as AnyRecord | undefined
  const teamLead = team?.teamLead as AnyRecord | undefined
  const teamLeadUser = teamLead?.user as AnyRecord | undefined
  const department = team?.department as AnyRecord | undefined
  const departmentHead = department?.head as AnyRecord | undefined
  const bdManager = bdEmployee?.manager as AnyRecord | undefined
  const bdManagerUser = bdManager?.user as AnyRecord | undefined

  // Pre-auth is the canonical source for hospital + doctor: the hospital
  // selected during pre-authorization is THE hospital for the case, and the
  // doctor is the one attached to that suggestion row.
  const kyp = record.kypSubmission as AnyRecord | undefined
  const preAuth = kyp?.preAuthData as AnyRecord | undefined
  const preAuthHospital = preAuth?.requestedHospitalName as string | undefined
  const suggestedHospitals =
    (preAuth?.suggestedHospitals as Array<AnyRecord> | undefined) ?? []
  const matchedSuggestion = preAuthHospital
    ? suggestedHospitals.find(
        (s) => (s.hospitalName as string | undefined) === preAuthHospital
      )
    : undefined
  const preAuthDoctor = matchedSuggestion?.suggestedDoctor as string | undefined
  const firstSuggested = suggestedHospitals[0]

  const surgery = pickDate(
    pl?.surgeryDate,
    ds?.surgeryDate,
    admission?.surgeryDate,
    record.surgeryDate
  )
  const admissionDate = pickDate(
    pl?.admissionDate,
    ds?.admissionDate,
    admission?.admissionDate,
    record.arrivalDate
  )
  const monthDate = pickDate(pl?.month, ds?.month) ?? firstOfMonth(surgery) ?? firstOfMonth(admissionDate)

  return {
    month: monthDate,
    manager: pickString(
      pl?.managerName,
      ds?.managerName,
      // Raw Prisma shape used by /api/leads list
      teamLeadUser?.name,
      departmentHead?.name,
      bdManagerUser?.name,
      // Legacy shape used by /api/leads/[id] (toLegacyBdShape flattens employee.team)
      (bd?.team as AnyRecord | undefined)?.salesHead?.name,
      (bd?.manager as AnyRecord | undefined)?.name,
    ),
    bdm: pickString(pl?.bdmName, ds?.bdmName, bd?.name),
    patient: pickString(record.patientName, pl?.patientName, ds?.patientName),
    category: pickString(record.category, pl?.category, ds?.category),
    treatment: pickString(record.treatment, pl?.treatment, ds?.treatment),
    doctor: pickString(
      pl?.doctorName,
      ds?.doctorName,
      preAuthDoctor,
      record.ipdDrName,
      record.surgeonName,
      firstSuggested?.suggestedDoctor
    ),
    hospital: pickString(
      pl?.hospitalName,
      ds?.hospitalName,
      preAuthHospital,
      admission?.admittingHospital,
      preAuth?.hospitalNameSuggestion,
      firstSuggested?.hospitalName,
      record.hospitalName
    ),
    admission: admissionDate,
    surgery,
    paymentType: pickString(pl?.paymentType, ds?.paymentType),
    status: pickString(pl?.status, ds?.status, record.caseStage),
    totalBill: pickNumber(pl?.billAmount, ds?.totalFinalBill, record.billAmount),
    approvedAmount: pickNumber(
      pl?.totalAmount,
      ds?.finalApprovedAmount,
      pl?.approvedOrCash
    ),
    deductionPatient: pickNumber(pl?.cashOrDedPaid, ds?.cashOrDedPaid),
    deductionTotal: pickNumber(ds?.deductionAmount, record.deduction),
    deductionPaidByPatient: pickNumber(pl?.cashOrDedPaid, ds?.cashOrDedPaid),
    deductionWaived: (() => {
      const stored = pickNumber(ds?.waivedOffAmount)
      if (stored != null) return stored
      const total = pickNumber(ds?.deductionAmount, record.deduction)
      const paid = pickNumber(pl?.cashOrDedPaid, ds?.cashOrDedPaid)
      if (total == null && paid == null) return null
      return (total ?? 0) - (paid ?? 0)
    })(),
    mediendShareAmount: pickNumber(pl?.mediendShareAmount, ds?.mediendShareAmount),
    mediendNetProfit: pickNumber(pl?.mediendNetProfit),
    mediendProfit: pickNumber(pl?.mediendProfit),
    leadReceivedFromInsuranceAt: pickDate(ds?.markedAt),
  }
}

export function formatPlDate(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-IN')
}

export function formatPlMonth(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

export function formatPlRupee(n: number | null): string {
  if (n == null) return '—'
  return `₹${Number(n).toLocaleString('en-IN')}`
}
