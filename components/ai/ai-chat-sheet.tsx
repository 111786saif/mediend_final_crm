'use client'

import { useState, useCallback, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Sparkles, Send, Loader2 } from 'lucide-react'
import { MessageList } from './message-list'
import { QuickQuestions } from './quick-questions'
import { toast } from 'sonner'

const CHAT_API = '/api/ai/chat'

interface AIChatSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Normalize UIMessage (parts) to simple { id, role, content } for MessageList */
function messagesToDisplay(messages: { id: string; role: string; parts?: Array<{ type: string; text?: string }> }[]) {
  return messages.map((m) => {
    const content = (m.parts ?? [])
      .filter((p) => p.type === 'text' && 'text' in p && typeof p.text === 'string')
      .map((p) => (p as { text: string }).text)
      .join('')
    return { id: m.id, role: m.role, content }
  })
}

export function AIChatSheet({ open, onOpenChange }: AIChatSheetProps) {
  const [inputValue, setInputValue] = useState('')

  const transport = useMemo(
    () => new DefaultChatTransport({ api: CHAT_API }),
    []
  )

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    onError: (error) => {
      console.error('Chat error:', error)
      toast.error(error.message || 'Failed to get AI response')
    },
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Clear chat when sheet is closed
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setMessages([])
        setInputValue('')
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange, setMessages]
  )

  const handleQuickQuestion = useCallback(
    (question: string) => {
      sendMessage({ text: question })
    },
    [sendMessage]
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const text = inputValue.trim()
      if (!text || isLoading) return
      sendMessage({ text })
      setInputValue('')
    },
    [inputValue, isLoading, sendMessage]
  )

  const displayMessages = messagesToDisplay(messages)

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="!w-screen !max-w-none flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-purple-500" />
            mediendAI
          </SheetTitle>
        </SheetHeader>

        <QuickQuestions onSelect={handleQuickQuestion} disabled={isLoading} />

        <MessageList messages={displayMessages} isLoading={isLoading} />

        <form onSubmit={handleSubmit} className="border-t p-4">
          <div className="flex gap-2">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask about your data..."
              disabled={isLoading}
              className="min-h-[60px] resize-none flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-md px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 flex items-center justify-center"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
