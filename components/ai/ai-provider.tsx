'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { AIChatSheet } from './ai-chat-sheet'
import { AIFloatingButton } from './ai-floating-button'

const AIContext = createContext<{ openAI: () => void } | null>(null)

export function useAI() {
  const ctx = useContext(AIContext)
  if (!ctx) return null
  return ctx
}

export function AIProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const openAI = useCallback(() => setIsOpen(true), [])

  const hasAIAccess = ['ADMIN', 'MD', 'EXECUTIVE_ASSISTANT', 'FINANCE_HEAD'].includes(user?.role ?? '')

  return (
    <AIContext.Provider value={hasAIAccess ? { openAI } : null}>
      {children}
      {hasAIAccess && (
        <>
          <AIFloatingButton onClick={openAI} />
          <AIChatSheet open={isOpen} onOpenChange={setIsOpen} />
        </>
      )}
    </AIContext.Provider>
  )
}
