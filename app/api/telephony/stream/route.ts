import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { lookupPatientByPhone, PatientLookupResult } from '@/lib/telephony-lead-lookup'

export const dynamic = 'force-dynamic'

type KnowlarityRawPayload = unknown

type StreamCallEvent = {
  state: 'receiving_call' | 'on_call' | 'call_finished' | 'update'
  label: string
  eventType: string
  agentPhone?: string | null
  patientInfo?: PatientLookupResult | null
  recordingUrl?: string | null
  payload?: unknown
  receivedAt?: string
}

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

function getKnowlarityCandidateUrls(): string[] {
  const streamUrlEnv = process.env.KNOWLARITY_STREAM_URL?.trim()
  const notificationsUrlEnv = process.env.KNOWLARITY_NOTIFICATIONS_URL?.trim()
  const apiKey = process.env.KNOWLARITY_X_API_KEY?.trim() || ''
  const authKey = process.env.KNOWLARITY_AUTH_KEY?.trim() || ''
  const key = apiKey || authKey

  const urls: string[] = []

  if (streamUrlEnv) {
    urls.push(streamUrlEnv.replace('{key}', key))
  }

  if (key) {
    urls.push(`https://konnect.knowlarity.com:8100/update-stream/${key}/konnect`)
    urls.push(`https://konnect.knowlarity.com:8100/update-stream/${key}`)
  }

  if (notificationsUrlEnv) {
    urls.push(notificationsUrlEnv)
  }

  urls.push('https://kpi.knowlarity.com/Basic/v1/account/notifications')

  return Array.from(new Set(urls.filter(Boolean)))
}

function extractKnowlarityNumbers(payload: KnowlarityRawPayload): Set<string> {
  const result = new Set<string>()
  if (!payload || typeof payload !== 'object') return result
  const root = payload as Record<string, unknown>
  const dataObj = root.data as Record<string, unknown> | undefined

  const candidates = [
    root.knowlarity_number,
    root.knowlarity_numbers,
    root.virtual_number,
    root.dispnumber,
    root.k_number,
    root.channel_number,
    dataObj?.knowlarity_number,
    dataObj?.knowlarity_numbers,
    dataObj?.virtual_number,
    dataObj?.dispnumber,
    dataObj?.k_number,
  ]

  for (const candidate of candidates) {
    if (candidate != null) {
      if (typeof candidate === 'string' || typeof candidate === 'number') {
        const norm = normalizePhone(String(candidate))
        if (norm) result.add(norm)
      } else if (Array.isArray(candidate)) {
        for (const item of candidate) {
          const norm = normalizePhone(String(item))
          if (norm) result.add(norm)
        }
      }
    }
  }

  return result
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

function extractCustomerPhone(payload: KnowlarityRawPayload, agentPhone: string): string | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as Record<string, unknown>
  const dataObj = root.data as Record<string, unknown> | undefined

  const knowlarityNumbers = extractKnowlarityNumbers(payload)

  // Explicit customer fields in order of priority:
  const customerCandidates = [
    root.customer_number,
    root.customer_phone,
    root.customerPhone,
    root.caller,
    root.caller_id,
    root.customer,
    root.call_from,
    root.phone_number,
    root.destination,
    dataObj?.customer_number,
    dataObj?.customer_phone,
    dataObj?.customerPhone,
    dataObj?.caller,
    dataObj?.caller_id,
    dataObj?.customer,
    dataObj?.call_from,
    dataObj?.phone_number,
    dataObj?.destination,
  ]

  for (const candidate of customerCandidates) {
    if (candidate != null && (typeof candidate === 'string' || typeof candidate === 'number')) {
      const norm = normalizePhone(String(candidate))
      if (norm && norm.length >= 7 && norm !== agentPhone && !knowlarityNumbers.has(norm)) {
        return norm
      }
    }
  }

  // Fallback: search all phone numbers in payload excluding agent & knowlarity virtual numbers
  const phones = new Set<string>()
  extractPossiblePhones(payload, phones)

  if (agentPhone) phones.delete(agentPhone)
  for (const kNum of knowlarityNumbers) {
    phones.delete(kNum)
  }

  for (const phone of phones) {
    if (phone.length === 10 && phone !== agentPhone && !knowlarityNumbers.has(phone)) {
      return phone
    }
  }

  for (const phone of phones) {
    if (phone.length >= 7 && phone !== agentPhone && !knowlarityNumbers.has(phone)) {
      return phone
    }
  }

  return null
}

function matchesAgentPhone(payload: KnowlarityRawPayload, agentPhone: string, userRole?: string): boolean {
  if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') return true
  if (!agentPhone) return true
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
  const normalized = eventType.trim().toUpperCase()

  if (
    normalized.includes('DIAL') ||
    normalized.includes('RINGING') ||
    normalized.includes('INIT') ||
    normalized.includes('CUSTOMER_RINGING') ||
    normalized.includes('ORIGINATE')
  ) {
    return { state: 'receiving_call', label: titleCase(eventType) }
  }

  if (
    normalized.includes('ANSWER') ||
    normalized.includes('BRIDGE') ||
    normalized.includes('CONNECTED') ||
    normalized.includes('TALKING')
  ) {
    return { state: 'on_call', label: titleCase(eventType) }
  }

  if (
    normalized.includes('HANGUP') ||
    normalized.includes('END') ||
    normalized.includes('DISCONNECT') ||
    normalized.includes('COMPLETED')
  ) {
    return { state: 'call_finished', label: titleCase(eventType) }
  }

  return { state: 'update', label: titleCase(eventType) }
}

function sseChunk(event: string, data: unknown): Uint8Array {
  const encoder = new TextEncoder()
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

function safeParseData(raw: string): KnowlarityRawPayload {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed
  }
}

function extractCallRecordingUrl(payload: KnowlarityRawPayload): string | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>
  const url =
    obj.call_recording ??
    obj.call_recording_url ??
    obj.recording_url ??
    obj.callRecording ??
    obj.recordingUrl ??
    (obj.data as Record<string, unknown> | undefined)?.call_recording ??
    (obj.data as Record<string, unknown> | undefined)?.call_recording_url ??
    (obj.data as Record<string, unknown> | undefined)?.recording_url

  if (typeof url === 'string' && url.trim().startsWith('http')) {
    return url.trim()
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = getSessionFromRequest(request)
    if (!currentUser) {
      return unauthorizedResponse()
    }

    console.log(`\n=================== [TELEPHONY STREAM INIT] ===================`)
    console.log(`[TELEPHONY STREAM INIT] User connected: ID="${currentUser.id}" | Role="${currentUser.role}" | AgentPhone="${currentUser.normalizedPhone}"`)

    const authKey = process.env.KNOWLARITY_AUTH_KEY?.trim()
    const apiKey = process.env.KNOWLARITY_X_API_KEY?.trim()
    const channel = process.env.KNOWLARITY_NOTIFICATION_CHANNEL?.trim() || 'Basic'

    if (!authKey && !apiKey) {
      console.error('[TELEPHONY STREAM INIT ERROR] No KNOWLARITY_AUTH_KEY or KNOWLARITY_X_API_KEY configured.')
      return errorResponse(
        'Knowlarity credentials (KNOWLARITY_AUTH_KEY, KNOWLARITY_X_API_KEY) missing',
        500
      )
    }

    const candidateUrls = getKnowlarityCandidateUrls()
    console.log('[TELEPHONY STREAM INIT] Upstream candidate URLs:', candidateUrls)

    let upstreamResponse: Response | null = null
    let usedUrl = ''

    for (const candidateUrl of candidateUrls) {
      try {
        console.log('[TELEPHONY STREAM INIT] Attempting fetch to:', candidateUrl)
        const res = await fetch(candidateUrl, {
          method: 'GET',
          headers: {
            channel,
            'x-api-key': apiKey || '',
            authorization: authKey || '',
            accept: 'text/event-stream, application/json, */*',
            'cache-control': 'no-cache',
          },
          cache: 'no-store',
        })

        if (res.ok && res.body) {
          upstreamResponse = res
          usedUrl = candidateUrl
          console.log('[TELEPHONY STREAM INIT] SUCCESS connected to Knowlarity SSE URL:', usedUrl)
          break
        } else {
          console.warn(`[TELEPHONY STREAM INIT] URL returned non-ok status: ${candidateUrl} (HTTP ${res.status})`)
        }
      } catch (fetchErr) {
        console.warn(`[TELEPHONY STREAM INIT] URL fetch error for ${candidateUrl}:`, fetchErr)
      }
    }

    if (!upstreamResponse || !upstreamResponse.body) {
      console.error('[TELEPHONY STREAM INIT ERROR] All candidate Knowlarity SSE stream URLs failed to connect.')
      return errorResponse(
        'Failed to connect to any Knowlarity notifications stream URL.',
        502
      )
    }

    const reader = upstreamResponse.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          sseChunk('ready', {
            message: 'Connected to Knowlarity notifications stream',
            channel,
            streamUrl: usedUrl,
            agentPhone: currentUser.normalizedPhone,
          })
        )

        const flushEventBlock = async (block: string) => {
          const lines = block
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)

          if (lines.length === 0) return

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

          const rawData = dataLines.join('\n')
          console.log(`\n=================== [KNOWLARITY SSE EVENT RECEIVED] ===================`)
          console.log(`[KNOWLARITY SSE RAW DATA]:`, rawData)

          const payload = safeParseData(rawData)
          const agentMatched = matchesAgentPhone(payload, currentUser.normalizedPhone, currentUser.role)
          console.log(`[KNOWLARITY SSE AGENT CHECK]: CurrentUserAgentPhone="${currentUser.normalizedPhone}" | Role="${currentUser.role}" | AgentMatched=${agentMatched}`)

          if (!agentMatched) {
            console.log(`[KNOWLARITY SSE SKIPPED]: Event does not match agent phone "${currentUser.normalizedPhone}".`)
            console.log(`=================== [KNOWLARITY SSE END] ===================\n`)
            return
          }

          const rawEventType = extractEventType(payload, eventName)
          const mapped = mapCallState(rawEventType)
          const customerPhone = extractCustomerPhone(payload, currentUser.normalizedPhone)
          const recordingUrl = extractCallRecordingUrl(payload)

          console.log(`[KNOWLARITY SSE EXTRACTED]: EventType="${rawEventType}" | RecordingUrl="${recordingUrl}"`)

          // Perform backend lead lookup directly during SSE stream handling!
          let patientInfo: PatientLookupResult | null = null
          if (customerPhone) {
            console.log(`[KNOWLARITY SSE LOOKUP]: Executing server-side lookupPatientByPhone...`)
            try {
              patientInfo = await lookupPatientByPhone(customerPhone)
            } catch (err) {
              console.error(`[KNOWLARITY SSE LOOKUP ERROR]:`, err)
            }
          }

          console.log(`[KNOWLARITY SSE ENQUEUING CHUNK]: patientInfo =`, JSON.stringify(patientInfo))
          console.log(`=================== [KNOWLARITY SSE END] ===================\n`)

          if (recordingUrl && customerPhone) {
            void (async () => {
              try {
                const leadId = patientInfo?.leadId
                const leadRef = patientInfo?.leadRef
                const patientName = patientInfo?.patientName

                const rawAgentPhone =
                  (typeof (payload as Record<string, unknown>)?.agent_number === 'string' && (payload as Record<string, unknown>).agent_number) ||
                  (typeof (payload as Record<string, unknown>)?.agent_phone === 'string' && (payload as Record<string, unknown>).agent_phone) ||
                  currentUser.normalizedPhone

                const agentDigits = normalizePhone(rawAgentPhone)
                let agentUserId = currentUser.id
                let agentName: string | null = null

                if (agentDigits) {
                  const agentUser = await prisma.user.findFirst({
                    where: {
                      OR: [
                        { phoneNumber: { contains: agentDigits } },
                        { employee: { knowlarityPhoneNumber: { contains: agentDigits } } },
                        { employee: { knowlarityCallerId: { contains: agentDigits } } },
                      ],
                    },
                    select: { id: true, name: true },
                  })

                  if (agentUser) {
                    agentUserId = agentUser.id
                    agentName = agentUser.name
                  }
                }

                await prisma.crmActivityLog.create({
                  data: {
                    action: 'KNOWLARITY_CALL_RECORDING',
                    entityType: 'CRM_LEAD',
                    entityId: leadId || 'call_recording',
                    entityLabel: leadRef && patientName ? `${leadRef} · ${patientName}` : 'Call Recording',
                    actorUserId: agentUserId,
                    actorRole: currentUser.role,
                    summary: `Knowlarity call recording saved for ${patientName || 'Call'}`,
                    metadata: {
                      callRecordingUrl: recordingUrl,
                      agentPhone: agentDigits || currentUser.normalizedPhone,
                      agentName,
                      eventType: rawEventType,
                      receivedAt: new Date().toISOString(),
                    },
                  },
                })
              } catch {}
            })()
          }

          // Do NOT send customerPhone to the frontend browser!
          controller.enqueue(
            sseChunk('call', {
              state: mapped.state,
              label: mapped.label,
              eventType: rawEventType,
              agentPhone: currentUser.normalizedPhone,
              patientInfo,
              recordingUrl,
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
                await flushEventBlock(part)
              }
            }

            if (buffer.trim()) {
              await flushEventBlock(buffer)
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
  } catch (error) {
    console.error('GET /api/telephony/stream error:', error)
    return errorResponse('Failed to initialize telephony stream', 500)
  }
}
