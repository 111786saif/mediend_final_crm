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
import { cn } from '@/lib/utils'

const CHAT_API = '/api/ai/chat'

type AIProvider = 'openai' | 'gemini'

interface AIChatSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function OpenAIIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.843-3.371 2.02-1.168a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.402-.679zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  )
}

function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 24A14.304 14.304 0 0 0 0 12 14.304 14.304 0 0 0 12 0a14.305 14.305 0 0 0 12 12 14.305 14.305 0 0 0-12 12" />
    </svg>
  )
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

const PROVIDERS: { id: AIProvider; label: string; sublabel: string }[] = [
  { id: 'openai', label: 'GPT-4o', sublabel: 'mini' },
  { id: 'gemini', label: 'Gemini', sublabel: '2.0 Flash' },
]

export function AIChatSheet({ open, onOpenChange }: AIChatSheetProps) {
  const [inputValue, setInputValue] = useState('')
  const [selectedModel, setSelectedModel] = useState<AIProvider>('openai')

  const transport = useMemo(
    () => new DefaultChatTransport({ api: `${CHAT_API}?model=${selectedModel}` }),
    [selectedModel]
  )

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    onError: (error) => {
      console.error('Chat error:', error)
      toast.error(error.message || 'Failed to get AI response')
    },
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  const handleModelChange = useCallback(
    (model: AIProvider) => {
      if (model === selectedModel) return
      setSelectedModel(model)
      setMessages([])
      setInputValue('')
    },
    [selectedModel, setMessages]
  )

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
  const isGemini = selectedModel === 'gemini'

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="!w-screen !max-w-none flex flex-col p-0 gap-0">

        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2.5 text-xl">
            <div className={cn(
              'h-7 w-7 rounded-lg flex items-center justify-center shadow-sm',
              isGemini
                ? 'bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500'
                : 'bg-black'
            )}>
              {isGemini
                ? <GeminiIcon className="h-4 w-4 text-white" />
                : <OpenAIIcon className="h-4 w-4 text-white" />
              }
            </div>
            mediendAI
            <span className={cn(
              'ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full border',
              isGemini
                ? 'text-purple-600 border-purple-200 bg-purple-50 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-400'
                : 'text-gray-600 border-gray-200 bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-400'
            )}>
              {isGemini ? 'Gemini 2.0 Flash' : 'GPT-4o mini'}
            </span>
          </SheetTitle>
        </SheetHeader>

        {/* Quick questions */}
        <QuickQuestions onSelect={handleQuickQuestion} disabled={isLoading} />

        {/* Messages */}
        <MessageList messages={displayMessages} isLoading={isLoading} />

        {/* Input area */}
        <div className="border-t shrink-0 bg-background/95 backdrop-blur-sm">

          {/* Model selector row */}
          <div className="px-4 pt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 rounded-full bg-muted/70 border border-border/50">
              {PROVIDERS.map((p) => {
                const active = selectedModel === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleModelChange(p.id)}
                    className={cn(
                      'flex items-center gap-1.5 pl-2 pr-3 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 select-none',
                      active && p.id === 'openai' && 'bg-black text-white shadow-sm',
                      active && p.id === 'gemini' && 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white shadow-sm',
                      !active && 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {p.id === 'openai'
                      ? <OpenAIIcon className={cn('h-3 w-3 shrink-0', active ? 'text-white' : 'text-muted-foreground')} />
                      : <GeminiIcon className={cn('h-3 w-3 shrink-0', active ? 'text-white' : 'text-muted-foreground')} />
                    }
                    <span>{p.label}</span>
                    <span className={cn('font-normal', active ? 'opacity-80' : 'opacity-60')}>{p.sublabel}</span>
                  </button>
                )
              })}
            </div>

            <span className="text-[10px] text-muted-foreground/50 hidden sm:block tracking-tight">
              ↵ send · ⇧↵ new line
            </span>
          </div>

          {/* Textarea + send */}
          <form onSubmit={handleSubmit} className="p-3 pt-2">
            <div className={cn(
              'relative rounded-2xl border bg-background shadow-sm overflow-hidden transition-all duration-200',
              'focus-within:shadow-md',
              isGemini
                ? 'border-border/60 focus-within:border-purple-400/50 focus-within:ring-2 focus-within:ring-purple-500/20'
                : 'border-border/60 focus-within:border-gray-400/50 focus-within:ring-2 focus-within:ring-gray-400/20'
            )}>
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={isGemini ? 'Ask Gemini about your data…' : 'Ask GPT about your data…'}
                disabled={isLoading}
                rows={3}
                className="w-full resize-none bg-transparent px-4 pt-3 pb-11 text-sm placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50 leading-relaxed"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
              />

              {/* Bottom bar inside card */}
              <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between">
                {/* Powered-by badge */}
                <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" />
                  Powered by {isGemini ? 'Google Gemini' : 'OpenAI'}
                </span>

                {/* Send button */}
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className={cn(
                    'h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-200',
                    inputValue.trim() && !isLoading
                      ? isGemini
                        ? 'bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 text-white shadow-md hover:shadow-lg hover:scale-105'
                        : 'bg-black text-white shadow-md hover:bg-gray-800 hover:shadow-lg hover:scale-105'
                      : 'bg-muted text-muted-foreground/40 cursor-not-allowed'
                  )}
                >
                  {isLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Send className="h-3.5 w-3.5" />
                  }
                </button>
              </div>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
