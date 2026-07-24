'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { DocumentRichEditor } from '@/components/hr/document-rich-editor'
import { extractBodyHtml } from '@/lib/hrms/document-merge'
import { toast } from 'sonner'
import { ArrowLeft, FileText, Loader2 } from 'lucide-react'
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

export default function DocumentTemplatesPage() {
  const queryClient = useQueryClient()
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [editHtml, setEditHtml] = useState('')

  const { data, isLoading } = useQuery<{ templates: TemplateRow[] }>({
    queryKey: ['document-templates'],
    queryFn: () => apiGet<{ templates: TemplateRow[] }>('/api/hr/document-templates'),
  })

  const templates = data?.templates ?? []

  useEffect(() => {
    if (!selectedType && templates.length > 0) {
      setSelectedType(templates[0].documentType)
    }
  }, [templates, selectedType])

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

  const selectedLabel = selectedType
    ? TYPE_LABELS[selectedType] || templates.find((t) => t.documentType === selectedType)?.name
    : null

  return (
    <div className="flex flex-col gap-6 min-h-[calc(100vh-8rem)]">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-2 mb-1" asChild>
            <Link href="/hr/compensation">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Documents
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Document Templates</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Edit master letter templates. Use Insert field to add placeholders like{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{'{{employeeName}}'}</code>.
          </p>
        </div>
        {selectedType && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save Template'}
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0">
        <aside className="w-full md:w-56 shrink-0 rounded-lg border bg-card overflow-hidden">
          <div className="px-3 py-2 border-b text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Document types
          </div>
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <ul className="p-1.5 space-y-0.5">
              {templates.map((t) => (
                <li key={t.documentType}>
                  <button
                    type="button"
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-md text-sm flex items-center gap-2 transition-colors',
                      selectedType === t.documentType
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted text-foreground'
                    )}
                    onClick={() => setSelectedType(t.documentType)}
                  >
                    <FileText
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        selectedType === t.documentType
                          ? 'text-primary-foreground/80'
                          : 'text-muted-foreground'
                      )}
                    />
                    <span className="truncate font-medium">
                      {TYPE_LABELS[t.documentType] || t.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {selectedLabel && (
            <div className="text-sm font-medium text-foreground">{selectedLabel}</div>
          )}
          {!selectedType ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground border rounded-lg border-dashed min-h-[480px] bg-card">
              Select a document type to edit its template
            </div>
          ) : (
            <DocumentRichEditor
              content={editHtml}
              onChange={setEditHtml}
              showPlaceholders
              minHeight="560px"
              className="flex-1"
            />
          )}
        </div>
      </div>
    </div>
  )
}
