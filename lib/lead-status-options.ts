export const LEAD_STATUS_OPTIONS = [
  'New',
  'New Lead',
  'Hot Lead',
  'Interested',
  'Follow-up 1',
  'Follow-up 2',
  'Follow-up 3',
  'Follow-up 4',
  'Follow-up 5',
  'Follow-up',
  'Call Back (SD)',
  'Call Back (T)',
  'Call Back Next Week',
  'Call Back Next Month',
  'OPD Schedule',
  'OPD Done',
  'IPD Schedule',
  'IPD Done',
  'Converted',
  'Closed',
  'Lost',
  'DNP',
  'DNP (1-5, Exhausted)',
  'Junk',
  'Churned',
  'Invalid Number',
  'Fund Issues',
  'Call Done',
  'C/W Done',
] as const

export const CRM_ADDITIONAL_LEAD_STATUS_OPTIONS = [
  'DNP-1',
  'DNP-2',
  'DNP-3',
  'DNP-4',
  'DNP-5',
  'DNP Exhausted',
] as const

export const CRM_LEAD_STATUS_OPTIONS = Array.from(
  new Set([...LEAD_STATUS_OPTIONS, ...CRM_ADDITIONAL_LEAD_STATUS_OPTIONS])
)

export const CRM_MODE_OF_PAYMENT_OPTIONS = [
  'Cash',
  'Cashless',
  'EMI',
  'Reimbursement',
] as const
