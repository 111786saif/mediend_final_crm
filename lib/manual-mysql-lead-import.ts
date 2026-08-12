export type ManualMySQLLeadFieldType = 'string' | 'number' | 'boolean' | 'date'

export type ManualMySQLLeadField = {
  key: string
  label: string
  type: ManualMySQLLeadFieldType
  section:
    | 'Identity'
    | 'Patient'
    | 'Location'
    | 'Medical'
    | 'Ownership'
  required?: boolean
  multiline?: boolean
  helperText?: string
  sample?: string
}

export const MANUAL_MYSQL_LEAD_FIELDS: ManualMySQLLeadField[] = [
  { key: 'Lead_Date', label: 'Lead_Date', type: 'date', section: 'Identity', helperText: 'Use DD/MM/YYYY with optional time, for example 12/08/2026 10:30 AM.', sample: '12/08/2026 10:30 AM' },

  { key: 'Patient_Number', label: 'Patient_Number', type: 'string', section: 'Patient', required: true, sample: '9876543210' },
  { key: 'AlternativePhone', label: 'AlternativePhone', type: 'string', section: 'Patient', sample: '9123456789' },
  { key: 'Whatsapp', label: 'Whatsapp', type: 'string', section: 'Patient', sample: '9876543210' },
  { key: 'Patient_Name', label: 'Patient_Name', type: 'string', section: 'Patient', required: true, sample: 'Sample Patient' },
  { key: 'PatientEmail', label: 'PatientEmail', type: 'string', section: 'Patient', sample: 'sample.patient@example.com' },
  { key: 'Age', label: 'Age', type: 'number', section: 'Patient', sample: '30' },
  { key: 'Sex', label: 'Sex', type: 'string', section: 'Patient', sample: 'Male' },
  { key: 'Profession', label: 'Profession', type: 'string', section: 'Patient', sample: 'Teacher' },

  { key: 'Circle', label: 'Circle', type: 'string', section: 'Location', helperText: 'Supports circle name or MySQL/master id.', sample: 'Mumbai' },
  { key: 'city_option', label: 'city_option', type: 'string', section: 'Location', helperText: 'Supports city name or id.', sample: 'Mumbai' },
  { key: 'address', label: 'address', type: 'string', section: 'Location', multiline: true, sample: 'Andheri West, Mumbai' },
  { key: 'website', label: 'website', type: 'string', section: 'Location', sample: 'https://example.com' },
  { key: 'ip', label: 'ip', type: 'string', section: 'Location', sample: '127.0.0.1' },

  { key: 'Category', label: 'Category', type: 'string', section: 'Medical', helperText: 'Supports category name or id.', sample: 'Aesthetics' },
  { key: 'Treatment', label: 'Treatment', type: 'string', section: 'Medical', helperText: 'Supports treatment name or id.', sample: 'Lipoma' },
  { key: 'DiseaseDetails', label: 'DiseaseDetails', type: 'string', section: 'Medical', multiline: true, sample: 'Soft tissue swelling' },
  { key: 'Status', label: 'Status', type: 'string', section: 'Medical', sample: 'New Lead' },
  { key: 'SubStatus', label: 'SubStatus', type: 'string', section: 'Medical', sample: 'Warm lead' },
  { key: 'MOP', label: 'MOP', type: 'string', section: 'Medical', sample: 'Insurance' },

  { key: 'Source', label: 'Source', type: 'string', section: 'Ownership', helperText: 'Supports source name or id.', sample: 'Meta' },
  { key: 'Lead_Source', label: 'Lead_Source', type: 'string', section: 'Ownership', helperText: 'Supports lead source name or id.', sample: 'LEAD1META' },
  {
    key: 'campaign_id',
    label: 'campaign_id',
    type: 'string',
    section: 'Ownership',
    helperText: 'Optional. Used for campaign-based CRM auto-assignment.',
    sample: 'Lipoma-Mumbai-WR-20Jan-2026-Lipo-M1',
  },
]

export const MANUAL_MYSQL_REQUIRED_FIELD_KEYS = MANUAL_MYSQL_LEAD_FIELDS.filter(
  (field) => field.required
).map((field) => field.key)

export const MANUAL_MYSQL_LEAD_SECTION_ORDER = [
  'Identity',
  'Patient',
  'Location',
  'Medical',
  'Ownership',
] as const

export function createEmptyManualMySQLLeadValues() {
  return Object.fromEntries(MANUAL_MYSQL_LEAD_FIELDS.map((field) => [field.key, ''])) as Record<
    string,
    string
  >
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildManualMySQLLeadSampleCsv() {
  const header = MANUAL_MYSQL_LEAD_FIELDS.map((field) => field.key)
  const row = MANUAL_MYSQL_LEAD_FIELDS.map((field) => field.sample ?? '')
  return `${header.map(csvEscape).join(',')}\n${row.map(csvEscape).join(',')}\n`
}
