'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { AIChatSheet } from './ai-chat-sheet'

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

  // Only show AI features for ADMIN role
  const isAdmin = user?.role === 'ADMIN'

  return (
    <AIContext.Provider value={isAdmin ? { openAI } : null}>
      {children}
      {isAdmin && (
        <AIChatSheet open={isOpen} onOpenChange={setIsOpen} />
      )}
    </AIContext.Provider>
  )
}
