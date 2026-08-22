import { prisma } from '@/lib/prisma'
import { logCrmActivity } from '@/lib/crm-activity'

export type LeadQrAuditLead = {
  id: string
  bdId: string
  leadRef: string | null
  phoneNumber: string | null
  alternateNumber?: string | null
  patientName: string | null
  campaignId: string | null
  campaignName: string | null
  circle: string
  category: string | null
}

export type LeadQrDeviceInfo = {
  deviceType: 'Mobile' | 'Tablet' | 'Desktop' | 'Unknown'
  operatingSystem: string
  operatingSystemVersion: string | null
  browser: string
  label: string
}

export async function loadLeadForQrAudit(id: string): Promise<LeadQrAuditLead | null> {
  return prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      bdId: true,
      leadRef: true,
      phoneNumber: true,
      alternateNumber: true,
      patientName: true,
      campaignId: true,
      campaignName: true,
      circle: true,
      category: true,
    },
  })
}

export function normalizeLeadQrPhone(raw: string): string {
  const digits = raw.replace(/\D+/g, '')
  if (digits.length < 10) return ''
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`
  if (digits.length === 10) return `+91${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(-10)}`
  return digits.length > 10 ? `+${digits}` : ''
}

export function normalizeLeadQrWhatsappPhone(raw: string): string {
  const digits = raw.replace(/\D+/g, '')
  if (digits.length < 10) return ''
  if (digits.startsWith('91') && digits.length === 12) return digits
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(-10)}`
  return digits.length > 10 ? digits : ''
}

export function getLeadQrClientIp(headers: Headers): string | null {
  const forwardedFor = headers.get('x-forwarded-for')
  const realIp = headers.get('x-real-ip')

  const values = [
    ...(forwardedFor
      ? forwardedFor
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : []),
    ...(realIp ? [realIp.trim()] : []),
  ]

  const uniqueValues = Array.from(new Set(values))
  return uniqueValues.length > 0 ? uniqueValues.join(', ') : null
}

export function parseLeadQrDeviceInfo(userAgent: string | null | undefined): LeadQrDeviceInfo {
  const ua = userAgent || ''
  const lower = ua.toLowerCase()

  const deviceType: LeadQrDeviceInfo['deviceType'] = /ipad|tablet|sm-t|tab/i.test(ua)
    ? 'Tablet'
    : /android|iphone|ipod|mobile/i.test(ua)
      ? 'Mobile'
      : /windows|macintosh|linux|x11/i.test(ua)
        ? 'Desktop'
        : 'Unknown'

  let operatingSystem = 'Unknown OS'
  let operatingSystemVersion: string | null = null
  if (/android/i.test(ua)) operatingSystem = 'Android'
  else if (/iphone|ipad|ipod/i.test(ua)) operatingSystem = 'iOS'
  else if (/windows/i.test(ua)) operatingSystem = 'Windows'
  else if (/mac os x|macintosh/i.test(ua)) operatingSystem = 'macOS'
  else if (/linux/i.test(ua)) operatingSystem = 'Linux'

  const androidMatch = ua.match(/Android\s+([0-9.]+)/i)
  const iosMatch = ua.match(/OS\s+([0-9_]+)\s+like Mac OS X/i)
  const windowsMatch = ua.match(/Windows NT\s+([0-9.]+)/i)
  const macMatch = ua.match(/Mac OS X\s+([0-9_]+)/i)

  if (androidMatch?.[1]) {
    operatingSystemVersion = androidMatch[1]
  } else if (iosMatch?.[1]) {
    operatingSystemVersion = iosMatch[1].replace(/_/g, '.')
  } else if (windowsMatch?.[1]) {
    operatingSystemVersion = windowsMatch[1]
  } else if (macMatch?.[1]) {
    operatingSystemVersion = macMatch[1].replace(/_/g, '.')
  }

  let browser = 'Unknown Browser'
  if (lower.includes('edg/')) browser = 'Edge'
  else if (lower.includes('opr/') || lower.includes('opera')) browser = 'Opera'
  else if (lower.includes('chrome/') && !lower.includes('edg/')) browser = 'Chrome'
  else if (lower.includes('firefox/')) browser = 'Firefox'
  else if (lower.includes('safari/') && !lower.includes('chrome/')) browser = 'Safari'

  return {
    deviceType,
    operatingSystem,
    operatingSystemVersion,
    browser,
    label: `${operatingSystem}${operatingSystemVersion ? ` ${operatingSystemVersion}` : ''} ${deviceType} · ${browser}`,
  }
}

export async function createLeadQrPublicLink(params: {
  leadId: string
  actorUserId: string
}) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  return prisma.leadQrPublicLink.create({
    data: {
      leadId: params.leadId,
      actorUserId: params.actorUserId,
      expiresAt,
    },
    select: {
      id: true,
      expiresAt: true,
    },
  })
}

export async function loadLeadQrPublicLink(id: string) {
  const link = await prisma.leadQrPublicLink.findUnique({
    where: { id },
    select: {
      id: true,
      expiresAt: true,
      lead: {
        select: {
          id: true,
          bdId: true,
          leadRef: true,
          phoneNumber: true,
          alternateNumber: true,
          patientName: true,
          campaignId: true,
          campaignName: true,
          circle: true,
          category: true,
        },
      },
      actorUser: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  })

  if (!link || link.expiresAt.getTime() < Date.now()) {
    return null
  }

  return link
}

export async function markLeadQrPublicLinkOpened(id: string) {
  await prisma.leadQrPublicLink.update({
    where: { id },
    data: { lastOpenedAt: new Date() },
  })
}

export async function recordLeadQrEvent(params: {
  headers: Headers
  requestUrl?: string | null
  route?: string | null
  method?: string | null
  lead: LeadQrAuditLead
  actorUserId: string
  actorRole: string
  actorName?: string | null
  auditAction: string
  crmAction: string
  summary: string
  source?: string | null
  phoneNumber?: string | null
  status?: 'SUCCESS' | 'FAILED'
  errorMessage?: string | null
  metadata?: Record<string, unknown> | null
}) {
  const userAgent = params.headers.get('user-agent')
  const ipAddress = getLeadQrClientIp(params.headers)
  const deviceInfo = parseLeadQrDeviceInfo(userAgent)
  const phoneNumber = params.phoneNumber ?? params.lead.phoneNumber ?? ''

  const metadata = {
    leadRef: params.lead.leadRef,
    patientName: params.lead.patientName,
    campaignId: params.lead.campaignId,
    campaignName: params.lead.campaignName,
    circle: params.lead.circle,
    category: params.lead.category,
    source: params.source ?? null,
    phoneNumber,
    actorName: params.actorName ?? null,
    ipAddress,
    userAgent,
    deviceInfo,
    ...(params.metadata ?? {}),
  }

  await prisma.leadQrCallAuditLog.create({
    data: {
      leadId: params.lead.id,
      userId: params.actorUserId,
      phoneNumber,
      action: params.auditAction,
      source: params.source ?? null,
      ipAddress,
      userAgent,
      metadata,
    },
  })

  await logCrmActivity({
    action: params.crmAction,
    entityType: 'CRM_LEAD_QR',
    entityId: params.lead.id,
    entityLabel: params.lead.patientName || params.lead.leadRef || params.lead.id,
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    route: params.route ?? null,
    method: params.method ?? null,
    status: params.status ?? 'SUCCESS',
    errorMessage: params.errorMessage ?? null,
    request: {
      headers: params.headers,
      url: params.requestUrl ?? undefined,
      method: params.method ?? undefined,
    },
    summary: params.summary,
    metadata,
  })
}
