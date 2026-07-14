'use client'

import { Button } from '@/components/ui/button'
import { ExternalLink, Download } from 'lucide-react'
import type { ProfileDocument } from '@/lib/employee-profile'

interface ProfileDocumentsSectionProps {
  documents: ProfileDocument[]
}

export function ProfileDocumentsSection({ documents }: ProfileDocumentsSectionProps) {
  if (documents.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground italic">
        No documents uploaded yet
      </p>
    )
  }

  return (
    <div className="divide-y divide-border/60 -mx-4 sm:-mx-5">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">{doc.label}</p>
            <p className="truncate text-xs text-muted-foreground">{doc.fileName}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
              <a href={doc.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" />
                View
              </a>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
              <a href={doc.url} download={doc.fileName}>
                <Download className="size-3.5" />
                Download
              </a>
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
