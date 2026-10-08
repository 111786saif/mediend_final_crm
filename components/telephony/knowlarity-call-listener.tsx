'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  MessageSquarePlus,
  Phone,
  PhoneCall,
  PhoneForwarded,
  PhoneOff,
  Send,
  Stethoscope,
  Tag,
  User,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { apiPost } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  WORKSPACE_MAKE_CALL_POPUP_EVENT,
  extractKnowlarityCallId,
  type WorkspaceMakeCallPopup,
} from '@/lib/knowlarity-call-popup'
import {
  updateKnowlarityCallQueue,
  type CallState,
  type CallQueueItem,
  type StreamCallEvent,
} from '@/lib/knowlarity-call-queue'

const DISMISSED_CALL_WINDOW_MS = 2 * 60 * 1000
const DISMISSED_CALLS_STORAGE_KEY = 'knowlarity-dismissed-call-popups'

type PatientLookup = {
  found: boolean
  type?: 'lead' | 'incoming_lead'
  leadId?: number | null
  leadRef?: string | null
  patientName?: string | null
  treatment?: string | null
  category?: string | null
  status?: string | null
  bdName?: string | null
}

function persistDismissedCallKeys(dismissedCallKeys: Map<string, number>) {
  try {
    window.sessionStorage.setItem(
      DISMISSED_CALLS_STORAGE_KEY,
      JSON.stringify([...dismissedCallKeys.entries()])
    )
  } catch {
    // Session storage is optional; the in-memory dismissal still prevents immediate replays.
  }
}

const stateStyles: Record<CallState, { icon: typeof Phone; badge: string; tone: string }> = {
  receiving_call: {
    icon: PhoneForwarded,
    badge: 'Receiving Call',
    tone: 'border-amber-500/40 bg-amber-950/90 text-amber-100 dark:bg-amber-950/90',
  },
  on_call: {
    icon: PhoneCall,
    badge: 'On Call',
    tone: 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100 dark:bg-emerald-950/90',
  },
  call_finished: {
    icon: PhoneOff,
    badge: 'Call Finished',
    tone: 'border-slate-500/40 bg-slate-900/90 text-slate-100 dark:bg-slate-900/90',
  },
  update: {
    icon: Phone,
    badge: 'Call Update',
    tone: 'border-primary/40 bg-card/95 text-card-foreground',
  },
}

function formatTimestamp(value?: string) {
  if (!value) return null
  try {
    return new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(new Date(value))
  } catch {
    return null
  }
}

export function KnowlarityCallListener() {
  const [callQueue, setCallQueue] = useState<CallQueueItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const dismissedCallKeysRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    dismissedCallKeysRef.current = readDismissedCallKeys()
    const source = new EventSource('/api/telephony/stream')

    const enqueueCall = (payload: StreamCallEvent) => {
      const callId = payload.callId || extractKnowlarityCallId(payload.payload)
      payload = { ...payload, callId }
      const callKey = callId || `call_${window.crypto.randomUUID()}`

      if (payload.state === 'call_finished') {
        dismissedCallKeysRef.current.set(callKey, Date.now() + DISMISSED_CALL_WINDOW_MS)
        persistDismissedCallKeys(dismissedCallKeysRef.current)
        setCallQueue((prev) => updateKnowlarityCallQueue(prev, payload, callKey))
        return
      }

      const dismissedUntil = dismissedCallKeysRef.current.get(callKey)
      if (dismissedUntil && dismissedUntil > Date.now()) return

      setCallQueue((prev) => updateKnowlarityCallQueue(prev, payload, callKey))

      setSelectedIndex(0)
    }

    source.addEventListener('ready', (message) => {
      try {
        const payload = JSON.parse((message as MessageEvent<string>).data) as StreamCallEvent
        if (payload.telephonyEnabled === false) {
          setCallQueue([])
          source.close()
        }
      } catch {
        // Ignore malformed ready events and keep waiting for call events.
      }
    })

    source.addEventListener('call', (message) => {
      try {
        const payload = JSON.parse((message as MessageEvent<string>).data) as StreamCallEvent
        enqueueCall(payload)
      } catch {
        // ignore malformed stream events
      }
    })

    const handleWorkspaceMakeCall = (event: Event) => {
      const popup = (event as CustomEvent<WorkspaceMakeCallPopup>).detail
      if (popup) enqueueCall(popup)
    }
    window.addEventListener(WORKSPACE_MAKE_CALL_POPUP_EVENT, handleWorkspaceMakeCall)

    return () => {
      source.close()
      window.removeEventListener(WORKSPACE_MAKE_CALL_POPUP_EVENT, handleWorkspaceMakeCall)
    }
  }, [])

  // Clamp selectedIndex within bounds
  const currentItem = useMemo(() => {
    if (callQueue.length === 0) return null
    const safeIdx = Math.min(Math.max(0, selectedIndex), callQueue.length - 1)
    return callQueue[safeIdx]
  }, [callQueue, selectedIndex])

  const display = useMemo(() => {
    if (!currentItem) return null
    const style = stateStyles[currentItem.event.state]
    const Icon = style.icon
    return {
      ...style,
      Icon,
      timestamp: formatTimestamp(currentItem.event.receivedAt),
    }
  }, [currentItem])

  const handleSaveRemark = async () => {
    if (!currentItem || !currentItem.remarkText.trim()) return
    const currentKey = currentItem.key
    const patientInfo = currentItem.event.patientInfo

    setCallQueue((prev) =>
      prev.map((item) =>
        item.key === currentKey ? { ...item, isSavingRemark: true } : item
      )
    )

    try {
      await apiPost('/api/telephony/remarks', {
        leadId: patientInfo?.leadId || undefined,
        content: currentItem.remarkText.trim(),
      })
      toast.success(
        patientInfo?.patientName
          ? `Remark saved for ${patientInfo.patientName}`
          : 'Call remark saved successfully'
      )
      setCallQueue((prev) =>
        prev.map((item) =>
          item.key === currentKey ? { ...item, remarkText: '', isSavingRemark: false } : item
        )
      )
    } catch {
      toast.error('Failed to save call remark')
      setCallQueue((prev) =>
        prev.map((item) =>
          item.key === currentKey ? { ...item, isSavingRemark: false } : item
        )
      )
    }
  }

  const handleCloseCall = (key: string) => {
    const dismissedUntil = Date.now() + DISMISSED_CALL_WINDOW_MS
    dismissedCallKeysRef.current.set(key, dismissedUntil)
    if (currentItem?.event.callId) {
      dismissedCallKeysRef.current.set(currentItem.event.callId, dismissedUntil)
    }
    persistDismissedCallKeys(dismissedCallKeysRef.current)
    setCallQueue((prev) => prev.filter((item) => item.key !== key))
  }

  if (!currentItem || !display) return null

  const patientInfo = currentItem.event.patientInfo
  const totalCalls = callQueue.length
  const currentNum = Math.min(Math.max(0, selectedIndex), totalCalls - 1) + 1

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-4">
      <div
        className={cn(
          'pointer-events-auto flex w-full max-w-lg flex-col gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl transition-all duration-300',
          display.tone
        )}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-white/20 p-1.5 bg-white/10">
              <display.Icon className="h-4 w-4 animate-pulse" />
            </div>
            <span className="rounded-full border border-white/20 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider">
              {display.badge}
            </span>

            {/* Concurrent Active Calls Navigation Badge (only shown if >1 call active simultaneously) */}
            {totalCalls > 1 ? (
              <div className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5 text-[11px] font-medium">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 hover:bg-white/20 text-current"
                  disabled={selectedIndex <= 0}
                  onClick={() => setSelectedIndex((i) => Math.max(0, i - 1))}
                  title="Previous active call"
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span>
                  Call {currentNum} of {totalCalls}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 hover:bg-white/20 text-current"
                  disabled={selectedIndex >= totalCalls - 1}
                  onClick={() => setSelectedIndex((i) => Math.min(totalCalls - 1, i + 1))}
                  title="Next active call"
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            ) : display.timestamp ? (
              <span className="text-xs opacity-75">{display.timestamp}</span>
            ) : null}
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg bg-white text-slate-950 shadow-sm hover:bg-slate-100 hover:text-slate-950"
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? 'Expand notification' : 'Collapse notification'}
              aria-label={isCollapsed ? 'Expand notification' : 'Collapse notification'}
            >
              {isCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg bg-rose-600 text-white shadow-sm hover:bg-rose-700 hover:text-white"
              onClick={() => handleCloseCall(currentItem.key)}
              title="Close notification"
              aria-label="Close notification"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {!isCollapsed && (
          <>
            {/* Patient & Lead Details Card */}
            <div className="grid gap-2 rounded-xl bg-black/20 p-3 text-sm border border-white/10">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="h-4 w-4 shrink-0 opacity-80" />
                  <span className="font-semibold truncate">
                    {patientInfo?.patientName ? (
                      patientInfo.patientName
                    ) : (
                      'Unknown Patient / New Caller'
                    )}
                  </span>
                  {patientInfo?.leadRef ? (
                    <Badge variant="outline" className="text-[10px] font-mono border-white/30 text-current">
                      {patientInfo.leadRef}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-xs opacity-90">
                <div className="flex items-center gap-1.5 truncate">
                  <Stethoscope className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="opacity-75">Treatment:</span>
                  <span className="font-medium truncate">{patientInfo?.treatment || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                  <Tag className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="opacity-75">Category:</span>
                  <span className="font-medium truncate">{patientInfo?.category || 'N/A'}</span>
                </div>
              </div>

              {patientInfo?.status ? (
                <div className="flex items-center gap-2 pt-1 border-t border-white/10 text-xs">
                  <span className="opacity-75">Lead Status:</span>
                  <Badge variant="secondary" className="text-[11px] bg-white/20 text-current font-medium">
                    {patientInfo.status}
                  </Badge>
                  {patientInfo.bdName ? (
                    <span className="ml-auto text-[11px] opacity-75 truncate">
                      BD: {patientInfo.bdName}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Call Remarks Section */}
            <div className="flex items-center gap-2 pt-1">
              <div className="relative flex-1">
                <MessageSquarePlus className="absolute left-2.5 top-2.5 h-4 w-4 opacity-60 text-current" />
                <Input
                  value={currentItem.remarkText}
                  onChange={(e) => {
                    const text = e.target.value
                    setCallQueue((prev) =>
                      prev.map((item) =>
                        item.key === currentItem.key ? { ...item, remarkText: text } : item
                      )
                    )
                  }}
                  placeholder="Insert call remark / notes..."
                  className="pl-8 text-xs bg-black/20 border-white/20 text-current placeholder:text-current/50 h-9 focus-visible:ring-white/30"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSaveRemark()
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="h-9 px-3 bg-white/20 hover:bg-white/30 text-current font-medium text-xs gap-1.5 shrink-0"
                onClick={handleSaveRemark}
                disabled={!currentItem.remarkText.trim() || currentItem.isSavingRemark}
              >
                {currentItem.isSavingRemark ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Save
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
