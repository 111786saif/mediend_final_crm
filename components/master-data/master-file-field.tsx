'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFileUpload } from '@/hooks/use-file-upload'
import { ExternalLink, Loader2, Trash2, Upload } from 'lucide-react'

interface MasterFileFieldProps {
  label: string
  value: string
  onChange: (url: string) => void
  folder: string
  disabled?: boolean
  accept?: string
}

export function MasterFileField({
  label,
  value,
  onChange,
  folder,
  disabled,
  accept = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx',
}: MasterFileFieldProps) {
  const { uploadFile, uploading } = useFileUpload({
    folder,
    endpoint: '/api/masters/upload',
  })

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = accept
            input.onchange = async () => {
              const file = input.files?.[0]
              if (!file) return
              const result = await uploadFile(file)
              if (result?.url) onChange(result.url)
            }
            input.click()
          }}
        >
          {uploading ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Upload className="mr-1.5 size-3.5" />
          )}
          {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}
        </Button>
        {value ? (
          <>
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary"
            >
              <ExternalLink className="size-3.5" />
              View
            </a>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || uploading}
              onClick={() => onChange('')}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">No file</span>
        )}
      </div>
      {value ? (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-xs"
          disabled={disabled}
        />
      ) : null}
    </div>
  )
}
