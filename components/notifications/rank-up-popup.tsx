'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useNotifications, useMarkNotificationRead, type Notification } from '@/hooks/use-notifications'
import { Button } from '@/components/ui/button'
import { Trophy, X } from 'lucide-react'

const VISIBLE_ROLES = ['BD', 'TEAM_LEAD', 'SALES_HEAD']

export function RankUpPopup() {
  const { user } = useAuth()
  const isEligible = !!user && VISIBLE_ROLES.includes(user.role)

  const { data: notifications } = useNotifications(true) // unread only
  const markRead = useMarkNotificationRead()

  const [queue, setQueue] = useState<Notification[]>([])
  const [current, setCurrent] = useState<Notification | null>(null)

  // Pull any unread RANK_IMPROVED notifications into a local queue so we
  // show them one at a time, even if several arrived since the last visit.
  useEffect(() => {
    if (!isEligible || !notifications) return
    const rankUps = notifications.filter((n) => n.type === 'RANK_IMPROVED')
    if (rankUps.length === 0) return
    setQueue((prev) => {
      const knownIds = new Set(prev.map((n) => n.id).concat(current ? [current.id] : []))
      const fresh = rankUps.filter((n) => !knownIds.has(n.id))
      return fresh.length > 0 ? [...prev, ...fresh] : prev
    })
  }, [notifications, isEligible, current])

  // Pop the next item off the queue when nothing is currently showing.
  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0])
      setQueue((prev) => prev.slice(1))
    }
  }, [current, queue])

  if (!isEligible || !current) return null

  const dismiss = () => {
    markRead.mutate(current.id)
    setCurrent(null)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-sm rounded-3xl border border-amber-200/60 dark:border-amber-500/20 bg-card shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Celebratory header */}
        <div className="relative bg-gradient-to-br from-amber-400 via-orange-400 to-fuchsia-500 px-6 pt-8 pb-10 text-center overflow-hidden">
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle,white_1px,transparent_1px)] [background-size:16px_16px]" />
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X className="size-5" />
          </button>
          <div className="relative mx-auto flex size-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm mb-3 shadow-lg">
            <Trophy className="size-8 text-white drop-shadow" />
          </div>
          <p className="relative text-white/90 text-xs font-semibold uppercase tracking-wider">Rank Up!</p>
          <h2 className="relative text-white text-xl font-bold mt-1 leading-snug">{current.title}</h2>
        </div>

        {/* Body */}
        <div className="px-6 py-5 text-center">
          <p className="text-sm text-muted-foreground">{current.message}</p>
          <Button onClick={dismiss} className="w-full mt-5 bg-gradient-to-r from-amber-500 to-fuchsia-500 hover:opacity-90 text-white">
            Nice! 🎉
          </Button>
          {queue.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-2">+{queue.length} more update{queue.length === 1 ? '' : 's'}</p>
          )}
        </div>
      </div>
    </div>
  )
}