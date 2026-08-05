'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Phone, PhoneCall, PhoneForwarded, PhoneOff } from 'lucide-react'
import { cn } from '@/lib/utils'

type CallState = 'receiving_call' | 'on_call' | 'call_finished' | 'update'

type StreamCallEvent = {
  state: CallState
  label: string
  eventType: string
  agentPhone?: string | null
  payload?: unknown
  receivedAt?: string
}

const stateStyles: Record<CallState, { icon: typeof Phone; badge: string; tone: string }> = {
  receiving_call: {
    icon: PhoneForwarded,
    badge: 'Receiving Call',
    tone: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  },
  on_call: {
    icon: PhoneCall,
    badge: 'On Call',
    tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
  },
  call_finished: {
    icon: PhoneOff,
    badge: 'Call Finished',
    tone: 'border-slate-500/30 bg-slate-500/10 text-slate-100',
  },
  update: {
    icon: Phone,
    badge: 'Call Update',
    tone: 'border-primary/30 bg-primary/10 text-foreground',
  },
}

function formatTimestamp(value?: string) {
  if (!value) return null
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
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

        if (payload.state === 'call_finished') {
          hideTimerRef.current = window.setTimeout(() => {
            setEvent((current) =>
              current?.receivedAt === payload.receivedAt ? null : current
            )
            hideTimerRef.current = null
          }, 5000)
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

  if (!display || !connected) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-4">
      <div
        className={cn(
          'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md',
          'bg-card/95 text-card-foreground',
          display.tone
        )}
      >
        <div className="mt-0.5 rounded-full border border-current/20 p-2">
          <display.Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-current/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
              {display.badge}
            </span>
            {display.timestamp ? (
              <span className="text-xs opacity-80">{display.timestamp}</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-medium leading-5">{event.label}</p>
          <p className="mt-1 text-xs opacity-80 break-words">
            Status: {titleCaseForUi(event.eventType)}
            {event.agentPhone ? ` · Agent: ${event.agentPhone}` : ''}
          </p>
        </div>
      </div>
    </div>
  )
}

function titleCaseForUi(text: string) {
  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}
