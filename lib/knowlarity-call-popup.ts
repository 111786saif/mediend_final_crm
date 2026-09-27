export const WORKSPACE_MAKE_CALL_POPUP_EVENT = 'workspace-make-call-popup'

export type WorkspaceMakeCallPopup = {
  state: 'on_call'
  label: 'Call initiated'
  eventType: 'workspace_make_call'
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
