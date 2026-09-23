'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatMessage, type ChatMessageData } from '@/components/chat/chat-message'
import { useFileUpload } from '@/hooks/use-file-upload'
import { Send, Paperclip, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface CaseChatProps {
  leadId: number
  className?: string
}

export function CaseChat({ leadId, className }: CaseChatProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const { uploadFile, uploading } = useFileUpload({ folder: 'chat' })

  const { data, isLoading } = useQuery<{ messages: ChatMessageData[]; nextCursor: string | null }>({
    queryKey: ['case-chat', leadId],
    queryFn: async () => {
      const res = await apiGet<{ messages: ChatMessageData[]; nextCursor: string | null }>(
        `/api/leads/${leadId}/chat`
      )
      return res
    },
    enabled: !!leadId && !!user,
  })

  const messages = data?.messages ?? []

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || !user) return
    setSending(true)
    try {
      await apiPost(`/api/leads/${leadId}/chat`, {
        type: 'TEXT',
        content: text,
      })
      setInput('')
      queryClient.invalidateQueries({ queryKey: ['case-chat', leadId] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const result = await uploadFile(file)
    if (!result) return
    setSending(true)
    try {
      await apiPost(`/api/leads/${leadId}/chat`, {
        type: 'FILE',
        content: file.name,
        fileUrl: result.url,
        fileName: file.name,
      })
      queryClient.invalidateQueries({ queryKey: ['case-chat', leadId] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send file')
    } finally {
      setSending(false)
    }
    e.target.value = ''
  }

  if (!user) return null

  return (
    <div className={className}>
      <ScrollArea className="h-[360px] w-full rounded-md border bg-card p-3">
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              No messages yet. Start the conversation.
            </p>
          ) : (
            messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} currentUserId={user.id} />
            ))
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>
      <div className="flex gap-2 mt-2">
        <input
          type="file"
          id={`chat-file-${leadId}`}
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onChange={handleFileSelect}
          disabled={uploading || sending}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => document.getElementById(`chat-file-${leadId}`)?.click()}
          disabled={uploading || sending}
          title="Attach file"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </Button>
        <Textarea
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          rows={2}
          className="min-h-[44px] resize-none"
          disabled={sending}
        />
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || sending}
          title="Send"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
