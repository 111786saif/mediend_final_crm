'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { BellRing, MessageSquare, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNotifications, type Notification } from '@/hooks/use-notifications'
import { cn } from '@/lib/utils'

function isChatMessageNotification(notification: Notification) {
  return notification.type === 'CASE_CHAT_MESSAGE'
}

/**
 * Shows an in-app alert for each unread chat notification. The notification is
 * deliberately left unread until the recipient opens that conversation, so the
 * bell and chat badges continue to reflect messages that still need attention.
 */
export function ChatMessagePopup() {
  const { data: notifications } = useNotifications(true)
  const handledIds = useRef(new Set<string>())
  const [queue, setQueue] = useState<Notification[]>([])

  useEffect(() => {
    if (!notifications) return

    const fresh = notifications.filter(
      (notification) => isChatMessageNotification(notification) && !handledIds.current.has(notification.id)
    )
    if (fresh.length === 0) return

    fresh.forEach((notification) => handledIds.current.add(notification.id))
    setQueue((previous) => [...previous, ...fresh])
  }, [notifications])

  const current = queue[0] ?? null
  if (!current) return null

  const dismiss = () => {
    setQueue((previous) => previous.slice(1))
  }

  return (
    <div
      className={cn(
        'fixed left-2 right-2 top-[max(0.5rem,env(safe-area-inset-top))] z-[47]',
        'pointer-events-none animate-in slide-in-from-top-2 fade-in duration-300'
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="pointer-events-auto mx-auto max-w-lg rounded-2xl border-2 border-sky-400/60 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 p-0.5 shadow-xl">
        <div className="rounded-[14px] bg-card/95 px-3 py-2.5 backdrop-blur-sm dark:bg-card/95 md:px-4 md:py-3">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 rounded-full bg-sky-100 p-1.5 dark:bg-sky-950">
              <BellRing className="h-4 w-4 text-sky-700 dark:text-sky-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">New chat message</p>
              <p className="text-sm font-bold leading-snug">{current.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{current.message}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {current.link && (
                  <Button size="sm" className="h-8 rounded-xl text-xs" asChild>
                    <Link href={current.link} onClick={dismiss}>
                      <MessageSquare className="mr-1 h-3.5 w-3.5" />
                      Open chat
                    </Link>
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-8 rounded-xl text-xs" onClick={dismiss}>
                  Dismiss
                </Button>
              </div>
            </div>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 rounded-full" onClick={dismiss} aria-label="Dismiss chat message notification">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
