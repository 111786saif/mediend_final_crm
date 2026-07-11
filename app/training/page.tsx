'use client'

import { useState, useRef, useEffect } from 'react'
import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  GraduationCap,
  Send,
  Sparkles,
  Stethoscope,
  Target,
  Wallet,
  Users,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// ─── Static placeholder data (UI only — no backend wired up yet) ─────────────

const SUGGESTED_PROMPTS = [
  { icon: Stethoscope, label: 'How do I mark a lead as IPD done?' },
  { icon: Target, label: 'Where can I see my monthly target progress?' },
  { icon: Wallet, label: 'How is net profit calculated for a case?' },
  { icon: Users, label: 'How do I check my team\u2019s IPD numbers?' },
]

const PLACEHOLDER_REPLY =
  "I'm still being trained on portal workflows, so I can't answer that yet. This assistant is currently a preview of the experience \u2014 once it's connected, I'll be able to walk you through any flow in Mediend step by step."

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrainingPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, isThinking])

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isThinking) return

    const userMsg: ChatMessage = { id: makeId(), role: 'user', content: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setDraft('')
    setIsThinking(true)

    // Placeholder response — no LLM wired up yet, this is UI scaffolding only.
    setTimeout(() => {
      const assistantMsg: ChatMessage = { id: makeId(), role: 'assistant', content: PLACEHOLDER_REPLY }
      setMessages((prev) => [...prev, assistantMsg])
      setIsThinking(false)
    }, 900)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    send(draft)
  }

  return (
    <AuthenticatedLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-6 py-4 border-b">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shrink-0">
            <GraduationCap className="size-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">Portal Training Assistant</h1>
            <p className="text-xs text-muted-foreground">Ask anything about how the portal works</p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-6 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white mb-4 shadow-sm">
                <Sparkles className="size-6" />
              </div>
              <h2 className="text-lg font-semibold mb-1">How can I help you today?</h2>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                Ask me how any part of the Mediend portal works — creating requests, understanding
                your targets, submitting claims, and more.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTED_PROMPTS.map((p) => (
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
              {messages.map((m) => (
                <div key={m.id} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
                  <div
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      m.role === 'assistant'
                        ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white'
                        : 'bg-muted text-foreground'
                    )}
                  >
                    {m.role === 'assistant' ? <GraduationCap className="size-3.5" /> : 'Y'}
                  </div>
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-2.5 text-sm leading-relaxed max-w-[80%]',
                      m.role === 'assistant' ? 'bg-muted/60' : 'bg-violet-600 text-white'
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {isThinking && (
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

        {/* Composer */}
        <div className="border-t p-4">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send(draft)
                }
              }}
              placeholder="Ask about any portal flow — e.g. 'How do I raise MD approval?'"
              rows={1}
              className="flex-1 resize-none rounded-xl border bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 max-h-32"
            />
            <Button type="submit" size="icon" disabled={!draft.trim() || isThinking} className="shrink-0 bg-violet-600 hover:bg-violet-700">
              <Send className="size-4" />
            </Button>
          </form>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Preview UI — responses aren&apos;t generated by a live assistant yet.
          </p>
        </div>
      </div>
    </AuthenticatedLayout>
  )
}