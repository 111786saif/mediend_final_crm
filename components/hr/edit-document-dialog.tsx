'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DocumentRichEditor } from '@/components/hr/document-rich-editor'
import { extractBodyHtml } from '@/lib/hrms/document-merge'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

type DocResponse = {
  document: {
    id: string
    documentType: string
    acknowledgedAt?: string | null
    title?: string | null
  }
  htmlContent: string
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

export function EditDocumentDialog({
  documentId,
  open,
  onOpenChange,
}: {
  documentId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [editHtml, setEditHtml] = useState('')

  const { data, isLoading } = useQuery<DocResponse>({
    queryKey: ['document', documentId, 'edit'],
    queryFn: () => apiGet<DocResponse>(`/api/hr/documents/${documentId}`),
    enabled: open && !!documentId,
  })

  useEffect(() => {
    if (data?.htmlContent) {
      setEditHtml(extractBodyHtml(data.htmlContent))
    }
  }, [data?.htmlContent])

  useEffect(() => {
    if (!open) setEditHtml('')
  }, [open])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!documentId) throw new Error('No document')
      return apiPatch(`/api/hr/documents/${documentId}`, {
        contentHtml: editHtml,
        bodyOnly: true,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-documents'] })
      queryClient.invalidateQueries({ queryKey: ['document', documentId] })
      toast.success('Document saved')
      onOpenChange(false)
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save document'),
  })

  const label = data?.document
    ? TYPE_LABELS[data.document.documentType] || data.document.documentType
    : 'Document'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {label}</DialogTitle>
          <DialogDescription>
            Edit the document content. Changes are saved immediately when you click Save.
            Editing is locked after the employee acknowledges the document.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading document…
          </div>
        ) : data?.document.acknowledgedAt ? (
          <div className="py-8 text-center text-muted-foreground">
            This document has been acknowledged and can no longer be edited.
          </div>
        ) : (
          <div className="space-y-4">
            <DocumentRichEditor content={editHtml} onChange={setEditHtml} minHeight="480px" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !editHtml}>
                {saveMutation.isPending ? 'Saving…' : 'Save Document'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
