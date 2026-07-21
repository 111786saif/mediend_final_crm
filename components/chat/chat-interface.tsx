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
import { Send, Paperclip, Loader2, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'

interface ChatInterfaceProps {
  leadId: string
}

export function ChatInterface({ leadId }: ChatInterfaceProps) {
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
    refetchInterval: 5000, // Poll every 5 seconds for new messages
  })

  const messages = data?.messages ?? []

  // Mark chat as read when opening and when new messages arrive
  useEffect(() => {
    if (!leadId || !user) return
    apiPost(`/api/leads/${leadId}/chat/read`, {}).then(() => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['badge-counts'] })
    }).catch(() => {})
  }, [leadId, user, messages.length, queryClient])

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
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
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
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send file')
    } finally {
      setSending(false)
    }
    e.target.value = ''
  }

  if (!user) return null

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Chat Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <MessageSquare className="h-4 w-4 text-primary" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">Chat</h2>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground mt-1">Start the conversation below.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} currentUserId={user.id} />
            ))
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-3 border-t border-border bg-card/50">
        <div className="flex items-end gap-2 rounded-3xl border border-border bg-background px-2 py-2 shadow-sm focus-within:ring-1 focus-within:ring-primary transition-shadow">
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
            variant="ghost"
            size="icon"
            className="flex-shrink-0 rounded-full text-muted-foreground hover:text-foreground"
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
            rows={1}
            className="min-h-[36px] max-h-32 resize-none border-0 shadow-none focus-visible:ring-0 px-1 py-1.5 bg-transparent"
            disabled={sending}
          />
          <Button
            type="button"
            size="icon"
            className="flex-shrink-0 rounded-full"
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
    </div>
  )
}