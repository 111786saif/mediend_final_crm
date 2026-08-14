'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { File, X } from 'lucide-react'

interface DischargeFileUploadFieldProps {
  label: string
  url: string | null | undefined
  uploading: boolean
  onPick: (f: File) => void
  onClear: () => void
}

export function DischargeFileUploadField({
  label,
  url,
  uploading,
  onPick,
  onClear,
}: DischargeFileUploadFieldProps) {
  const fileName = url ? url.split('/').pop()?.split('?')[0] || 'Document' : ''

  return (
    <div className="space-y-1.5 group">
      <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
        {label}
      </Label>
      <div className="mt-1">
        {url ? (
          <div className="flex items-center justify-between p-2 bg-white dark:bg-muted/40 rounded-md border border-input h-9">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <File className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span
                className="text-xs truncate text-blue-600 hover:underline cursor-pointer"
                onClick={() => window.open(url, '_blank')}
                title={fileName}
              >
                {fileName}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClear}
              disabled={uploading}
              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={uploading}
              onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
              className="h-9 text-xs flex-1 cursor-pointer file:cursor-pointer file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary file:hover:bg-primary/20"
            />
          </div>
        )}
      </div>
    </div>
  )
}
