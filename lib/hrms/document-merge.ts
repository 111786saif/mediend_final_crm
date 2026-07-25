import { format } from 'date-fns'

/** Standard date format for all HR letters, e.g. "16th May, 2025" */
export const LETTER_DATE_FORMAT = 'do MMMM, yyyy' as const

/** Joining datetime format for offer letters */
export const LETTER_DATETIME_FORMAT = "do MMMM, yyyy 'at 09:30 AM'" as const

/**
 * Format a date for letter output. Accepts ISO strings, Date objects, or already-formatted text.
 * Falls back when value is missing or unparseable.
 */
export function formatLetterDate(
  raw: string | Date | null | undefined,
  fallback = 'N/A',
  pattern: string = LETTER_DATE_FORMAT
): string {
  if (raw === null || raw === undefined || raw === '') return fallback
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return fallback
    return format(raw, pattern)
  }
  const trimmed = String(raw).trim()
  if (!trimmed) return fallback
  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    return format(parsed, pattern)
  }
  // Already human-readable (e.g. "To be confirmed") — keep as-is
  return trimmed
}

/**
 * Replace {{key}} placeholders in template HTML with values from vars.
 * Unknown placeholders are left as-is. Missing values become empty string.
 */
export function mergeTemplatePlaceholders(
  templateHtml: string,
  vars: Record<string, string | number | null | undefined>
): string {
  return templateHtml.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = vars[key]
    if (value === null || value === undefined) return ''
    return String(value)
  })
}

/** Extract inner HTML of <body> from a full document, or return as-is. */
export function extractBodyHtml(fullHtml: string): string {
  const match = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  if (match) return match[1].trim()
  return fullHtml
}

/** List of common placeholders available when editing templates. */
export const TEMPLATE_PLACEHOLDERS: { key: string; label: string }[] = [
  { key: 'employeeName', label: 'Employee Name' },
  { key: 'employeeCode', label: 'Employee Code' },
  { key: 'employeeEmail', label: 'Employee Email' },
  { key: 'department', label: 'Department' },
  { key: 'designation', label: 'Designation' },
  { key: 'salutation', label: 'Salutation' },
  { key: 'today', label: 'Today Date' },
  { key: 'year', label: 'Year' },
  { key: 'refNumber', label: 'Reference Number' },
  { key: 'companyName', label: 'Company Name' },
  { key: 'companyAddress', label: 'Company Address' },
  { key: 'ctc', label: 'CTC' },
  { key: 'ctcWords', label: 'CTC in Words' },
  { key: 'monthlySalary', label: 'Monthly Salary' },
  { key: 'joiningDate', label: 'Joining Date' },
  { key: 'acceptanceDeadline', label: 'Acceptance Deadline' },
  { key: 'guardianName', label: 'Guardian Name' },
  { key: 'guardianRelation', label: 'Guardian Relation' },
  { key: 'address', label: 'Address' },
  { key: 'guardianLine', label: 'Guardian Line' },
  { key: 'addressBlock', label: 'Address Block' },
  { key: 'salesSection', label: 'Sales Section' },
  { key: 'previousSalary', label: 'Previous Salary' },
  { key: 'newSalary', label: 'New Salary' },
  { key: 'newMonthlySalary', label: 'New Monthly Salary' },
  { key: 'incrementPercentage', label: 'Increment %' },
  { key: 'effectiveDate', label: 'Effective Date' },
  { key: 'joinDate', label: 'Join Date' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'remarksBlock', label: 'Remarks Block' },
  { key: 'lastWorkingDate', label: 'Last Working Date' },
  { key: 'resignationDate', label: 'Resignation Date' },
  { key: 'firstName', label: 'First Name' },
  { key: 'stipend', label: 'Stipend' },
  { key: 'stipendDisplay', label: 'Stipend Display' },
  { key: 'duration', label: 'Duration' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'endDate', label: 'End Date' },
  { key: 'location', label: 'Location' },
  { key: 'internshipType', label: 'Internship Type' },
  { key: 'signatureHtml', label: 'Signature Block' },
]
