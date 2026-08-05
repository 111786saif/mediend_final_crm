import { NextRequest } from 'next/server'
import { getSessionWithFreshUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const encoder = new TextEncoder()

type KnowlarityRawPayload =
  | Record<string, unknown>
  | string
  | number
  | boolean
  | null

type NormalizedCallState = 'receiving_call' | 'on_call' | 'call_finished' | 'update'

function normalizePhone(raw: string | null | undefined): string {
  const digits = String(raw ?? '').replace(/\D+/g, '')
  if (digits.length >= 10) return digits.slice(-10)
  return digits
}

function titleCase(text: string): string {
  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function extractPossiblePhones(value: unknown, into: Set<string>) {
  if (value == null) return

  if (typeof value === 'string') {
    const normalized = normalizePhone(value)
    if (normalized) into.add(normalized)
    return
  }

  if (typeof value === 'number') {
    const normalized = normalizePhone(String(value))
    if (normalized) into.add(normalized)
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) extractPossiblePhones(item, into)
    return
  }

  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (/phone|mobile|agent|number|caller|destination|customer/i.test(key)) {
        extractPossiblePhones(nested, into)
      }
    }
  }
}

function matchesAgentPhone(payload: KnowlarityRawPayload, agentPhone: string): boolean {
  if (!agentPhone) return false
  const phones = new Set<string>()
  extractPossiblePhones(payload, phones)
  return phones.has(agentPhone)
}

function extractEventType(payload: KnowlarityRawPayload, fallbackEventName: string | null): string {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const obj = payload as Record<string, unknown>
    const eventType =
      obj.event_type ??
      obj.eventType ??
      obj.type ??
      obj.status ??
      obj.call_status ??
      obj.callStatus

    if (typeof eventType === 'string' && eventType.trim()) {
      return eventType.trim()
    }
  }

  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim()
  }

  return fallbackEventName?.trim() || 'update'
}

function mapCallState(eventType: string): {
  state: NormalizedCallState
  label: string
} {
  const normalized = eventType.trim().toLowerCase().replace(/[\s-]+/g, '_')

  if (
    normalized.includes('incoming') ||
    normalized.includes('ringing') ||
    normalized.includes('ring') ||
    normalized.includes('receive')
  ) {
    return { state: 'receiving_call', label: 'You have an incoming call.' }
  }

  if (
    normalized.includes('answer') ||
    normalized.includes('pickup') ||
    normalized.includes('picked') ||
    normalized.includes('connect') ||
    normalized.includes('in_progress') ||
    normalized === 'on_call'
  ) {
    return { state: 'on_call', label: 'Call is now connected.' }
  }

  if (
    normalized.includes('hangup') ||
    normalized.includes('completed') ||
    normalized.includes('cdr') ||
    normalized.includes('finished') ||
    normalized.includes('ended') ||
    normalized.includes('disconnect') ||
    normalized.includes('missed') ||
    normalized.includes('cancel')
  ) {
    return { state: 'call_finished', label: 'Call has ended.' }
  }

  return {
    state: 'update',
    label: 'Call status updated.',
  }
}

function safeParseData(raw: string): KnowlarityRawPayload {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed) as KnowlarityRawPayload
  } catch {
    return trimmed
  }
}

function sseChunk(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

async function resolveLoggedInUserPhone(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      role: true,
      phoneNumber: true,
    },
  })

  if (!user) return null

  const employeeRows = await prisma.$queryRaw<
    Array<{
      knowlarityPhoneNumber: string | null
      knowlarityCallerId: string | null
      knowlarityNotificationsEnabled: boolean
    }>
  >`
    SELECT
      "knowlarityPhoneNumber",
      "knowlarityCallerId",
      "knowlarityNotificationsEnabled"
    FROM "Employee"
    WHERE "userId" = ${userId}
    LIMIT 1
  `

  const employee = employeeRows[0] ?? null
  const effectiveAgentPhone = employee?.knowlarityPhoneNumber ?? user.phoneNumber

  return {
    ...user,
    knowlarityPhoneNumber: employee?.knowlarityPhoneNumber ?? null,
    knowlarityCallerId: employee?.knowlarityCallerId ?? null,
    knowlarityNotificationsEnabled: employee?.knowlarityNotificationsEnabled ?? false,
    normalizedPhone: normalizePhone(effectiveAgentPhone),
  }
}

export async function GET(request: NextRequest) {
  const session = await getSessionWithFreshUser()
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const authKey = process.env.KNOWLARITY_AUTH_KEY?.trim()
  if (!authKey) {
    return new Response('Knowlarity stream is not configured', { status: 500 })
  }

  const currentUser = await resolveLoggedInUserPhone(session.id)
  if (!currentUser) {
    return new Response('Unauthorized', { status: 401 })
  }

  const streamUrl =
    process.env.KNOWLARITY_STREAM_URL?.trim() ||
    `https://konnect.knowlarity.com:8100/update-stream/${authKey}/konnect`

  const upstream = await fetch(streamUrl, {
    method: 'GET',
    headers: {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
    cache: 'no-store',
    signal: request.signal,
  })

  if (!upstream.ok || !upstream.body) {
    return new Response('Failed to connect to Knowlarity stream', { status: 502 })
  }

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let buffer = ''

      controller.enqueue(
        sseChunk('ready', {
          connected: true,
          userId: currentUser.id,
          userName: currentUser.name,
          agentPhoneConfigured: Boolean(currentUser.normalizedPhone),
        })
      )

      const flushEventBlock = (block: string) => {
        const lines = block.split(/\r?\n/)
        let eventName: string | null = null
        const dataLines: string[] = []

        for (const line of lines) {
          if (!line || line.startsWith(':')) continue
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim()
            continue
          }
          if (line.startsWith('data:')) {
            dataLines.push(line.slice(5))
          }
        }

        if (dataLines.length === 0) return

        const payload = safeParseData(dataLines.join('\n'))
        if (!currentUser.normalizedPhone || !matchesAgentPhone(payload, currentUser.normalizedPhone)) {
          return
        }

        const rawEventType = extractEventType(payload, eventName)
        const mapped = mapCallState(rawEventType)

        controller.enqueue(
          sseChunk('call', {
            state: mapped.state,
            label: mapped.label,
            eventType: rawEventType,
            agentPhone: currentUser.normalizedPhone,
            payload,
            receivedAt: new Date().toISOString(),
          })
        )
      }

      const pump = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const parts = buffer.split(/\r?\n\r?\n/)
            buffer = parts.pop() ?? ''

            for (const part of parts) {
              flushEventBlock(part)
            }
          }

          if (buffer.trim()) {
            flushEventBlock(buffer)
          }
        } catch (error) {
          controller.enqueue(
            sseChunk('error', {
              message: error instanceof Error ? error.message : 'Stream error',
            })
          )
        } finally {
          try {
            reader.releaseLock()
          } catch {}
          controller.close()
        }
      }

      void pump()
    },
    cancel() {
      void reader.cancel()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
