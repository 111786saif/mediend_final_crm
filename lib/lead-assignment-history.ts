type LeadAssignmentHistoryLead = {
  id: number
  leadRef?: string | null
  patientName?: string | null
  createdDate?: Date | string | null
  assignedDate?: Date | string | null
  bd?: {
    id: string
    name: string | null
    email?: string | null
  } | null
}

type LeadAssignmentHistoryLog = {
  id: string
  action: string
  summary?: string | null
  createdAt: Date | string
  actorRole?: string | null
  metadata?: unknown
  actorUser?: {
    id: string
    name: string | null
    email: string | null
  } | null
}

export type LeadAssignmentHistoryItem = {
  id: string
  source: 'initial' | 'reassigned' | 'current'
  assignedAt: string
  changedAt: string
  assignedTo: {
    id: string | null
    name: string | null
  }
  changedBy: {
    id: string | null
    name: string | null
    role: string | null
  } | null
  previousAssignedTo: {
    id: string | null
    name: string | null
  } | null
  automatic: boolean
  summary: string
}

type ParsedAssignmentMetadata = {
  previousBdId: string | null
  previousBdName: string | null
  nextBdId: string | null
  nextBdName: string | null
  previousAssignedDate: Date | null
  nextAssignedDate: Date | null
  automatic: boolean
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseDateValue(value: unknown) {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toMetadataRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function parseAssignmentMetadata(value: unknown): ParsedAssignmentMetadata {
  const record = toMetadataRecord(value)

  return {
    previousBdId: normalizeText(record?.previousBdId),
    previousBdName: normalizeText(record?.previousBdName),
    nextBdId: normalizeText(record?.nextBdId),
    nextBdName: normalizeText(record?.nextBdName),
    previousAssignedDate: parseDateValue(record?.previousAssignedDate),
    nextAssignedDate: parseDateValue(record?.nextAssignedDate),
    automatic: record?.automatic === true,
  }
}

function getIsoString(value: Date | string | null | undefined) {
  const parsed = parseDateValue(value)
  return parsed ? parsed.toISOString() : null
}

function makeHistoryItem(input: {
  id: string
  source: LeadAssignmentHistoryItem['source']
  assignedAt: Date
  changedAt: Date
  assignedTo: LeadAssignmentHistoryItem['assignedTo']
  previousAssignedTo?: LeadAssignmentHistoryItem['previousAssignedTo']
  changedBy?: LeadAssignmentHistoryItem['changedBy']
  automatic?: boolean
  summary: string
}): LeadAssignmentHistoryItem {
  return {
    id: input.id,
    source: input.source,
    assignedAt: input.assignedAt.toISOString(),
    changedAt: input.changedAt.toISOString(),
    assignedTo: input.assignedTo,
    previousAssignedTo: input.previousAssignedTo ?? null,
    changedBy: input.changedBy ?? null,
    automatic: input.automatic === true,
    summary: input.summary,
  }
}

export function isLeadAssignmentActivityAction(action: string | null | undefined) {
  const normalized = String(action ?? '').trim().toUpperCase()
  return normalized === 'CRM_LEAD_REASSIGNED' || normalized === 'CRM_LEAD_ASSIGNED'
}

export function buildLeadAssignmentHistory(
  lead: LeadAssignmentHistoryLead,
  logs: readonly LeadAssignmentHistoryLog[]
) {
  const assignmentLogs = logs
    .filter((log) => isLeadAssignmentActivityAction(log.action))
    .map((log) => ({
      ...log,
      createdAt: parseDateValue(log.createdAt),
      parsed: parseAssignmentMetadata(log.metadata),
    }))
    .filter((log): log is typeof log & { createdAt: Date } => log.createdAt instanceof Date)
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())

  const items: LeadAssignmentHistoryItem[] = []
  const seenKeys = new Set<string>()

  function pushItem(item: LeadAssignmentHistoryItem | null) {
    if (!item) return
    const key = [
      item.assignedTo.id ?? item.assignedTo.name ?? 'unknown',
      item.assignedAt,
      item.source,
    ].join('|')
    if (seenKeys.has(key)) return
    seenKeys.add(key)
    items.push(item)
  }

  if (assignmentLogs.length > 0) {
    const firstLog = assignmentLogs[0]
    if (firstLog.parsed.previousBdId || firstLog.parsed.previousBdName) {
      pushItem(
        makeHistoryItem({
          id: `${firstLog.id}:initial`,
          source: 'initial',
          assignedAt:
            firstLog.parsed.previousAssignedDate ??
            firstLog.createdAt,
          changedAt:
            firstLog.parsed.previousAssignedDate ??
            firstLog.createdAt,
          assignedTo: {
            id: firstLog.parsed.previousBdId,
            name: firstLog.parsed.previousBdName,
          },
          summary: `Initially assigned to ${firstLog.parsed.previousBdName ?? 'Unknown user'}`,
        })
      )
    }

    for (const log of assignmentLogs) {
      if (!log.parsed.nextBdId && !log.parsed.nextBdName) {
        continue
      }

      pushItem(
        makeHistoryItem({
          id: log.id,
          source: 'reassigned',
          assignedAt: log.parsed.nextAssignedDate ?? log.createdAt,
          changedAt: log.createdAt,
          assignedTo: {
            id: log.parsed.nextBdId,
            name: log.parsed.nextBdName,
          },
          previousAssignedTo:
            log.parsed.previousBdId || log.parsed.previousBdName
              ? {
                  id: log.parsed.previousBdId,
                  name: log.parsed.previousBdName,
                }
              : null,
          changedBy: {
            id: log.actorUser?.id ?? null,
            name: log.actorUser?.name ?? log.actorUser?.email ?? null,
            role: log.actorRole ?? null,
          },
          automatic: log.parsed.automatic,
          summary:
            normalizeText(log.summary) ??
            `Reassigned to ${log.parsed.nextBdName ?? 'Unknown user'}`,
        })
      )
    }
  }

  const currentOwnerId = lead.bd?.id ?? null
  const currentOwnerName = normalizeText(lead.bd?.name) ?? null
  const currentAssignedAt =
    parseDateValue(lead.assignedDate) ??
    parseDateValue(lead.createdDate)

  if (items.length === 0 && (currentOwnerId || currentOwnerName) && currentAssignedAt) {
    pushItem(
      makeHistoryItem({
        id: `current-known-owner-${lead.id}`,
        source: 'current',
        assignedAt: currentAssignedAt,
        changedAt: currentAssignedAt,
        assignedTo: {
          id: currentOwnerId,
          name: currentOwnerName,
        },
        summary: `Current known owner is ${currentOwnerName ?? 'Unknown user'}`,
      })
    )
  } else if (items.length > 0 && (currentOwnerId || currentOwnerName) && currentAssignedAt) {
    const lastItem = items[items.length - 1]
    if (
      lastItem.assignedTo.id !== currentOwnerId ||
      lastItem.assignedAt !== currentAssignedAt.toISOString()
    ) {
      pushItem(
        makeHistoryItem({
          id: `current-owner-${lead.id}`,
          source: 'current',
          assignedAt: currentAssignedAt,
          changedAt: currentAssignedAt,
          assignedTo: {
            id: currentOwnerId,
            name: currentOwnerName,
          },
          summary: `Current owner is ${currentOwnerName ?? 'Unknown user'}`,
        })
      )
    }
  }

  return items.sort((left, right) => {
    const assignedDelta =
      new Date(left.assignedAt).getTime() - new Date(right.assignedAt).getTime()
    if (assignedDelta !== 0) return assignedDelta
    return new Date(left.changedAt).getTime() - new Date(right.changedAt).getTime()
  })
}

export function getAssignmentHistoryLatestTimestamp(
  logs: readonly LeadAssignmentHistoryLog[]
) {
  const values = logs
    .filter((log) => isLeadAssignmentActivityAction(log.action))
    .map((log) => getIsoString(log.createdAt))
    .filter((value): value is string => Boolean(value))

  return values.length > 0 ? values.sort().at(-1) ?? null : null
}
