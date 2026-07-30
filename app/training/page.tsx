'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useChat } from '@ai-sdk/react'
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai'
import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { Button } from '@/components/ui/button'
import { MarkdownMessage } from '@/components/ai/markdown-message'
import { ToolStatusPill } from '@/components/ai/tool-status-pill'
import { ToolWidget } from '@/components/ai/tool-widget'
import { apiGet } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  FileText,
  GraduationCap,
  Send,
  Sparkles,
  Target,
  Users,
  Wallet,
  Stethoscope,
} from 'lucide-react'

type Capabilities = {
  role: string
  name: string
  teamSize: number
  canManageKnowledge: boolean
  tools: string[]
  suggestedPrompts: string[]
}

const FALLBACK_PROMPTS = [
  { icon: Target, label: 'What is my target this month?' },
  { icon: Stethoscope, label: 'How many IPDs have I done this month?' },
  { icon: Wallet, label: 'How many leaves do I have left?' },
  { icon: Users, label: 'How do I check my team’s IPD numbers?' },
]

function getTextFromParts(
  parts: Array<{ type: string; text?: string }> | undefined
): string {
  if (!parts) return ''
  return parts
    .filter((p) => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text as string)
    .join('')
}

function getToolParts(
  parts: Array<Record<string, unknown>> | undefined
): Array<{
  toolName: string
  state: string
  output?: unknown
}> {
  if (!parts) return []
  const out: Array<{ toolName: string; state: string; output?: unknown }> = []
  for (const p of parts) {
    const type = String(p.type || '')
    if (type.startsWith('tool-') || type === 'dynamic-tool') {
      const toolName =
        (p.toolName as string) ||
        (type.startsWith('tool-') ? type.slice(5) : 'tool')
      out.push({
        toolName,
        state: String(p.state || ''),
        output: p.output,
      })
    }
  }
  return out
}

export default function TrainingPage() {
  const [draft, setDraft] = useState('')
  const [caps, setCaps] = useState<Capabilities | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiGet<Capabilities>('/api/ai/capabilities')
      .then(setCaps)
      .catch(() => setCaps(null))
  }, [])

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/ai/chat' }),
    []
  )

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: (error) => {
      console.error('Chat error:', error)
      toast.error(error.message || 'Failed to get AI response')
    },
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, isLoading])

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return
      setDraft('')
      void sendMessage({ text: trimmed })
    },
    [isLoading, sendMessage]
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    send(draft)
  }

  const suggested =
    caps?.suggestedPrompts?.length
      ? caps.suggestedPrompts.map((label) => ({
          icon: Sparkles,
          label,
        }))
      : FALLBACK_PROMPTS

  return (
    <AuthenticatedLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shrink-0">
              <GraduationCap className="size-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">mediend AI</h1>
              <p className="text-xs text-muted-foreground">
                Role-scoped assistant
                {caps ? ` · ${caps.role}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {caps?.canManageKnowledge && (
              <Button asChild variant="outline" size="sm">
                <Link href="/training/documents">
                  <FileText className="size-3.5 mr-1.5" />
                  Documents
                </Link>
              </Button>
            )}
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMessages([])
                  setDraft('')
                }}
              >
                New chat
              </Button>
            )}
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-6 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white mb-4 shadow-sm">
                <Sparkles className="size-6" />
              </div>
              <h2 className="text-lg font-semibold mb-1">
                How can I help you today?
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                Ask about your targets, leaves, attendance, team performance, or
                portal how-tos — answers are scoped to what you can access.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {suggested.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => send(p.label)}
                    className="flex items-center gap-2.5 rounded-xl border bg-card hover:bg-muted/40 transition-colors px-4 py-3 text-left text-sm"
                  >
                    <p.icon className="size-4 text-violet-500 shrink-0" />
                    <span className="truncate">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
              {messages.map((m) => {
                const text = getTextFromParts(
                  m.parts as Array<{ type: string; text?: string }>
                )
                const toolParts = getToolParts(
                  m.parts as Array<Record<string, unknown>>
                )
                return (
                  <div
                    key={m.id}
                    className={cn(
                      'flex gap-3',
                      m.role === 'user' && 'flex-row-reverse'
                    )}
                  >
                    <div
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                        m.role === 'assistant'
                          ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white'
                          : 'bg-muted text-foreground'
                      )}
                    >
                      {m.role === 'assistant' ? (
                        <GraduationCap className="size-3.5" />
                      ) : (
                        'Y'
                      )}
                    </div>
                    <div
                      className={cn(
                        'rounded-2xl px-4 py-2.5 text-sm leading-relaxed max-w-[85%]',
                        m.role === 'assistant'
                          ? 'bg-muted/60'
                          : 'bg-violet-600 text-white'
                      )}
                    >
                      {m.role === 'assistant' ? (
                        <>
                          <div className="flex flex-wrap gap-1.5 mb-1">
                            {toolParts
                              .filter(
                                (t) =>
                                  t.state === 'input-streaming' ||
                                  t.state === 'input-available' ||
                                  t.state === 'partial-call'
                              )
                              .map((t, i) => (
                                <ToolStatusPill
                                  key={`${t.toolName}-${i}`}
                                  toolName={t.toolName}
                                />
                              ))}
                          </div>
                          {text ? <MarkdownMessage content={text} /> : null}
                          {toolParts
                            .filter((t) => t.state === 'output-available' && t.output)
                            .map((t, i) => (
                              <ToolWidget
                                key={`${t.toolName}-out-${i}`}
                                toolName={t.toolName}
                                output={t.output}
                              />
                            ))}
                        </>
                      ) : (
                        text
                      )}
                    </div>
                  </div>
                )
              })}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                    <GraduationCap className="size-3.5" />
                  </div>
                  <div className="rounded-2xl px-4 py-2.5 bg-muted/60 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
                    <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
                    <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t p-4">
          <form
            onSubmit={handleSubmit}
            className="max-w-3xl mx-auto flex items-end gap-2"
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send(draft)
                }
              }}
              placeholder="Ask about your targets, leaves, team, or portal how-tos…"
              rows={1}
              className="flex-1 resize-none rounded-xl border bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 max-h-32"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!draft.trim() || isLoading}
              className="shrink-0 bg-violet-600 hover:bg-violet-700"
            >
              <Send className="size-4" />
            </Button>
          </form>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Answers are scoped to your role and team. Never invents numbers —
            only reports what tools return.
          </p>
        </div>
      </div>
    </AuthenticatedLayout>
  )
}
