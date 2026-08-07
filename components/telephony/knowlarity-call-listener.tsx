'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
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

type CallState = 'receiving_call' | 'on_call' | 'call_finished' | 'update'

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

type StreamCallEvent = {
  state: CallState
  label: string
  eventType: string
  agentPhone?: string | null
  patientInfo?: PatientLookup | null
  recordingUrl?: string | null
  payload?: unknown
  receivedAt?: string
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
  const [event, setEvent] = useState<StreamCallEvent | null>(null)
  const [connected, setConnected] = useState(false)
  const [patientInfo, setPatientInfo] = useState<PatientLookup | null>(null)
  const [remarkText, setRemarkText] = useState('')
  const [isSavingRemark, setIsSavingRemark] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const hideTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const source = new EventSource('/api/telephony/stream')

    const clearHideTimer = () => {
      if (hideTimerRef.current != null) {
        window.clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
    }

    source.addEventListener('open', () => {
      setConnected(true)
    })

    source.addEventListener('ready', () => {
      setConnected(true)
    })

    source.addEventListener('error', () => {
      setConnected(false)
    })

    source.addEventListener('call', (message) => {
      try {
        const payload = JSON.parse((message as MessageEvent<string>).data) as StreamCallEvent
        clearHideTimer()
        setEvent(payload)

        if (payload.patientInfo != null) {
          setPatientInfo(payload.patientInfo)
        }

        if (payload.state === 'call_finished') {
          hideTimerRef.current = window.setTimeout(() => {
            setEvent((current) =>
              current?.receivedAt === payload.receivedAt ? null : current
            )
            hideTimerRef.current = null
          }, 12000)
        }
      } catch {
        // ignore malformed stream events
      }
    })

    return () => {
      clearHideTimer()
      source.close()
    }
  }, [])

  const display = useMemo(() => {
    if (!event) return null
    const style = stateStyles[event.state]
    const Icon = style.icon
    return {
      ...style,
      Icon,
      timestamp: formatTimestamp(event.receivedAt),
    }
  }, [event])

  const handleSaveRemark = async () => {
    if (!remarkText.trim()) return
    setIsSavingRemark(true)
    try {
      await apiPost('/api/telephony/remarks', {
        leadId: patientInfo?.leadId || undefined,
        content: remarkText.trim(),
      })
      toast.success(
        patientInfo?.patientName
          ? `Remark saved for ${patientInfo.patientName}`
          : 'Call remark saved successfully'
      )
      setRemarkText('')
    } catch {
      toast.error('Failed to save call remark')
    } finally {
      setIsSavingRemark(false)
    }
  }

  if (!display || !connected) return null

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
            {display.timestamp ? (
              <span className="text-xs opacity-75">{display.timestamp}</span>
            ) : null}
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-current hover:bg-white/10"
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? 'Expand notification' : 'Collapse notification'}
            >
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-current hover:bg-white/10"
              onClick={() => setEvent(null)}
              title="Close notification"
            >
              <X className="h-4 w-4" />
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
                  value={remarkText}
                  onChange={(e) => setRemarkText(e.target.value)}
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
                disabled={!remarkText.trim() || isSavingRemark}
              >
                {isSavingRemark ? (
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
