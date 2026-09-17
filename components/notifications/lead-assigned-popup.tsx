'use client'

import { useEffect, useRef, useState } from 'react'
import { ClipboardList, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMarkNotificationRead, useNotifications, type Notification } from '@/hooks/use-notifications'

function isLeadAssignmentNotification(notification: Notification) {
  return notification.type === 'TASK_ASSIGNED' && notification.title === 'New Lead Assigned'
}

function getLeadDetails(notification: Notification) {
  const match = notification.message.match(/^You have been assigned a new lead:\s*(.*?)\s*\(([^()]+)\)$/)
  return {
    patientName: match?.[1]?.trim() || 'Patient',
    leadRef: match?.[2]?.trim() || notification.relatedId || 'Not available',
  }
}

/** Shows each persisted lead-assignment notification once, including after login. */
export function LeadAssignedPopup() {
  const { data: notifications } = useNotifications(true)
  const markRead = useMarkNotificationRead()
  const handledIds = useRef(new Set<string>())
  const [queue, setQueue] = useState<Notification[]>([])

  useEffect(() => {
    if (!notifications) return

    const fresh = notifications.filter(
      (notification) => isLeadAssignmentNotification(notification) && !handledIds.current.has(notification.id)
    )
    if (fresh.length === 0) return

    fresh.forEach((notification) => handledIds.current.add(notification.id))
    setQueue((previous) => [...previous, ...fresh])
  }, [notifications])

  const current = queue[0] ?? null

  if (!current) return null

  const { patientName, leadRef } = getLeadDetails(current)
  const close = () => {
    markRead.mutate(current.id)
    setQueue((previous) => previous.slice(1))
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-emerald-200/70 bg-card shadow-2xl animate-in zoom-in-95 dark:border-emerald-500/20">
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 px-6 pb-9 pt-8 text-center text-white">
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle,white_1px,transparent_1px)] [background-size:16px_16px]" />
          <button
            type="button"
            onClick={close}
            className="absolute right-3 top-3 text-white/80 transition-colors hover:text-white"
            aria-label="Close lead assignment notification"
          >
            <X className="size-5" />
          </button>
          <div className="relative mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-white/20 shadow-lg backdrop-blur-sm">
            <ClipboardList className="size-8" />
          </div>
          <p className="relative text-xs font-semibold uppercase tracking-wider text-white/90">New Lead Assigned</p>
          <h2 className="relative mt-1 text-xl font-bold leading-snug">{patientName}</h2>
        </div>

        <div className="space-y-4 px-6 py-5 text-center">
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Lead Reference</p>
            <p className="mt-1 font-mono text-base font-semibold text-foreground">{leadRef}</p>
          </div>
          <Button type="button" onClick={close} className="w-full bg-emerald-600 text-white hover:bg-emerald-700">
            Close
          </Button>
          {queue.length > 1 ? (
            <p className="text-[11px] text-muted-foreground">
              {queue.length - 1} more assigned lead{queue.length === 2 ? '' : 's'} waiting
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
