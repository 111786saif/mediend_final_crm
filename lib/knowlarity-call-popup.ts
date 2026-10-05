export const WORKSPACE_MAKE_CALL_POPUP_EVENT = 'workspace-make-call-popup'

export type WorkspaceMakeCallPopup = {
  state: 'on_call'
  label: 'Call initiated'
  eventType: 'workspace_make_call'
  callId?: string | null
  agentPhone: string
  patientInfo: {
    found: true
    type: 'lead'
    leadId: string
    leadRef: string | null
    patientName: string | null
    category: string | null
  }
  receivedAt: string
}

export type WorkspaceMakeCallResult = {
  customerNumber: string
  agentNumber: string
  knowlarity: unknown
  popup: WorkspaceMakeCallPopup
}

export function showWorkspaceMakeCallPopup(popup: WorkspaceMakeCallPopup) {
  window.dispatchEvent(
    new CustomEvent<WorkspaceMakeCallPopup>(WORKSPACE_MAKE_CALL_POPUP_EVENT, {
      detail: popup,
    })
  )
}

export function extractKnowlarityCallId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null

  const root = payload as Record<string, unknown>
  const dataObj = root.data as Record<string, unknown> | undefined
  const successObj = root.success as Record<string, unknown> | undefined
  const candidates = [
    root.uuid,
    root.unique_id,
    root.call_id,
    root.callId,
    dataObj?.uuid,
    dataObj?.unique_id,
    dataObj?.call_id,
    dataObj?.callId,
    successObj?.uuid,
    successObj?.unique_id,
    successObj?.call_id,
    successObj?.callId,
  ]

  for (const candidate of candidates) {
    if ((typeof candidate === 'string' || typeof candidate === 'number') && String(candidate).trim()) {
      return String(candidate).trim().slice(0, 200)
    }
  }

  return null
}
