import { prisma } from '@/lib/prisma'

type CrmActivityStatus = 'SUCCESS' | 'FAILED'

type CrmActivityRequestLike = {
  method?: string
  nextUrl?: { pathname?: string }
  url?: string
  headers: Headers
}

export type CrmActivityLogInput = {
  action: string
  entityType: string
  summary: string
  status?: CrmActivityStatus
  entityId?: string | number | null
  entityLabel?: string | number | null
  actorUserId?: string | null
  actorRole?: string | null
  metadata?: unknown
  errorMessage?: string | null
  request?: CrmActivityRequestLike | Request | null
  route?: string | null
  method?: string | null
}

function getRouteFromRequest(request: CrmActivityRequestLike | Request | null | undefined) {
  if (!request) return null
  if ('nextUrl' in request && request.nextUrl?.pathname) {
    return request.nextUrl.pathname
  }
  if ('url' in request && request.url) {
    try {
      return new URL(request.url).pathname
    } catch {
      return null
    }
  }
  return null
}

function getIpAddress(headers: Headers) {
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

function toJsonSafeValue(value: unknown) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value)) as object
}

export async function logCrmActivity(input: CrmActivityLogInput) {
  try {
    const headers = input.request?.headers
    await prisma.crmActivityLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId == null ? null : String(input.entityId),
        entityLabel: input.entityLabel == null ? null : String(input.entityLabel),
        status: input.status ?? 'SUCCESS',
        summary: input.summary,
        metadata: toJsonSafeValue(input.metadata),
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole ?? null,
        route: input.route ?? getRouteFromRequest(input.request ?? null),
        method: input.method ?? input.request?.method ?? null,
        ipAddress: headers ? getIpAddress(headers) : null,
        userAgent: headers?.get('user-agent') ?? null,
        errorMessage: input.errorMessage ?? null,
      },
    })
  } catch (error) {
    console.error('Failed to write CRM activity log:', error)
  }
}
