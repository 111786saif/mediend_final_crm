'use client'

import { Sparkles } from 'lucide-react'

interface AIFloatingButtonProps {
  onClick: () => void
}

export function AIFloatingButton({ onClick }: AIFloatingButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed right-4 z-40 h-10 w-10 rounded-full border border-border bg-card shadow-md hover:bg-muted/80 transition-colors flex items-center justify-center md:hidden"
      style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
      aria-label="Open mediendAI"
    >
      <Sparkles className="h-4 w-4 text-muted-foreground" />
    </button>
  )
}
