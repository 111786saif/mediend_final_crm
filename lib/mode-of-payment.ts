const MODE_OF_PAYMENT_LABEL_BY_CODE = {
  '1': 'Cash',
  '2': 'Cashless',
  '3': 'EMI',
  '4': 'Reimbursement',
} as const

const MODE_OF_PAYMENT_CODE_BY_KEY = {
  cash: '1',
  cashless: '2',
  emi: '3',
  reimbursement: '4',
} as const

type ModeOfPaymentKey = keyof typeof MODE_OF_PAYMENT_CODE_BY_KEY

function normalizeRawModeOfPayment(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  if (typeof value !== 'string') return null

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export function normalizeModeOfPaymentLabel(value: unknown): string | null {
  const raw = normalizeRawModeOfPayment(value)
  if (!raw) return null

  const mappedFromCode = MODE_OF_PAYMENT_LABEL_BY_CODE[raw as keyof typeof MODE_OF_PAYMENT_LABEL_BY_CODE]
  if (mappedFromCode) return mappedFromCode

  const lowered = raw.toLowerCase()

  if (lowered === 'cash') return 'Cash'
  if (lowered === 'cashless') return 'Cashless'
  if (lowered === 'emi') return 'EMI'
  if (lowered === 'reimbursement') return 'Reimbursement'

  return raw
}

export function normalizeModeOfPaymentKey(value: unknown): ModeOfPaymentKey | null {
  const label = normalizeModeOfPaymentLabel(value)
  if (!label) return null

  const lowered = label.toLowerCase()
  if (lowered === 'cash') return 'cash'
  if (lowered === 'cashless') return 'cashless'
  if (lowered === 'emi') return 'emi'
  if (lowered === 'reimbursement') return 'reimbursement'

  return null
}

export function normalizeModeOfPaymentStorageValue(value: unknown): string | null {
  const raw = normalizeRawModeOfPayment(value)
  if (!raw) return null

  if (MODE_OF_PAYMENT_LABEL_BY_CODE[raw as keyof typeof MODE_OF_PAYMENT_LABEL_BY_CODE]) {
    return raw
  }

  const key = normalizeModeOfPaymentKey(raw)
  if (!key) return raw

  return MODE_OF_PAYMENT_CODE_BY_KEY[key]
}
