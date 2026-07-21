'use client'

import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { FileText, User } from 'lucide-react'
import { ChatMessageType } from '@/generated/prisma/enums'

export interface ChatMessageData {
  id: string
  type: ChatMessageType
  content: string
  fileUrl: string | null
  fileName: string | null
  createdAt: string
  sender: { id: string; name: string; role: string } | null
}

interface ChatMessageProps {
  message: ChatMessageData
  currentUserId: string
}

// Deterministic hue per sender so the same person always gets the same avatar color.
function nameToHue(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % 360
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

export function ChatMessage({ message, currentUserId }: ChatMessageProps) {
  const isSystem = message.type === ChatMessageType.SYSTEM
  const isOwn = message.sender?.id === currentUserId
  const isFile = message.type === ChatMessageType.FILE

  if (isSystem) {
    return (
      <div className="flex justify-center my-1">
        <div className="rounded-full border border-border bg-muted/60 px-3 py-1 text-[11px] leading-relaxed text-muted-foreground max-w-[85%] text-center">
          {message.content}
        </div>
      </div>
    )
  }

  const senderName = message.sender?.name ?? 'Unknown'
  const hue = nameToHue(senderName)

  return (
    <div className={cn('flex items-end gap-2', isOwn && 'flex-row-reverse')}>
      {isOwn ? (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
          <User className="h-4 w-4 text-primary" />
        </div>
      ) : (
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold"
          style={{
            backgroundColor: `hsl(${hue} 70% 92%)`,
            color: `hsl(${hue} 55% 32%)`,
          }}
        >
          {initials(senderName)}
        </div>
      )}

      <div className={cn('flex flex-col gap-1 max-w-[75%]', isOwn && 'items-end')}>
        <div className={cn('flex items-center gap-1.5', isOwn && 'flex-row-reverse')}>
          <span className="text-xs font-medium text-foreground/80">{senderName}</span>
          {message.sender?.role && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-muted-foreground">
              {message.sender.role}
            </span>
          )}
        </div>

        <div
          className={cn(
            'rounded-2xl px-3 py-2 shadow-sm',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-card border border-border text-card-foreground rounded-bl-sm'
          )}
        >
          {isFile && message.fileUrl && message.fileName ? (
            <a
              href={message.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex items-center gap-1.5 text-sm underline underline-offset-2',
                isOwn ? 'text-primary-foreground' : 'text-foreground'
              )}
            >
              <FileText className="h-4 w-4 flex-shrink-0" />
              <span className="break-all">{message.fileName}</span>
            </a>
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}
        </div>

        <span className="text-[10px] text-muted-foreground px-1">
          {format(new Date(message.createdAt), 'MMM d, HH:mm')}
        </span>
      </div>
    </div>
  )
}