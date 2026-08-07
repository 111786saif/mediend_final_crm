import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse } from '@/lib/api-utils'

function normalizePhone(raw: string | null | undefined): string {
  const digits = String(raw ?? '').replace(/\D+/g, '')
  if (digits.length >= 10) return digits.slice(-10)
  return digits
}

function extractCallRecordingUrl(payload: Record<string, unknown>): string | null {
  const url =
    payload.call_recording ??
    payload.call_recording_url ??
    payload.recording_url ??
    payload.callRecording ??
    payload.recordingUrl ??
    (payload.data as Record<string, unknown> | undefined)?.call_recording ??
    (payload.data as Record<string, unknown> | undefined)?.call_recording_url ??
    (payload.data as Record<string, unknown> | undefined)?.recording_url

  if (typeof url === 'string' && url.trim().startsWith('http')) {
    return url.trim()
  }
  return null
}

function extractCustomerPhone(payload: Record<string, unknown>): string | null {
  const candidates = [
    payload.customer_number,
    payload.customer_phone,
    payload.customerPhone,
    payload.customer,
    payload.call_from,
    payload.caller,
    payload.destination,
    payload.phone,
    payload.mobile,
  ]

  for (const item of candidates) {
    if (item && (typeof item === 'string' || typeof item === 'number')) {
      const digits = normalizePhone(String(item))
      if (digits.length >= 7) return digits
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    let payload: Record<string, unknown> = {}
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      payload = (await request.json().catch(() => ({}))) as Record<string, unknown>
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      const entries: Record<string, unknown> = {}
      formData.forEach((value, key) => {
        entries[key] = value
      })
      payload = entries
    }

    const recordingUrl = extractCallRecordingUrl(payload)
    const customerPhone = extractCustomerPhone(payload)

    if (!recordingUrl) {
      return errorResponse('No call_recording URL found in webhook payload', 400)
    }

    let leadId: string | null = null
    let leadLabel: string = customerPhone || 'Unknown'

    if (customerPhone) {
      const lead = await prisma.lead.findFirst({
        where: {
          OR: [
            { phoneNumber: { contains: customerPhone } },
            { alternateNumber: { contains: customerPhone } },
          ],
        },
        select: { id: true, leadRef: true, patientName: true },
        orderBy: { createdDate: 'asc' },
      })

      if (lead) {
        leadId = lead.id
        leadLabel = `${lead.leadRef} · ${lead.patientName}`
      }
    }

    const logEntry = await prisma.crmActivityLog.create({
      data: {
        action: 'KNOWLARITY_CALL_RECORDING',
        entityType: 'CRM_LEAD',
        entityId: leadId || customerPhone || 'unknown',
        entityLabel: leadLabel,
        summary: `Call recording received for ${leadLabel}`,
        metadata: {
          callRecordingUrl: recordingUrl,
          customerPhone: customerPhone || null,
          agentPhone: String(payload.agent_number || payload.agent_phone || ''),
          eventType: String(payload.event_type || payload.type || 'HANGUP'),
          payload,
          receivedAt: new Date().toISOString(),
        },
      },
    })

    return successResponse({ id: logEntry.id, recordingUrl }, 'Call recording saved successfully')
  } catch (error) {
    console.error('POST /api/telephony/knowlarity/webhook error:', error)
    return errorResponse('Failed to process call recording webhook', 500)
  }
}
