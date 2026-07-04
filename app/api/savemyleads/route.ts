import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getSafeHeaders(headers: Headers) {
  const blockedHeaders = new Set(['authorization', 'cookie'])
  const safeHeaders: Record<string, string> = {}

  for (const [key, value] of headers.entries()) {
    if (!blockedHeaders.has(key.toLowerCase())) {
      safeHeaders[key] = value
    }
  }

  return safeHeaders
}

function parseWebhookBody(rawBody: string, contentType: string) {
  if (!rawBody) {
    return null
  }

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(rawBody)
    } catch {
      return rawBody
    }
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(rawBody).entries())
  }

  try {
    return JSON.parse(rawBody)
  } catch {
    return rawBody
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') ?? 'unknown'
    const rawBody = await request.text()
    const payload = parseWebhookBody(rawBody, contentType)
    const receivedAt = new Date().toISOString()

    console.log(
      '[savemyleads] Webhook received\n' +
        JSON.stringify(
          {
            receivedAt,
            method: request.method,
            contentType,
            headers: getSafeHeaders(request.headers),
            payload,
          },
          null,
          2
        )
    )

    return NextResponse.json({
      success: true,
      message: 'Lead received successfully',
      receivedAt,
    })
  } catch (error) {
    console.error('[savemyleads] Failed to process webhook:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process webhook payload',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'SaveMyLeads webhook endpoint is ready',
    endpoint: '/api/savemyleads',
    method: 'POST',
  })
}
