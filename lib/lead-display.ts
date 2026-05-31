export function formatLeadAgeSex(lead: { age?: number | null; sex?: string | null }): string {
  const age = lead.age
  const sex = typeof lead.sex === 'string' ? lead.sex.trim() : ''
  const hasAge = age != null && !Number.isNaN(Number(age))
  if (!hasAge && !sex) return '—'
  if (hasAge && sex) return `${age} / ${sex}`
  if (hasAge) return String(age)
  return sex
}

function firstNonEmpty(...values: unknown[]): string | null {
  for (const v of values) {
    if (v == null) continue
    const s = String(v).trim()
    if (s) return s
  }
  return null
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined
}

/**
 * Single source of truth for the hospital + doctor shown across every table
 * (insurance, case tracker, TL pipeline, compliance, PL). Mirrors the priority
 * chain in `lib/pl/resolve-pl-row.ts`: the hospital chosen during pre-auth is
 * THE hospital for the case, and the doctor is the one attached to that
 * suggestion (also persisted to `lead.ipdDrName` on approval).
 *
 *   hospital: plRecord → dischargeSheet → preAuth.requestedHospitalName → lead.hospitalName
 *   doctor:   plRecord → dischargeSheet → matched suggestion → lead.ipdDrName → lead.surgeonName
 *
 * Accepts any Lead-shaped object (slim pipeline row or full include); fields are
 * read defensively so the differently-typed lead objects across the app all work.
 */
export function resolveLeadHospitalDoctor(
  lead: object | null | undefined
): { hospital: string | null; doctor: string | null } {
  const rec = asRecord(lead) ?? {}
  const pl = asRecord(rec.plRecord)
  const ds = asRecord(rec.dischargeSheet)
  const preAuth = asRecord(asRecord(rec.kypSubmission)?.preAuthData)
  const preAuthHospital = preAuth?.requestedHospitalName
  const suggestedRaw = preAuth?.suggestedHospitals
  const suggested = Array.isArray(suggestedRaw)
    ? (suggestedRaw as unknown[]).map(asRecord).filter((x): x is Record<string, unknown> => !!x)
    : []
  const matched =
    preAuthHospital != null ? suggested.find((s) => s.hospitalName === preAuthHospital) : undefined
  const preAuthDoctor = matched?.suggestedDoctor

  return {
    hospital: firstNonEmpty(pl?.hospitalName, ds?.hospitalName, preAuthHospital, rec.hospitalName),
    doctor: firstNonEmpty(
      pl?.doctorName,
      ds?.doctorName,
      preAuthDoctor,
      rec.ipdDrName,
      rec.surgeonName
    ),
  }
}
