'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DocumentRichEditor } from '@/components/hr/document-rich-editor'
import { extractBodyHtml } from '@/lib/hrms/document-merge'
import { toast } from 'sonner'
import { FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type TemplateRow = {
  id: string | null
  documentType: string
  name: string
  contentHtml: string
  updatedAt: string | null
}

const TYPE_LABELS: Record<string, string> = {
  OFFER_LETTER: 'Offer Letter',
  INCREMENT_LETTER: 'Increment Letter',
  EXPERIENCE_LETTER: 'Experience Letter',
  RELIEVING_LETTER: 'Relieving Letter',
  INTERNSHIP_OFFER_LETTER: 'Internship Offer',
  INTERNSHIP_COMPLETION_LETTER: 'Internship Completion',
  EXIT_INTERVIEW_FORM: 'Exit Interview',
}

export function ManageTemplatesDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [editHtml, setEditHtml] = useState('')

  const { data, isLoading } = useQuery<{ templates: TemplateRow[] }>({
    queryKey: ['document-templates'],
    queryFn: () => apiGet<{ templates: TemplateRow[] }>('/api/hr/document-templates'),
    enabled: open,
  })

  const templates = data?.templates ?? []

  useEffect(() => {
    if (!open) {
      setSelectedType(null)
      setEditHtml('')
    }
  }, [open])

  useEffect(() => {
    if (!selectedType) return
    const t = templates.find((x) => x.documentType === selectedType)
    if (t) setEditHtml(extractBodyHtml(t.contentHtml) || t.contentHtml)
  }, [selectedType, templates])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedType) throw new Error('No template selected')
      return apiPut(`/api/hr/document-templates/${selectedType}`, {
        contentHtml: editHtml,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] })
      toast.success('Template saved')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save template'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Document Templates</DialogTitle>
          <DialogDescription>
            Edit master letter templates. Use Insert field to add placeholders like {'{{employeeName}}'}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 min-h-0 flex-1 overflow-hidden">
          <div className="w-52 shrink-0 border rounded-md overflow-y-auto max-h-[65vh]">
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : (
              <ul className="p-1">
                {templates.map((t) => (
                  <li key={t.documentType}>
                    <button
                      type="button"
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 hover:bg-muted',
                        selectedType === t.documentType && 'bg-muted font-medium'
                      )}
                      onClick={() => setSelectedType(t.documentType)}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{TYPE_LABELS[t.documentType] || t.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-3">
            {!selectedType ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground border rounded-md border-dashed min-h-[360px]">
                Select a document type to edit its template
              </div>
            ) : (
              <>
                <DocumentRichEditor
                  content={editHtml}
                  onChange={setEditHtml}
                  showPlaceholders
                  minHeight="480px"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSelectedType(null)}>
                    Back
                  </Button>
                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Saving…' : 'Save Template'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
