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

/** City from KYP basic form (`location`); falls back to `lead.city` when present. */
export function resolveLeadCity(lead: object | null | undefined): string | null {
  const rec = asRecord(lead) ?? {}
  const kyp = asRecord(rec.kypSubmission)
  return firstNonEmpty(kyp?.location, rec.city)
}

/**
 * Single source of truth for Lead Source text display.
 * Prefers campaign lead-source labels from `campaignName`, then falls back to
 * human-readable source values from `source`.
 * If only numeric ID is present (e.g., 100, 67), falls back gracefully.
 */
export function resolveLeadSourceDisplay(lead: {
  source?: string | null
  leadSource?: number | string | null
  campaignName?: string | null
}): string {
  if (lead.campaignName && typeof lead.campaignName === 'string' && lead.campaignName.trim().length > 0) {
    const c = lead.campaignName.trim()
    if (!/^\d+$/.test(c)) {
      return c
    }
  }

  if (lead.source && typeof lead.source === 'string' && lead.source.trim().length > 0) {
    const s = lead.source.trim()
    if (!/^\d+$/.test(s)) {
      return s
    }
  }

  if (lead.source && typeof lead.source === 'string' && lead.source.trim().length > 0) {
    return lead.source.trim()
  }

  if (lead.leadSource != null) {
    const ls = String(lead.leadSource).trim()
    if (ls.length > 0) return ls
  }

  return '—'
}
