const AUTHKEY_BASE_URL = 'https://api.authkey.io/request'
const AUTHKEY_HARDCODED_KEY = '8d3215b58fd69678'

export interface AuthkeySendTemplateArgs {
  mobile: string
  wid: string
  countryCode?: string
  param1?: string
}

function normalizeMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '')
  if (digits.length !== 10) {
    throw new Error('Mobile number must be a 10-digit Indian number')
  }
  return digits
}

export async function sendAuthkeyTemplate({
  mobile,
  wid,
  countryCode = '91',
  param1,
}: AuthkeySendTemplateArgs): Promise<void> {
  const params = new URLSearchParams({
    authkey: AUTHKEY_HARDCODED_KEY,
    mobile: normalizeMobile(mobile),
    country_code: countryCode,
    wid,
  })

  // Authkey template variable must be sent as query param key "1"
  if (param1 !== undefined) {
    params.set('1', param1)
  }

  const response = await fetch(`${AUTHKEY_BASE_URL}?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Authkey request failed (${response.status}): ${body}`)
  }
}
