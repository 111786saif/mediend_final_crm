/**
 * Removes a leading "Dr"/"Dr." honorific (and surrounding whitespace) from a
 * doctor name so variants like "Dr. Singla", "dr singla", "Singla" share a core.
 */
export function stripDrPrefix(raw: string): string {
  return raw.replace(/^\s*dr\b[\s.-]*/i, '').trim()
}

/**
 * Dedupe key for a doctor name: lowercase, no "Dr." honorific, punctuation
 * collapsed to single spaces. So "Dr Singla", "dr. singla", "Dr.  Singla" all
 * map to the same key. Genuinely different names ("Sahil Singla" vs "Singla")
 * stay distinct — we do not guess aliases.
 */
export function normalizeDoctorKey(raw: string): string {
  return stripDrPrefix(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Dedupe key for a hospital name: lowercase, punctuation/whitespace collapsed.
 */
export function normalizeHospitalKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function formatLeadAgeSex(lead: { age?: number | null; sex?: string | null }): string {
  const age = lead.age
  const sex = typeof lead.sex === 'string' ? lead.sex.trim() : ''
  const hasAge = age != null && !Number.isNaN(Number(age))
  if (!hasAge && !sex) return '—'
  if (hasAge && sex) return `${age} / ${sex}`
  if (hasAge) return String(age)
  return sex
}

// The MySQL lead sync stores "Not Specified" when no hospital is known
// (mysql-lead-mapper). Treat such placeholders as empty so the resolver falls
// through to a real value (e.g. a hospital insurance has suggested).
const PLACEHOLDER_VALUES = new Set(['not specified', 'n/a', 'na', 'none', 'null', '-', '--', 'tbd'])

function firstNonEmpty(...values: unknown[]): string | null {
  for (const v of values) {
    if (v == null) continue
    const s = String(v).trim()
    if (!s) continue
    if (PLACEHOLDER_VALUES.has(s.toLowerCase())) continue
    return s
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
  // Earliest signal — a hospital insurance has *suggested* (before BD raises
  // pre-auth). Surfacing it stops tables / patient details showing "Not Specified".
  const firstSuggested = suggested[0]
  const suggestionScalars = Array.isArray(preAuth?.hospitalSuggestions)
    ? (preAuth?.hospitalSuggestions as unknown[])
    : []

  return {
    hospital: firstNonEmpty(
      pl?.hospitalName,
      ds?.hospitalName,
      preAuthHospital,
      rec.hospitalName,
      firstSuggested?.hospitalName,
      preAuth?.hospitalNameSuggestion,
      suggestionScalars[0]
    ),
    doctor: firstNonEmpty(
      pl?.doctorName,
      ds?.doctorName,
      preAuthDoctor,
      rec.ipdDrName,
      rec.surgeonName,
      firstSuggested?.suggestedDoctor
    ),
  }
}
