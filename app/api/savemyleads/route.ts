import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/api-utils'
import { logCrmActivity } from '@/lib/crm-activity'
import {
  getBusinessMonthYear,
  normalizePhoneToLast10,
  processSaveMyLeadsIncomingLead,
} from '@/lib/crm-campaigns'
import { prisma } from '@/lib/prisma'

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

function extractSaveMyLeadsFields(payload: unknown) {
  const record =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {}

  const campaignId =
    record.campaignId ??
    record['campaign id'] ??
    record.campaign_id ??
    record.campaign ??
    null
  const name = record.name ?? record.patientName ?? record.patient_name ?? null
  const phone = record.phone ?? record.phoneNumber ?? record.mobile ?? record.mobileNumber ?? null
  const email = record.email ?? null

  return {
    campaignId: campaignId == null ? null : String(campaignId).trim(),
    name: name == null ? null : String(name).trim(),
    phone: phone == null ? null : String(phone).trim(),
    email: email == null ? null : String(email).trim(),
  }
}

export async function POST(request: Request) {
  const receivedAt = new Date()
  let incomingLeadId: string | null = null

  try {
    const contentType = request.headers.get('content-type') ?? 'unknown'
    const rawBody = await request.text()
    const parsedPayload = parseWebhookBody(rawBody, contentType)
    const extracted = extractSaveMyLeadsFields(parsedPayload)

    const incomingLead = await prisma.incomingLead.create({
      data: {
        source: 'savemyleads',
        payload: {
          data: parsedPayload,
          contentType,
          headers: getSafeHeaders(request.headers),
        },
        externalCampaignId: extracted.campaignId || null,
        normalizedPhone: normalizePhoneToLast10(extracted.phone) ?? null,
      },
      select: {
        id: true,
      },
    })
    incomingLeadId = incomingLead.id

    if (!extracted.campaignId) {
      await prisma.incomingLead.update({
        where: { id: incomingLead.id },
        data: {
          status: 'FAILED',
          errorMessage: 'campaignId is required.',
          processedAt: receivedAt,
        },
      })
      return errorResponse('campaignId is required.', 400)
    }

    if (!extracted.name) {
      await prisma.incomingLead.update({
        where: { id: incomingLead.id },
        data: {
          status: 'FAILED',
          errorMessage: 'name is required.',
          processedAt: receivedAt,
        },
      })
      return errorResponse('name is required.', 400)
    }

    if (!extracted.phone) {
      await prisma.incomingLead.update({
        where: { id: incomingLead.id },
        data: {
          status: 'FAILED',
          errorMessage: 'phone is required.',
          processedAt: receivedAt,
        },
      })
      return errorResponse('phone is required.', 400)
    }

    const result = await processSaveMyLeadsIncomingLead({
      incomingLeadId: incomingLead.id,
      externalCampaignId: extracted.campaignId,
      patientName: extracted.name,
      phone: extracted.phone,
      email: extracted.email,
      receivedAt,
    })
    const responseData = {
      deduplicated: result.deduplicated,
      leadId: result.leadId,
      leadRef: result.leadRef,
      campaign: result.campaign,
      teamLead: result.teamLead,
      bd: result.bd,
    }

    console.log(
      '[savemyleads] Lead processed',
      JSON.stringify(
        {
          incomingLeadId: incomingLead.id,
          receivedAt: receivedAt.toISOString(),
          campaignId: extracted.campaignId,
          leadId: responseData.leadId,
          deduplicated: responseData.deduplicated,
          teamLead: responseData.teamLead,
          bd: responseData.bd,
        },
        null,
        2
      )
    )

    await logCrmActivity({
      action: 'SAVEMYLEADS_WEBHOOK_PROCESSED',
      entityType: 'CRM_WEBHOOK',
      entityId: incomingLead.id,
      entityLabel: extracted.campaignId,
      status: 'SUCCESS',
      request,
      summary: responseData.deduplicated
        ? `Processed duplicate SaveMyLeads webhook for campaign ${extracted.campaignId}`
        : `Processed SaveMyLeads webhook for campaign ${extracted.campaignId}`,
      metadata: {
        incomingLeadId: incomingLead.id,
        campaignId: extracted.campaignId,
        patientName: extracted.name,
        normalizedPhone: normalizePhoneToLast10(extracted.phone),
        deduplicated: responseData.deduplicated,
        leadId: responseData.leadId,
        leadRef: responseData.leadRef,
        teamLead: responseData.teamLead,
        bd: responseData.bd,
      },
    })

    return NextResponse.json({
      success: true,
      message: responseData.deduplicated ? 'Duplicate lead detected' : 'Lead created successfully',
      incomingLeadId: incomingLead.id,
      ...responseData,
    })
  } catch (error) {
    console.error('[savemyleads] Failed to process webhook:', error)
    const message = error instanceof Error ? error.message : 'Failed to process webhook payload'
    const isConfigurationError =
      /required|configured|inactive|assignment|available|digits/i.test(message)

    if (incomingLeadId) {
      await prisma.incomingLead.update({
        where: { id: incomingLeadId },
        data: {
          status: 'FAILED',
          errorMessage: message,
          processedAt: receivedAt,
        },
      }).catch(() => {
        return null
      })
    }

    await logCrmActivity({
      action: 'SAVEMYLEADS_WEBHOOK_PROCESSED',
      entityType: 'CRM_WEBHOOK',
      entityId: incomingLeadId,
      entityLabel: 'SaveMyLeads',
      status: 'FAILED',
      request,
      summary: 'SaveMyLeads webhook processing failed',
      errorMessage: message,
      metadata: {
        incomingLeadId,
      },
    })

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: isConfigurationError ? 400 : 500 }
    )
  }
}

export async function GET() {
  const { month, year } = getBusinessMonthYear()

  return NextResponse.json({
    success: true,
    message: 'SaveMyLeads webhook endpoint is ready',
    endpoint: '/api/savemyleads',
    method: 'POST',
    expectedFields: ['campaignId', 'name', 'phone', 'email'],
    activeBusinessMonth: month,
    activeBusinessYear: year,
  })
}
