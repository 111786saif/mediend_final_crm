export interface AddressDetails {
  line?: string | null
  city?: string | null
  state?: string | null
  pinCode?: string | null
  country?: string | null
}

export interface ProfileDocument {
  id: string
  label: string
  url: string
  fileName: string
}

export interface OtherDocument {
  name: string
  url: string
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  OFFER_LETTER: 'Offer Letter',
  INCREMENT_LETTER: 'Increment Letter',
  EXPERIENCE_LETTER: 'Experience Certificate',
  RELIEVING_LETTER: 'Relieving Letter',
  INTERNSHIP_OFFER_LETTER: 'Internship Offer Letter',
  INTERNSHIP_COMPLETION_LETTER: 'Internship Completion Letter',
  EXIT_INTERVIEW_FORM: 'Exit Interview Form',
  CUSTOM: 'Other Document',
}

export function parseAddress(value: unknown, legacyLine?: string | null): AddressDetails {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    return {
      line: typeof obj.line === 'string' ? obj.line : legacyLine ?? null,
      city: typeof obj.city === 'string' ? obj.city : null,
      state: typeof obj.state === 'string' ? obj.state : null,
      pinCode: typeof obj.pinCode === 'string' ? obj.pinCode : null,
      country: typeof obj.country === 'string' ? obj.country : null,
    }
  }
  if (legacyLine?.trim()) {
    return { line: legacyLine.trim(), city: null, state: null, pinCode: null, country: null }
  }
  return { line: null, city: null, state: null, pinCode: null, country: null }
}

export function parseOtherDocuments(value: unknown): OtherDocument[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (item): item is OtherDocument =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as OtherDocument).name === 'string' &&
        typeof (item as OtherDocument).url === 'string' &&
        (item as OtherDocument).url.trim().length > 0
    )
    .map((item) => ({ name: item.name, url: item.url }))
}

function fileNameFromUrl(url: string, fallback: string): string {
  const segment = url.split('/').pop()?.split('?')[0]
  return segment && segment.length > 0 ? decodeURIComponent(segment) : fallback
}

export function buildProfileDocuments(input: {
  aadharDocUrl?: string | null
  panDocUrl?: string | null
  passportDocUrl?: string | null
  drivingLicenseDocUrl?: string | null
  resumeDocUrl?: string | null
  educationalCertDocUrl?: string | null
  experienceCertDocUrl?: string | null
  appointmentLetterDocUrl?: string | null
  salarySlipDocUrl?: string | null
  bankStatementDocUrl?: string | null
  otherDocuments?: unknown
  hrDocuments?: Array<{
    id: string
    documentType: string
    documentUrl: string | null
    title: string | null
  }>
}): ProfileDocument[] {
  const docs: ProfileDocument[] = []
  const seen = new Set<string>()

  const add = (id: string, label: string, url?: string | null) => {
    const trimmed = url?.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    docs.push({
      id,
      label,
      url: trimmed,
      fileName: fileNameFromUrl(trimmed, label.replace(/\s+/g, '_')),
    })
  }

  add('aadhar', 'Aadhaar Card', input.aadharDocUrl)
  add('pan', 'PAN Card', input.panDocUrl)
  add('passport', 'Passport', input.passportDocUrl)
  add('driving-license', 'Driving License', input.drivingLicenseDocUrl)
  add('resume', 'Resume', input.resumeDocUrl)
  add('appointment-letter', 'Previous company offer letter', input.appointmentLetterDocUrl)
  add('education', 'Educational Certificates', input.educationalCertDocUrl)
  add('experience-static', 'Experience Certificates', input.experienceCertDocUrl)
  add('salary-slip', 'Salary slip', input.salarySlipDocUrl)
  add('bank-statement', 'Bank statement', input.bankStatementDocUrl)

  for (const doc of parseOtherDocuments(input.otherDocuments)) {
    add(`other-${doc.name}`, doc.name, doc.url)
  }

  for (const doc of input.hrDocuments ?? []) {
    const url = doc.documentUrl?.trim()
    if (!url) continue
    const label =
      doc.title?.trim() ||
      DOCUMENT_TYPE_LABELS[doc.documentType] ||
      doc.documentType.replace(/_/g, ' ')
    add(`hr-${doc.id}`, label, url)
  }

  return docs
}

export const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  ON_PIP: 'On PIP',
  ON_NOTICE: 'On Notice',
  TERMINATED: 'Terminated',
  ABSCONDED: 'Absconded',
}

export function formatEmploymentStatus(status?: string | null): string {
  if (!status) return 'Not set'
  return EMPLOYMENT_STATUS_LABELS[status] ?? status.replace(/_/g, ' ')
}

export function formatEmergencyContact(name?: string | null, phone?: string | null): string | null {
  const parts = [name?.trim(), phone?.trim()].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
}
