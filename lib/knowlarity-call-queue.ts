export type CallState = 'receiving_call' | 'on_call' | 'call_finished' | 'update'

type PatientLookup = {
  found: boolean
  type?: 'lead' | 'incoming_lead'
  leadId?: string | null
  leadRef?: string | null
  patientName?: string | null
  treatment?: string | null
  category?: string | null
  status?: string | null
  bdName?: string | null
}

export type StreamCallEvent = {
  state: CallState
  label: string
  eventType: string
  callId?: string | null
  agentPhone?: string | null
  telephonyEnabled?: boolean
  patientInfo?: PatientLookup | null
  recordingUrl?: string | null
  payload?: unknown
  receivedAt?: string
}

export type CallQueueItem = {
  key: string
  event: StreamCallEvent
  remarkText: string
  isWorkspaceCall?: boolean
  isSavingRemark?: boolean
}

const WORKSPACE_CALL_DEDUP_WINDOW_MS = 2 * 60 * 1000

export function updateKnowlarityCallQueue(
  queue: CallQueueItem[],
  payload: StreamCallEvent,
  callKey: string
): CallQueueItem[] {
  // A lead can have multiple calls. Only a provider call ID can end a popup.
  const matchesCallId = (item: CallQueueItem) =>
    Boolean(payload.callId) &&
    (item.key === payload.callId || item.event.callId === payload.callId)

  if (payload.state === 'call_finished') {
    return queue.filter((item) => !matchesCallId(item))
  }

  let existingIdx = queue.findIndex(matchesCallId)
  const isWorkspaceCall = payload.eventType === 'workspace_make_call'

  // Bind a provisional outgoing popup once, using an active event. End events
  // must never bind by patient: they may belong to an earlier call.
  if (
    existingIdx < 0 &&
    !isWorkspaceCall &&
    (payload.state === 'receiving_call' || payload.state === 'on_call') &&
    payload.callId &&
    payload.patientInfo?.leadId
  ) {
    const eventTime = new Date(payload.receivedAt ?? '').getTime()
    const candidates = queue.filter((item) => {
      const timeDifference = eventTime - new Date(item.event.receivedAt ?? '').getTime()
      return item.isWorkspaceCall &&
        !item.event.callId &&
        item.event.patientInfo?.leadId === payload.patientInfo?.leadId &&
        Math.abs(timeDifference) <= WORKSPACE_CALL_DEDUP_WINDOW_MS
    })
    if (candidates.length === 1) existingIdx = queue.indexOf(candidates[0])
  }

  if (existingIdx >= 0) {
    return queue.map((item, index) => index === existingIdx ? {
      ...item,
      event: {
        ...payload,
        callId: payload.callId || item.event.callId,
        patientInfo: payload.patientInfo?.leadId
          ? payload.patientInfo
          : item.event.patientInfo ?? payload.patientInfo,
      },
      isWorkspaceCall: item.isWorkspaceCall || isWorkspaceCall,
    } : item)
  }

  return [{ key: callKey, event: payload, remarkText: '', isWorkspaceCall }, ...queue].slice(0, 3)
}
