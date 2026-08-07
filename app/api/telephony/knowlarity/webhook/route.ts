import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    let payload: Record<string, unknown> = {}
    try {
      payload = JSON.parse(rawBody)
    } catch {
      const params = new URLSearchParams(rawBody)
      for (const [key, val] of params.entries()) {
        payload[key] = val
      }
    }

    const recordingUrl =
      (typeof payload.call_recording === 'string' && payload.call_recording) ||
      (typeof payload.call_recording_url === 'string' && payload.call_recording_url) ||
      (typeof payload.recording_url === 'string' && payload.recording_url) ||
      null

    if (!recordingUrl || !recordingUrl.startsWith('http')) {
      return errorResponse('Missing or invalid call_recording URL in payload', 400)
    }

    const customerPhone =
      (typeof payload.customer_number === 'string' && payload.customer_number) ||
      (typeof payload.caller === 'string' && payload.caller) ||
      (typeof payload.customer_phone === 'string' && payload.customer_phone) ||
      ''

    const rawAgentPhone =
      (typeof payload.agent_number === 'string' && payload.agent_number) ||
      (typeof payload.agent_phone === 'string' && payload.agent_phone) ||
      ''

    const agentDigits = rawAgentPhone ? rawAgentPhone.replace(/\D+/g, '').slice(-10) : ''
    let agentUserId: string | null = null
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

    let leadId: string | null = null
    let leadLabel: string = customerPhone ? `Call (${customerPhone})` : 'Call Recording'

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
        actorUserId: agentUserId,
        summary: `Call recording received for ${leadLabel}`,
        metadata: {
          callRecordingUrl: recordingUrl,
          customerPhone: customerPhone || null,
          agentPhone: agentDigits || null,
          agentName,
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
