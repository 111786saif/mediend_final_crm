'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useRouter } from 'next/navigation'
import { format, formatDistanceToNow } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { getCaseStageLabel } from '@/lib/case-stage-labels'
import { useMemo, useState } from 'react'

interface Conversation {
  leadId: string
  leadRef: string
  patientName: string
  phoneNumber: string
  circle: string
  caseStage: string
  createdDate: string | Date | null
  bd: { id: string; name: string } | null
  latestMessage: {
    id: string
    content: string
    type: string
    createdAt: Date
    sender: {
      id: string
      name: string
      role: string
    } | null
  } | null
  unreadCount: number
  totalMessages: number
  updatedAt: Date
}

interface ChatListProps {
  selectedLeadId?: string
}

export function ChatList({ selectedLeadId }: ChatListProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [monthFilter, setMonthFilter] = useState<string>('all')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [bdFilter, setBdFilter] = useState<string>('all')

  const { data: conversations, isLoading } = useQuery<Conversation[]>({
    queryKey: ['chat-conversations'],
    queryFn: async () => {
      const res = await apiGet<Conversation[]>('/api/chat/conversations')
      // Convert date strings to Date objects
      return res.map((conv) => ({
        ...conv,
        latestMessage: conv.latestMessage
          ? {
              ...conv.latestMessage,
              createdAt: new Date(conv.latestMessage.createdAt),
            }
          : null,
        updatedAt: new Date(conv.updatedAt),
      }))
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  const showBdFilter = user?.role === 'TEAM_LEAD'

  const monthOptions = useMemo(() => {
    if (!conversations) return []
    const months = new Set<string>()
    for (const c of conversations) {
      if (!c.createdDate) continue
      const d = new Date(c.createdDate)
      if (Number.isNaN(d.getTime())) continue
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a))
  }, [conversations])

  const stageOptions = useMemo(() => {
    if (!conversations) return []
    const stages = new Set<string>()
    for (const c of conversations) {
      if (c.caseStage) stages.add(c.caseStage)
    }
    return Array.from(stages).sort()
  }, [conversations])

  const bdOptions = useMemo(() => {
    if (!showBdFilter || !conversations) return []
    const map = new Map<string, string>()
    for (const c of conversations) {
      if (c.bd?.id && c.bd.name) map.set(c.bd.id, c.bd.name)
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [conversations, showBdFilter])

  const filteredConversations = useMemo(() => {
    if (!conversations) return []
    return conversations.filter((c) => {
      if (monthFilter !== 'all') {
        if (!c.createdDate) return false
        const d = new Date(c.createdDate)
        if (Number.isNaN(d.getTime())) return false
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (key !== monthFilter) return false
      }
      if (stageFilter !== 'all' && c.caseStage !== stageFilter) return false
      if (bdFilter !== 'all' && c.bd?.id !== bdFilter) return false
      return true
    })
  }, [conversations, monthFilter, stageFilter, bdFilter])

  const filterBar = (
    <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-800">
      <Select value={monthFilter} onValueChange={setMonthFilter}>
        <SelectTrigger className="h-8 w-[120px] text-xs">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All months</SelectItem>
          {monthOptions.map((m) => {
            const [y, mo] = m.split('-')
            const label = format(new Date(Number(y), Number(mo) - 1, 1), 'MMM yyyy')
            return (
              <SelectItem key={m} value={m}>
                {label}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
      <Select value={stageFilter} onValueChange={setStageFilter}>
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue placeholder="Stage" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All stages</SelectItem>
          {stageOptions.map((s) => (
            <SelectItem key={s} value={s}>
              {getCaseStageLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showBdFilter && (
        <Select value={bdFilter} onValueChange={setBdFilter}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="BD" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All BDs</SelectItem>
            {bdOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )

  if (isLoading) {
    return (
      <div>
        {filterBar}
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div>
        {filterBar}
        <div className="p-4 text-center text-sm text-muted-foreground">
          No conversations yet
        </div>
      </div>
    )
  }

  if (filteredConversations.length === 0) {
    return (
      <div>
        {filterBar}
        <div className="p-4 text-center text-sm text-muted-foreground">
          No conversations match the selected filters
        </div>
      </div>
    )
  }

  return (
    <div>
      {filterBar}
      <div className="divide-y divide-gray-200 dark:divide-gray-800">
      {filteredConversations.map((conversation) => {
        const isSelected = selectedLeadId === conversation.leadId
        const preview = conversation.latestMessage
          ? conversation.latestMessage.content.substring(0, 50) + (conversation.latestMessage.content.length > 50 ? '...' : '')
          : 'No messages yet'

        return (
          <button
            key={conversation.leadId}
            onClick={() => {
              router.push(`/chat/${conversation.leadId}`)
              router.refresh()
            }}
            className={cn(
              'w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors',
              isSelected && 'bg-blue-50 dark:bg-blue-950/30 border-r-2 border-blue-600'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                    {conversation.patientName}
                  </h3>
                  {conversation.unreadCount > 0 && (
                    <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center px-1.5 text-xs">
                      {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-1">
                  {conversation.leadRef} • {conversation.circle}
                </p>
                {conversation.latestMessage && (
                  <div className="flex items-center gap-2 mt-1">
                    <MessageSquare className="h-3 w-3 text-gray-400 flex-shrink-0" />
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {conversation.latestMessage.sender?.name || 'System'}: {preview}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 text-xs text-gray-400">
                {conversation.latestMessage
                  ? formatDistanceToNow(conversation.latestMessage.createdAt, { addSuffix: true })
                  : formatDistanceToNow(conversation.updatedAt, { addSuffix: true })}
              </div>
            </div>
          </button>
        )
      })}
      </div>
    </div>
  )
}
