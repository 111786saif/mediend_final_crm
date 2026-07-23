'use client'

import { Button } from '@/components/ui/button'
import { Save, RotateCcw, AlertCircle } from 'lucide-react'

interface StickyActionFooterProps {
  isDirty: boolean
  isSaving: boolean
  onDiscard: () => void
  onSave: () => void
}

export function StickyActionFooter({
  isDirty,
  isSaving,
  onDiscard,
  onSave,
}: StickyActionFooterProps) {
  if (!isDirty) return null

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-20 bg-card/95 backdrop-blur-xl border-t border-border text-card-foreground z-50 flex items-center shadow-lg transition-all duration-300">
      <div className="max-w-[1440px] mx-auto px-6 w-full flex justify-between items-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <span>You have unsaved access overrides pending save.</span>
        </div>
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={onDiscard}
            disabled={isSaving}
            className="border-border bg-background text-foreground hover:bg-muted"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Discard Changes
          </Button>
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isSaving ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
                Saving Access Profile...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </footer>
  )
}
