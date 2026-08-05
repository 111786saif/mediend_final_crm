const DEFAULT_NOTIFICATIONS_URL =
  'https://kpi.knowlarity.com/Basic/v1/account/notifications'

const DEFAULT_CHANNEL = 'Basic'

export interface KnowlarityRegistrationsResponse {
  registrations: string[]
  normalizedRegistrations: string[]
  rawPayload: unknown
}

export function getKnowlarityChannel() {
  return process.env.KNOWLARITY_NOTIFICATION_CHANNEL?.trim() || DEFAULT_CHANNEL
}

export function getKnowlarityNotificationsUrl() {
  return process.env.KNOWLARITY_NOTIFICATIONS_URL?.trim() || DEFAULT_NOTIFICATIONS_URL
}

export function normalizeKnowlarityPhone(value: string) {
  const digits = String(value || '').replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return `+${digits.slice(1).replace(/\D/g, '')}`
  const numeric = digits.replace(/\D/g, '')
  if (numeric.length === 10) return `+91${numeric}`
  if (numeric.length >= 11) return `+${numeric}`
  return digits
}

function extractRegistrationValues(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return []

  const root = payload as Record<string, unknown>
  const candidateArrays = [
    root.knowlarity_number,
    root.knowlarity_numbers,
    (root.data as Record<string, unknown> | undefined)?.knowlarity_number,
    (root.data as Record<string, unknown> | undefined)?.knowlarity_numbers,
    root.results,
    (root.data as Record<string, unknown> | undefined)?.results,
  ]

  for (const candidate of candidateArrays) {
    if (!Array.isArray(candidate)) continue

    const values = candidate
      .map((entry) => {
        if (typeof entry === 'string') return entry
        if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>
          return (
            (typeof record.knowlarity_number === 'string' && record.knowlarity_number) ||
            (typeof record.number === 'string' && record.number) ||
            (typeof record.phone === 'string' && record.phone) ||
            null
          )
        }
        return null
      })
      .filter((entry): entry is string => Boolean(entry))

    if (values.length > 0) {
      return values
    }
  }

  return []
}

export async function fetchKnowlarityRegistrations(): Promise<KnowlarityRegistrationsResponse> {
  const authKey = process.env.KNOWLARITY_AUTH_KEY?.trim()
  const apiKey = process.env.KNOWLARITY_X_API_KEY?.trim()

  if (!authKey || !apiKey) {
    throw new Error(
      'Knowlarity notifications are not configured. Please set KNOWLARITY_AUTH_KEY and KNOWLARITY_X_API_KEY.'
    )
  }

  const channel = getKnowlarityChannel()
  const url = new URL(getKnowlarityNotificationsUrl())

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      channel,
      'x-api-key': apiKey,
      authorization: authKey,
      'content-type': 'application/json',
      accept: 'application/json',
      'cache-control': 'no-cache',
    },
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      (payload && typeof payload === 'object' && typeof (payload as Record<string, unknown>).message === 'string'
        ? (payload as Record<string, unknown>).message
        : null) ||
      (payload && typeof payload === 'object' && typeof (payload as Record<string, unknown>).error === 'string'
        ? (payload as Record<string, unknown>).error
        : null) ||
      'Failed to fetch Knowlarity registrations.'
    throw new Error(message)
  }

  const registrations = extractRegistrationValues(payload)
  return {
    registrations,
    normalizedRegistrations: registrations.map(normalizeKnowlarityPhone),
    rawPayload: payload,
  }
}

export async function isKnowlarityNumberRegistered(phoneNumber: string) {
  const normalizedPhoneNumber = normalizeKnowlarityPhone(phoneNumber)
  const registrations = await fetchKnowlarityRegistrations()
  return registrations.normalizedRegistrations.includes(normalizedPhoneNumber)
}
